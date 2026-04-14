package com.example.trustledger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.trustledger.data.TransactionDto
import com.example.trustledger.ui.components.ErrorBanner
import com.example.trustledger.ui.components.SkeletonBlock
import com.example.trustledger.ui.components.TlNotificationBellButton
import com.example.trustledger.ui.components.TlCompactCard
import com.example.trustledger.ui.components.TlEmptyState
import com.example.trustledger.ui.components.TlTopBarTitle
import com.example.trustledger.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionsScreen(
    vm: MainViewModel,
    onOpenNotifications: () -> Unit,
) {
    val txs = vm.transactions
    val err = vm.transactionsError
    val pullState = rememberPullToRefreshState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    TlTopBarTitle(
                        title = "Activity",
                        subtitle = "Transaction history",
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
            onRefresh = { vm.refreshTransactions() },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (err != null) {
                    item {
                        ErrorBanner(
                            message = err,
                            onRetry = { vm.refreshTransactions() },
                            onDismiss = { vm.clearTransactionsError() },
                        )
                    }
                }

                when {
                    vm.isLoading && txs.isEmpty() && err == null -> {
                        item {
                            SkeletonBlock(height = 72.dp)
                            Spacer(Modifier.height(10.dp))
                            SkeletonBlock(height = 72.dp)
                            Spacer(Modifier.height(10.dp))
                            SkeletonBlock(height = 72.dp)
                        }
                    }
                    txs.isEmpty() && err == null -> {
                        item {
                            Column(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.padding(bottom = 12.dp),
                                ) {
                                    Icon(
                                        Icons.Outlined.ReceiptLong,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                    )
                                    Text(
                                        text = "Your activity",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.secondary,
                                    )
                                }
                                TlEmptyState(
                                    title = "No transactions",
                                    subtitle = "When you save or borrow, every movement will be listed here with type, amount, and reference.",
                                    modifier = Modifier.padding(vertical = 24.dp),
                                )
                            }
                        }
                    }
                    else -> {
                        items(txs, key = { it.txId ?: "${it.reference}-${it.timestamp}" }) { tx ->
                            TransactionRowCard(vm = vm, tx = tx)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TransactionRowCard(
    vm: MainViewModel,
    tx: TransactionDto,
) {
    val type = tx.type ?: "Transaction"
    TlCompactCard(accentLeading = true) {
        Text(
            text = type.replace('_', ' '),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.secondary,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = vm.formatUgX(tx.amount),
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium,
        )
        val meta = listOfNotNull(tx.reference, tx.timestamp).filter { it.isNotBlank() }
        if (meta.isNotEmpty()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = meta.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
