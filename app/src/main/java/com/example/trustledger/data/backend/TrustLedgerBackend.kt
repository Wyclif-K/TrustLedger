package com.example.trustledger.data.backend

import android.content.Context
import android.content.SharedPreferences
import com.example.trustledger.BuildConfig
import com.example.trustledger.R
import com.example.trustledger.data.ApiEnvelope
import com.example.trustledger.data.HealthDto
import com.example.trustledger.data.RefreshData
import com.example.trustledger.data.RefreshRequest
import com.example.trustledger.data.remote.api.TrustLedgerApiService
import com.example.trustledger.utils.humanReadableApiError
import com.example.trustledger.utils.normalizeTrustLedgerApiBaseUrl
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.reflect.TypeToken
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * App ↔ TrustLedger Node API (`blockchain-core/backend`): one Retrofit instance per [api] call after URL changes.
 *
 * Expected base URL shape: `http://<PC_LAN_IP>:3000/api/v1/` (trailing slash).
 * Precedence: saved Settings URL → [BuildConfig.API_BASE_URL] (from `local.properties` / `gradle.properties`) → [R.string.api_base_url].
 */
typealias TrustLedgerApi = TrustLedgerApiService

object TrustLedgerPrefs {
    const val NAME = "trustledger_prefs"
    const val ACCESS = "accessToken"
    const val REFRESH = "refreshToken"
    /** Persisted override from Settings; if unset, [defaultApiBaseUrl] applies. */
    const val API_BASE_URL = "api_base_url"
}

object TrustLedgerBackend {

    /** Default URL with no trailing slash (nothing saved in prefs yet). */
    fun defaultApiBaseUrl(context: Context): String {
        val app = context.applicationContext
        val fromBuild = BuildConfig.API_BASE_URL.trim().trimEnd('/')
        return if (fromBuild.isNotEmpty()) {
            fromBuild
        } else {
            app.getString(R.string.api_base_url).trimEnd('/')
        }
    }

    fun resolveBaseUrl(context: Context): String {
        val app = context.applicationContext
        val prefs = app.getSharedPreferences(TrustLedgerPrefs.NAME, Context.MODE_PRIVATE)
        val stored = prefs.getString(TrustLedgerPrefs.API_BASE_URL, null)?.trim()
        val raw = if (!stored.isNullOrBlank()) stored else defaultApiBaseUrl(app)
        return raw.trimEnd('/') + "/"
    }

    fun api(context: Context): TrustLedgerApi {
        val app = context.applicationContext
        val prefs = app.getSharedPreferences(TrustLedgerPrefs.NAME, Context.MODE_PRIVATE)
        val baseUrl = resolveBaseUrl(app)
        val gson = Gson()

        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        val baseClient = OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()

        val authenticator = TokenAuthenticator(prefs, baseUrl, gson, baseClient)

        val client = baseClient.newBuilder()
            .authenticator(authenticator)
            .addInterceptor { chain ->
                val req = chain.request()
                val path = req.url.encodedPath
                if (path.endsWith("/auth/login") || path.endsWith("/auth/refresh")) {
                    return@addInterceptor chain.proceed(req)
                }
                if (!req.header("Authorization").isNullOrBlank()) {
                    return@addInterceptor chain.proceed(req)
                }
                val token = prefs.getString(TrustLedgerPrefs.ACCESS, null)
                val next = if (token.isNullOrBlank()) {
                    req
                } else {
                    req.newBuilder().header("Authorization", "Bearer $token").build()
                }
                chain.proceed(next)
            }
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
            .create(TrustLedgerApiService::class.java)
    }

    /** GET `{base}/health` without auth. [baseUrlInput] is a full API base like `http://host:3000/api/v1/`. */
    fun probeHealthAtBaseUrl(baseUrlInput: String): String {
        val base = normalizeTrustLedgerApiBaseUrl(baseUrlInput.trim())
            ?: return "Invalid base URL. Use http://IP:PORT/api/v1/ (see the hint below the field)."
        val gson = Gson()
        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
        val url = base.trimEnd('/') + "/health"
        val request = Request.Builder().url(url).get().build()
        return try {
            client.newCall(request).execute().use { response ->
                val bodyStr = response.body?.string().orEmpty()
                if (response.isSuccessful) {
                    val b = try {
                        gson.fromJson(bodyStr, HealthDto::class.java)
                    } catch (_: Exception) {
                        null
                    }
                    return@use when (b?.database) {
                        "up" -> "OK: API and PostgreSQL are reachable."
                        "down" ->
                            "API reached the server, but PostgreSQL is DOWN. On the PC: start PostgreSQL, set DATABASE_URL in blockchain-core/backend/.env, run: npx prisma migrate deploy, then restart the API."
                        else -> "API responded (database status: ${b?.database ?: "unknown"})."
                    }
                }
                if (bodyStr.isNotBlank()) {
                    try {
                        val o = gson.fromJson(bodyStr, JsonObject::class.java)
                        if (o != null) {
                            o.get("message")?.asString?.trim()?.takeIf { it.isNotEmpty() }?.let { return@use it }
                            if (o.get("database")?.asString == "down") {
                                return@use "PostgreSQL is DOWN on the server PC. Start Postgres, fix DATABASE_URL, run prisma migrate deploy, restart Node."
                            }
                        }
                    } catch (_: Exception) {
                    }
                }
                "HTTP ${response.code} ${response.message}. Check the URL, that Node is running, and Windows Firewall allows port 3000."
            }
        } catch (e: Exception) {
            humanReadableApiError(e)
        }
    }
}

private class TokenAuthenticator(
    private val prefs: SharedPreferences,
    private val baseUrl: String,
    private val gson: Gson,
    private val refreshClient: OkHttpClient,
) : Authenticator {

    private val lock = Any()

    override fun authenticate(route: Route?, response: Response): Request? {
        val path = response.request.url.encodedPath
        if (path.endsWith("/auth/login") || path.endsWith("/auth/refresh")) {
            return null
        }
        if (responseCount(response) >= 2) {
            return null
        }

        synchronized(lock) {
            val failedAuth = response.request.header("Authorization")
                ?.removePrefix("Bearer")
                ?.trim()
            val current = prefs.getString(TrustLedgerPrefs.ACCESS, null)
            if (!current.isNullOrBlank() && current != failedAuth) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $current")
                    .build()
            }

            val refreshToken = prefs.getString(TrustLedgerPrefs.REFRESH, null)
                ?: run {
                    prefs.edit().remove(TrustLedgerPrefs.ACCESS).apply()
                    return null
                }

            val json = gson.toJson(RefreshRequest(refreshToken))
            val url = "${baseUrl.trimEnd('/')}/auth/refresh"
            val req = Request.Builder()
                .url(url)
                .post(json.toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()

            val refreshResponse = refreshClient.newCall(req).execute()
            val body = refreshResponse.body?.string().orEmpty()

            if (!refreshResponse.isSuccessful) {
                prefs.edit()
                    .remove(TrustLedgerPrefs.ACCESS)
                    .remove(TrustLedgerPrefs.REFRESH)
                    .apply()
                return null
            }

            val type = TypeToken.getParameterized(ApiEnvelope::class.java, RefreshData::class.java).type
            val envelope: ApiEnvelope<RefreshData> = gson.fromJson(body, type)
            val newAccess = envelope.data?.accessToken
            if (!envelope.success || newAccess.isNullOrBlank()) {
                prefs.edit()
                    .remove(TrustLedgerPrefs.ACCESS)
                    .remove(TrustLedgerPrefs.REFRESH)
                    .apply()
                return null
            }

            prefs.edit().putString(TrustLedgerPrefs.ACCESS, newAccess).apply()

            return response.request.newBuilder()
                .header("Authorization", "Bearer $newAccess")
                .build()
        }
    }

    private fun responseCount(response: Response): Int {
        var n = 1
        var p = response.priorResponse
        while (p != null) {
            n++
            p = p.priorResponse
        }
        return n
    }
}
