package com.example.trustledger.utils

import com.google.gson.Gson
import com.google.gson.JsonObject
import retrofit2.HttpException
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/** Collapses "X X" when the payload is the same message twice (common with Fabric + API wrapping). */
private fun String.collapseDuplicateMessage(): String {
    var t = trim()
    while (t.length >= 8 && t.length % 2 == 0) {
        val h = t.length / 2
        val a = t.substring(0, h)
        val b = t.substring(h)
        if (a == b) {
            t = a.trim()
            continue
        }
        break
    }
    return t
}

fun humanReadableApiError(e: Throwable): String {
    when (e) {
        is UnknownHostException ->
            return "Can't find the server host. Check api_base_url in strings.xml and your internet connection."
        is SocketTimeoutException ->
            return "Connection timed out (no reply from that address). Often the wrong PC IP: run ipconfig on the PC while the phone is connected and use that adapter’s IPv4. Confirm Node is running, the API listens on 0.0.0.0:3000, and Windows Firewall allows inbound TCP 3000."
        is ConnectException ->
            return "Can't connect to the server. With hotspot/USB tether, api_base_url must be the PC’s IPv4 from ipconfig (tether adapter). Check the IP, that the API is running, and Windows Firewall allows port 3000."
        is HttpException -> {
            val response = e.response()
            val raw = try {
                response?.errorBody()?.string()
            } catch (_: Exception) {
                null
            }
            if (!raw.isNullOrBlank()) {
                try {
                    val o = Gson().fromJson(raw, JsonObject::class.java)
                    if (o != null) {
                        o.get("message")?.asString?.trim()?.takeIf { it.isNotEmpty() }?.let {
                            return it.collapseDuplicateMessage()
                        }
                        if (o.get("database")?.asString == "down") {
                            return "PostgreSQL is down on the server PC. Start Postgres, set DATABASE_URL in backend/.env, run npx prisma migrate deploy, then restart the API."
                        }
                    }
                } catch (_: Exception) {
                }
                val trimmed = raw.trim()
                if (trimmed.startsWith("{")) {
                    // JSON we couldn't parse — avoid dumping raw
                } else if (trimmed.isNotEmpty() && !trimmed.startsWith("<")) {
                    return trimmed.take(280).collapseDuplicateMessage()
                }
            }
            val reason = response?.message()?.trim().orEmpty()
            val base = if (reason.isNotEmpty()) {
                "HTTP ${e.code()} $reason"
            } else {
                "HTTP ${e.code()}"
            }
            return if (e.code() == 503) {
                val detail =
                    "On the PC running the API: open GET /api/v1/health in a browser. If database is down, start PostgreSQL and fix DATABASE_URL in backend/.env, then npx prisma migrate deploy. Use Server settings → Test connection from this phone."
                if (raw.isNullOrBlank()) {
                    "Server unavailable (HTTP 503, no error details). $detail"
                } else {
                    "$base. $detail"
                }
            } else {
                "Request failed ($base)"
            }
        }
        is IOException ->
            return (e.message?.takeIf { it.isNotBlank() } ?: "Network error. Check connection and server URL.")
    }
    return (e.message ?: "Something went wrong").collapseDuplicateMessage()
}
