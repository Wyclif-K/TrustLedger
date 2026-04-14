package com.example.trustledger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.trustledger.ui.components.ErrorBanner
import com.example.trustledger.ui.components.SkeletonBlock
import com.example.trustledger.ui.components.TlAccentCard
import com.example.trustledger.ui.components.TlCompactCard
import com.example.trustledger.ui.components.TlEmptyState
import com.example.trustledger.ui.components.TlPrimaryButton
import com.example.trustledger.ui.components.TlNotificationBellButton
import com.example.trustledger.ui.components.TlSectionHeader
import com.example.trustledger.ui.components.TlTopBarTitle
import com.example.trustledger.ui.components.UgxAmountField
import com.example.trustledger.viewmodel.MainViewModel

private val FieldShape = RoundedCornerShape(14.dp)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoansScreen(
    vm: MainViewModel,
    onOpenNotifications: () -> Unit,
) {
    val loans = vm.loans
    val loansError = vm.loansError
    val disbursedLoan = loans.firstOrNull { it.status == "DISBURSED" }

    var loanAmountDigits by remember { mutableStateOf("") }
    var loanTerm by remember { mutableStateOf("12") }
    var loanPurpose by remember { mutableStateOf("") }
    var repaymentAmountDigits by remember { mutableStateOf("") }

    val pullState = rememberPullToRefreshState()
    val termInt = loanTerm.toIntOrNull()
    val amountLong = loanAmountDigits.toLongOrNull()
    val repaymentLong = repaymentAmountDigits.toLongOrNull()
    val amountError =
        amountLong != null && (amountLong < 100_000L || amountLong > 50_000_000L)
    val termError = termInt != null && (termInt < 1 || termInt > 24)
    val purposeTrimmed = loanPurpose.trim()
    val purposeError = purposeTrimmed.isNotEmpty() && purposeTrimmed.length < 5

    val formBusy = vm.isLoading || vm.loanMutationInProgress
    val applyFormValid =
        loanAmountDigits.isNotBlank() &&
            !amountError &&
            purposeTrimmed.length >= 5 &&
            termInt != null &&
            !termError
    /** While submitting, keep the button enabled so the spinner stays visible. */
    val applyButtonEnabled =
        vm.loanMutationInProgress || (applyFormValid && !vm.isLoading)

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = MaterialTheme.colorScheme.primary,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.65f),
        focusedLabelColor = MaterialTheme.colorScheme.primary,
    )

    LaunchedEffect(Unit) {
        vm.refreshBalanceQuiet()
    }

    val savingsBal = vm.balance?.balance
    val maxBorrowApprox = (savingsBal ?: 0.0) * 3.0

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    TlTopBarTitle(
                        title = "Loans",
                        subtitle = "Apply & repay",
                    )
                },
                actions = {
                    TlNotificationBellButton(
                        unreadCount = vm.unreadNotificationCount,
                        onClick = onOpenNotifications,
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            )
        },
    ) { padding ->
        PullToRefreshBox(
            state = pullState,
            isRefreshing = vm.isRefreshing,
            onRefresh = { vm.refreshLoans(); vm.refreshBalance() },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (loansError != null) {
                    ErrorBanner(
                        message = loansError,
                        onRetry = { vm.refreshLoans() },
                        onDismiss = { vm.clearLoansError() },
                    )
                }
                vm.loanMutationError?.let { err ->
                    ErrorBanner(
                        message = err,
                        onRetry = null,
                        onDismiss = { vm.clearLoanMutationError() },
                    )
                }

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = when {
                            savingsBal == null ->
                                "Loan size is capped at 3× your on-chain savings. Pull down to refresh your balance."
                            savingsBal <= 0.0 ->
                                "Your savings on the ledger are ${vm.formatUgX(savingsBal)}. Deposit on Home first; " +
                                    "then you can apply up to about ${vm.formatUgX(maxBorrowApprox)} (3× savings)."
                            else ->
                                "Savings on ledger: ${vm.formatUgX(savingsBal)}. " +
                                    "You can apply for up to about ${vm.formatUgX(maxBorrowApprox)} (3× savings), " +
                                    "subject to other rules."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(14.dp),
                    )
                }

                TlSectionHeader(
                    title = "Your loans",
                    icon = Icons.Outlined.AccountBalance,
                )
                if (vm.isLoading && loans.isEmpty() && loansError == null) {
                    SkeletonBlock(height = 140.dp)
                } else if (loans.isEmpty()) {
                    TlEmptyState(
                        title = "No loans yet",
                        subtitle = "Submit an application below. Approved and disbursed loans appear here with status and balances.",
                    )
                } else {
                    loans.forEach { loan ->
                        TlCompactCard(accentLeading = true) {
                            RowMeta(
                                label = "Status",
                                value = loan.status ?: "—",
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            RowMeta(
                                label = "Principal",
                                value = vm.formatUgX(loan.amount),
                            )
                            if (loan.outstandingBalance != null) {
                                Spacer(modifier = Modifier.height(4.dp))
                                RowMeta(
                                    label = "Outstanding",
                                    value = vm.formatUgX(loan.outstandingBalance),
                                )
                            }
                            loan.loanId?.takeIf { it.isNotBlank() }?.let { id ->
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "ID …${id.takeLast(8)}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                )
                Spacer(modifier = Modifier.height(4.dp))

                TlSectionHeader(
                    title = "Apply for a loan",
                    icon = Icons.Outlined.EditNote,
                )
                TlAccentCard {
                    UgxAmountField(
                        digits = loanAmountDigits,
                        onDigitsChange = {
                            loanAmountDigits = it
                            vm.clearLoanMutationError()
                        },
                        label = "Amount",
                        enabled = !formBusy,
                        supportingText = "Min UGX 100,000 · Max UGX 50,000,000",
                        isError = loanAmountDigits.isNotBlank() && amountError,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = loanTerm,
                        onValueChange = {
                            loanTerm = it
                            vm.clearLoanMutationError()
                        },
                        label = { Text("Term (months)") },
                        singleLine = true,
                        enabled = !formBusy,
                        modifier = Modifier.fillMaxWidth(),
                        shape = FieldShape,
                        colors = fieldColors,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        supportingText = { Text("1–24 months") },
                        isError = termError,
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = loanPurpose,
                        onValueChange = {
                            loanPurpose = it
                            vm.clearLoanMutationError()
                        },
                        label = { Text("Purpose") },
                        singleLine = true,
                        enabled = !formBusy,
                        modifier = Modifier.fillMaxWidth(),
                        shape = FieldShape,
                        colors = fieldColors,
                        supportingText = { Text("At least 5 characters") },
                        isError = purposeError,
                    )
                    if (!applyFormValid && (loanAmountDigits.isNotBlank() || loanPurpose.isNotBlank()) && !vm.loanMutationInProgress) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = when {
                                loanAmountDigits.isNotBlank() && amountError ->
                                    "Amount must be between UGX 100,000 and 50,000,000."
                                purposeTrimmed.isNotEmpty() && purposeTrimmed.length < 5 ->
                                    "Purpose needs at least 5 characters."
                                termError -> "Term must be between 1 and 24 months."
                                else -> "Enter amount (min 100,000), term, and purpose to enable Submit."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    TlPrimaryButton(
                        onClick = {
                            if (vm.loanMutationInProgress) return@TlPrimaryButton
                            val amount = loanAmountDigits.toLongOrNull()?.toDouble()
                            val term = loanTerm.toIntOrNull()
                            val purpose = loanPurpose.trim()
                            if (amount != null && term != null && purpose.length >= 5) {
                                vm.applyLoan(amount = amount, termMonths = term, purpose = purpose)
                            }
                        },
                        enabled = applyButtonEnabled,
                    ) {
                        if (vm.loanMutationInProgress) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(22.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                )
                                Text("Submitting…", style = MaterialTheme.typography.titleSmall)
                            }
                        } else {
                            Text("Submit application", style = MaterialTheme.typography.titleSmall)
                        }
                    }
                }

                TlSectionHeader(
                    title = "Repayment",
                    icon = Icons.Outlined.Payments,
                )
                TlAccentCard {
                    if (disbursedLoan == null) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                text = "Repayment unlocks when you have a disbursed loan.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(14.dp),
                            )
                        }
                    } else {
                        Text(
                            text = "Disbursed · outstanding ${vm.formatUgX(disbursedLoan.outstandingBalance)}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.secondary,
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    UgxAmountField(
                        digits = repaymentAmountDigits,
                        onDigitsChange = {
                            repaymentAmountDigits = it
                            vm.clearLoanMutationError()
                        },
                        label = "Amount",
                        enabled = !formBusy && disbursedLoan != null,
                        supportingText = if (disbursedLoan == null) null else "Pay toward your active loan",
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    TlPrimaryButton(
                        onClick = {
                            if (vm.loanMutationInProgress) return@TlPrimaryButton
                            val amount = repaymentAmountDigits.toLongOrNull()?.toDouble()
                            val loanId = disbursedLoan?.loanId
                            if (amount != null && amount > 0 && !loanId.isNullOrBlank()) {
                                vm.repayLoan(loanId = loanId, amount = amount)
                                repaymentAmountDigits = ""
                            }
                        },
                        enabled = vm.loanMutationInProgress ||
                            (!vm.isLoading &&
                                !disbursedLoan?.loanId.isNullOrBlank() &&
                                repaymentAmountDigits.isNotBlank() &&
                                (repaymentLong ?: 0L) > 0L),
                    ) {
                        if (vm.loanMutationInProgress) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(22.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                )
                                Text("Submitting…", style = MaterialTheme.typography.titleSmall)
                            }
                        } else {
                            Text("Submit repayment", style = MaterialTheme.typography.titleSmall)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun RowMeta(label: String, value: String) {
    Column {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
        )
    }
}
