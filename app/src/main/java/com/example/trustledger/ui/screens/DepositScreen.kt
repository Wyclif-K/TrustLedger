package com.example.trustledger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.Savings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.trustledger.R
import com.example.trustledger.ui.components.ErrorBanner
import com.example.trustledger.ui.components.TlAccentCard
import com.example.trustledger.ui.components.TlPrimaryButton
import com.example.trustledger.ui.components.TlSectionHeader
import com.example.trustledger.ui.components.TlTopBarTitle
import com.example.trustledger.ui.components.UgxAmountField
import com.example.trustledger.utils.UssdDialHelper
import com.example.trustledger.viewmodel.MainViewModel

private val FieldShape = RoundedCornerShape(14.dp)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DepositScreen(
    vm: MainViewModel,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    var amountDigits by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }

    val phone = vm.registeredPhoneForDeposit()
    val ussdCode = stringResource(R.string.deposit_ussd_shortcode)
    val amountLong = amountDigits.toLongOrNull()
    val amountError = amountLong != null && (amountLong < 1_000L || amountLong > 50_000_000L)
    val canSubmit = phone != null && amountDigits.isNotBlank() && !amountError && !vm.depositBusy

    LaunchedEffect(Unit) {
        vm.ensureMemberPhoneLoaded()
    }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = MaterialTheme.colorScheme.primary,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.65f),
        focusedLabelColor = MaterialTheme.colorScheme.primary,
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    TlTopBarTitle(
                        title = stringResource(R.string.deposit_title),
                        subtitle = stringResource(R.string.deposit_subtitle),
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Spacer(modifier = Modifier.height(4.dp))

            vm.depositError?.let { err ->
                ErrorBanner(
                    message = err,
                    onRetry = { vm.clearDepositError() },
                    onDismiss = { vm.clearDepositError() },
                )
            }

            localError?.let { err ->
                ErrorBanner(
                    message = err,
                    onRetry = { localError = null },
                    onDismiss = { localError = null },
                )
            }

            TlSectionHeader(
                title = stringResource(R.string.deposit_phone_section),
                icon = Icons.Outlined.PhoneAndroid,
            )
            TlAccentCard {
                OutlinedTextField(
                    value = phone ?: stringResource(R.string.deposit_phone_loading),
                    onValueChange = {},
                    readOnly = true,
                    enabled = false,
                    label = { Text(stringResource(R.string.deposit_phone_label)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = FieldShape,
                    colors = fieldColors,
                    supportingText = {
                        Text(stringResource(R.string.deposit_phone_hint))
                    },
                )
            }

            TlSectionHeader(
                title = stringResource(R.string.deposit_amount_section),
                icon = Icons.Outlined.Savings,
            )
            TlAccentCard {
                UgxAmountField(
                    digits = amountDigits,
                    onDigitsChange = { amountDigits = it },
                    label = stringResource(R.string.deposit_amount_label),
                    enabled = !vm.depositBusy,
                    isError = amountError,
                    supportingText = stringResource(R.string.deposit_amount_hint),
                    modifier = Modifier.fillMaxWidth(),
                )
                if (amountError) {
                    Text(
                        text = stringResource(R.string.deposit_amount_error),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = stringResource(R.string.deposit_ussd_steps, ussdCode),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (vm.depositUssdPending) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.deposit_waiting_confirmation),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }

            TlPrimaryButton(
                onClick = {
                    localError = null
                    val validation = vm.validateDepositAmount(amountLong)
                    if (validation != null) {
                        localError = validation
                        return@TlPrimaryButton
                    }
                    if (phone == null) {
                        localError = context.getString(R.string.deposit_phone_missing)
                        return@TlPrimaryButton
                    }
                    val opened = UssdDialHelper.openDialer(context, ussdCode)
                    if (!opened) {
                        localError = context.getString(R.string.deposit_dial_failed)
                        return@TlPrimaryButton
                    }
                    vm.onUssdDepositDialStarted(amountLong!!)
                },
                enabled = canSubmit,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = stringResource(R.string.deposit_continue_button, ussdCode),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
