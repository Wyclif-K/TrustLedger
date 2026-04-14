package com.example.trustledger.ui.components

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import java.text.NumberFormat
import java.util.Locale

@Composable
fun UgxAmountField(
    digits: String,
    onDigitsChange: (String) -> Unit,
    label: String,
    enabled: Boolean,
    supportingText: String? = null,
    isError: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val cleaned = digits.filter { it.isDigit() }.take(12)
    val display = cleaned.toLongOrNull()?.let { formatUgx(it) }.orEmpty()

    OutlinedTextField(
        value = display,
        onValueChange = { input ->
            val next = input.filter { it.isDigit() }.trimStart('0').take(12)
            onDigitsChange(next)
        },
        label = { Text(label) },
        singleLine = true,
        enabled = enabled,
        modifier = modifier,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        prefix = { Text("UGX ") },
        placeholder = { Text("0") },
        supportingText = {
            if (!supportingText.isNullOrBlank()) Text(supportingText)
        },
        isError = isError,
    )
}

private fun formatUgx(value: Long): String {
    val locale = Locale("en", "UG")
    return NumberFormat.getNumberInstance(locale).format(value)
}

