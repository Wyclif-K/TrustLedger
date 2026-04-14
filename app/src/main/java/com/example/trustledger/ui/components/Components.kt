package com.example.trustledger.ui.components

import java.text.NumberFormat
import java.util.Locale

fun formatUgxLegacy(amount: Double?): String {
    if (amount == null) return "UGX —"
    return "UGX ${NumberFormat.getNumberInstance(Locale("en", "UG")).format(amount)}"
}
