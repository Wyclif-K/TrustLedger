package com.example.trustledger.utils

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.net.toUri

/**
 * Opens the phone dialer with a USSD code (user completes PIN on the network).
 * Uses [Intent.ACTION_DIAL] so [android.permission.CALL_PHONE] is not required.
 */
object UssdDialHelper {

    fun openDialer(context: Context, ussdCode: String): Boolean {
        val trimmed = ussdCode.trim()
        if (trimmed.isEmpty()) return false
        val telUri = "tel:${encodeUssdForTelUri(trimmed)}".toUri()
        val intent = Intent(Intent.ACTION_DIAL, telUri).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        return runCatching {
            context.startActivity(intent)
            true
        }.getOrDefault(false)
    }

    /** Encode `#` and `*` for tel: URIs; leave digits and leading `+` as-is. */
    private fun encodeUssdForTelUri(code: String): String {
        val sb = StringBuilder()
        for (ch in code) {
            when (ch) {
                '#' -> sb.append("%23")
                '*' -> sb.append("%2A")
                else -> sb.append(ch)
            }
        }
        return sb.toString()
    }
}
