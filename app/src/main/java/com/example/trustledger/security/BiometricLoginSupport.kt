package com.example.trustledger.security

import android.content.Context
import androidx.biometric.BiometricManager

object BiometricLoginSupport {

    fun deviceSupportsStrongBiometric(context: Context): Boolean {
        val bm = BiometricManager.from(context)
        return bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    fun canOfferFingerprintButton(context: Context): Boolean =
        deviceSupportsStrongBiometric(context) && SecureCredentialStore.hasCredentials(context)
}
