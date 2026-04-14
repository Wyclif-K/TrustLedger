package com.example.trustledger.utils

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/**
 * Returns a normalized base URL with trailing slash, or null if invalid.
 * Accepts host-only values by prefixing http://
 */
fun normalizeTrustLedgerApiBaseUrl(input: String): String? {
    val t = input.trim()
    if (t.isEmpty()) return null
    var candidate = t
    if (!candidate.contains("://")) {
        candidate = "http://$candidate"
    }
    if (!candidate.endsWith("/")) {
        candidate += "/"
    }
    val parsed = candidate.toHttpUrlOrNull() ?: return null
    if (parsed.scheme != "http" && parsed.scheme != "https") return null
    return parsed.toString()
}
