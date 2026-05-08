package com.example.trustledger.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys

/**
 * Encrypted storage for optional fingerprint-based sign-in.
 * Only populated when the user opts in on the login screen after a successful password login.
 */
object SecureCredentialStore {

    private const val PREFS_NAME = "trustledger_biometric_login"

    private const val KEY_EMAIL = "login_email"
    private const val KEY_PASSWORD = "login_password"

    private fun prefs(context: Context): SharedPreferences {
        val alias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        return EncryptedSharedPreferences.create(
            PREFS_NAME,
            alias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun hasCredentials(context: Context): Boolean =
        !prefs(context).getString(KEY_EMAIL, null).isNullOrBlank()

    fun save(context: Context, email: String, password: String) {
        prefs(context).edit()
            .putString(KEY_EMAIL, email.trim())
            .putString(KEY_PASSWORD, password)
            .apply()
    }

    fun read(context: Context): Pair<String, String>? {
        val p = prefs(context)
        val email = p.getString(KEY_EMAIL, null)?.trim().orEmpty()
        val password = p.getString(KEY_PASSWORD, null).orEmpty()
        if (email.isEmpty() || password.isEmpty()) return null
        return email to password
    }

    fun clear(context: Context) {
        prefs(context).edit().clear().apply()
    }
}
