package com.example.trustledger.utils

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/**
 * Returns a normalized base URL with trailing slash, or null if invalid.
 *
 * - Host-only input → `https://host/` (HTTPS first; Railway requires TLS).
 * - **`/api/v1` is required** for Retrofit (`auth/login`, `health` are relative to this base). If missing,
 *   it is appended automatically so `https://xxx.up.railway.app` becomes `https://xxx.up.railway.app/api/v1/`.
 * - **`*.up.railway.app`**: `http://` is upgraded to `https://` (plain HTTP often returns redirects/HTML, Gson then fails).
 * - **Typo `.../api/vl/...`** (letter **l** instead of digit **1**) is rewritten to **`v1`** so routes resolve correctly.
 */
fun normalizeTrustLedgerApiBaseUrl(input: String): String? {
    val t = input.trim()
    if (t.isEmpty()) return null
    var candidate = t
    if (!candidate.contains("://")) {
        val hostGuess = candidate.substringBefore("/").substringBefore(":").trim()
        val railway = hostGuess.endsWith(".up.railway.app", ignoreCase = true)
        candidate = (if (railway) "https://" else "http://") + candidate
    }
    if (!candidate.endsWith("/")) {
        candidate += "/"
    }
    var parsed = candidate.toHttpUrlOrNull() ?: return null
    if (parsed.scheme != "http" && parsed.scheme != "https") return null

    val host = parsed.host
    if (host.endsWith(".up.railway.app", ignoreCase = true) && parsed.scheme == "http") {
        parsed = parsed.newBuilder().scheme("https").build()
    }

    run {
        val pathSegs = parsed.pathSegments.filter { it.isNotEmpty() }.toMutableList()
        if (pathSegs.size >= 2 &&
            pathSegs[pathSegs.size - 2].equals("api", ignoreCase = true) &&
            pathSegs[pathSegs.size - 1].equals("vl", ignoreCase = true)
        ) {
            pathSegs[pathSegs.size - 1] = "v1"
            val nb = parsed.newBuilder().encodedPath("/")
            pathSegs.forEach { nb.addPathSegment(it) }
            parsed = nb.build()
        }
    }

    val segs = parsed.pathSegments.filter { it.isNotEmpty() }
    val hasApiV1 =
        segs.size >= 2 &&
            segs[segs.size - 2].equals("api", ignoreCase = true) &&
            segs.last().equals("v1", ignoreCase = true)

    val withPath = if (hasApiV1) {
        parsed
    } else {
        parsed.newBuilder()
            .encodedPath("/")
            .addPathSegment("api")
            .addPathSegment("v1")
            .build()
    }

    val withTrailingSlash = withPath.toString().trimEnd('/') + "/"
    return withTrailingSlash.toHttpUrlOrNull()?.toString()
}
