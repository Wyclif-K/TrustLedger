package com.example.trustledger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.trustledger.ui.components.ErrorBanner
import com.example.trustledger.ui.components.SkeletonBlock
import com.example.trustledger.ui.components.TlAccentCard
import com.example.trustledger.ui.components.TlBalanceHero
import com.example.trustledger.ui.components.TlCompactCard
import com.example.trustledger.ui.components.TlEmptyState
import com.example.trustledger.ui.components.TlNotificationBellButton
import com.example.trustledger.ui.components.TlSectionHeader
import com.example.trustledger.ui.components.TlTopBarTitle
import com.example.trustledger.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    vm: MainViewModel,
    onOpenSettings: () -> Unit,
    onOpenNotifications: () -> Unit,
) {
    val user = vm.user
    val balance = vm.balance
    val balanceError = vm.balanceError
    val loansError = vm.loansError
    val transactionsError = vm.transactionsError
    val fullName = user?.fullName.orEmpty()
    val memberId = user?.memberId ?: "—"
    val role = user?.role ?: "—"
    val loans = vm.loans
    val transactions = vm.transactions
    val statusLoan = loans.firstOrNull {
        it.status == "DISBURSED" || it.status == "APPROVED" || it.status == "PENDING"
    }

    val pullState = rememberPullToRefreshState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    TlTopBarTitle(
                        title = "TrustLedger",
                        subtitle = "Savings & loans",
                    )
                },
                actions = {
                    TlNotificationBellButton(
                        unreadCount = vm.unreadNotificationCount,
                        onClick = onOpenNotifications,
                    )
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Outlined.Settings, contentDescription = "Settings")
                    }
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
            onRefresh = { vm.refreshDashboard() },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                vm.errorMessage?.takeIf { it.isNotBlank() }?.let { err ->
                    ErrorBanner(
                        message = err,
                        onRetry = { vm.refreshDashboard() },
                        onDismiss = { vm.clearError() },
                    )
                }

                Text(
                    text = if (fullName.isNotBlank()) "Welcome back, $fullName" else "Welcome back",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.secondary,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Member $memberId  ·  $role",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(16.dp))

                if (balanceError != null) {
                    ErrorBanner(
                        message = "Balance: $balanceError",
                        onRetry = { vm.refreshBalance() },
                        onDismiss = { vm.clearBalanceError() },
                    )
                }

                if (vm.isLoading && balance == null && balanceError == null) {
                    SkeletonBlock(height = 120.dp)
                } else {
                    TlBalanceHero(
                        label = "Savings balance",
                        amountText = vm.formatUgX(balance?.balance),
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))
                if (balance?.totalDeposited != null || balance?.totalWithdrawn != null) {
                    Text(
                        text = "Deposited ${vm.formatUgX(balance?.totalDeposited)}  ·  Withdrawn ${vm.formatUgX(balance?.totalWithdrawn)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))

                if (loansError != null) {
                    ErrorBanner(
                        message = "Loans: $loansError",
                        onRetry = { vm.refreshLoans() },
                        onDismiss = { vm.clearLoansError() },
                    )
                }

                TlSectionHeader(
                    title = "Loan overview",
                    icon = Icons.Outlined.AccountBalanceWallet,
                )
                Spacer(modifier = Modifier.height(8.dp))
                if (vm.isLoading && loans.isEmpty() && loansError == null) {
                    SkeletonBlock(height = 100.dp)
                } else {
                    TlAccentCard {
                        if (statusLoan == null) {
                            Text(
                                text = "No active application",
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.secondary,
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Apply from the Loans tab when you need credit.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        } else {
                            Text(
                                text = "Status: ${statusLoan.status ?: "—"}",
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.secondary,
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Outstanding ${vm.formatUgX(statusLoan.outstandingBalance)}",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Next due: ${statusLoan.nextDueDate ?: "—"}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                if (transactionsError != null) {
                    ErrorBanner(
                        message = "Transactions: $transactionsError",
                        onRetry = { vm.refreshTransactions() },
                        onDismiss = { vm.clearTransactionsError() },
                    )
                }

                TlSectionHeader(
                    title = "Recent activity",
                    icon = Icons.Outlined.ReceiptLong,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (transactions.isEmpty()) {
                        TlEmptyState(
                            title = "No transactions yet",
                            subtitle = "Deposits, withdrawals, and loan movements will show here and on the Activity tab.",
                        )
                    } else {
                        transactions.take(5).forEach { tx ->
                            TlCompactCard(accentLeading = true) {
                                Text(
                                    text = "${tx.type ?: "TX"}  ·  ${vm.formatUgX(tx.amount)}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium,
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = listOfNotNull(tx.reference, tx.timestamp).joinToString(" · "),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Text(
                            text = "Open the Activity tab for the full history.",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(start = 4.dp, top = 4.dp),
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}
