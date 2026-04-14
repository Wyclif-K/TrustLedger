package com.example.trustledger.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.trustledger.R
import com.example.trustledger.data.NotificationDto
import com.example.trustledger.ui.components.ErrorBanner
import com.example.trustledger.ui.components.SkeletonBlock
import com.example.trustledger.ui.components.TlCompactCard
import com.example.trustledger.ui.components.TlEmptyState
import com.example.trustledger.ui.components.TlTopBarTitle
import com.example.trustledger.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    vm: MainViewModel,
    onBack: () -> Unit,
) {
    val list = vm.notifications
    val err = vm.notificationsError
    val pullState = rememberPullToRefreshState()

    LaunchedEffect(Unit) {
        vm.loadNotifications()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    TlTopBarTitle(
                        title = stringResource(R.string.notifications_title),
                        subtitle = stringResource(R.string.notifications_subtitle),
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
                actions = {
                    val hasUnread = list.any { !it.isRead }
                    if (hasUnread) {
                        TextButton(
                            onClick = { vm.markAllNotificationsRead() },
                            enabled = !vm.notificationsBusy,
                        ) {
                            Text(stringResource(R.string.notifications_mark_all_read))
                        }
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
            isRefreshing = vm.isRefreshing || vm.notificationsBusy,
            onRefresh = {
                vm.refreshDashboard()
                vm.loadNotifications()
            },
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
                            onRetry = { vm.loadNotifications() },
                            onDismiss = { vm.clearNotificationsError() },
                        )
                    }
                }

                when {
                    vm.notificationsBusy && list.isEmpty() && err == null -> {
                        item {
                            SkeletonBlock(height = 88.dp)
                            Spacer(Modifier.height(10.dp))
                            SkeletonBlock(height = 88.dp)
                        }
                    }
                    list.isEmpty() && err == null -> {
                        item {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 8.dp),
                            ) {
                                NotificationsSectionHeader()
                                TlEmptyState(
                                    title = stringResource(R.string.notifications_empty),
                                    subtitle = "Loan approvals, repayments, and savings updates will appear here.",
                                    modifier = Modifier.padding(vertical = 24.dp),
                                )
                            }
                        }
                    }
                    else -> {
                        items(list, key = { it.id }) { n ->
                            NotificationRowCard(
                                n = n,
                                onOpen = {
                                    if (!n.isRead) vm.markNotificationRead(n.id)
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationsSectionHeader() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(bottom = 12.dp),
    ) {
        Icon(
            Icons.Outlined.Notifications,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = "Updates",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.secondary,
        )
    }
}

@Composable
private fun NotificationRowCard(
    n: NotificationDto,
    onOpen: () -> Unit,
) {
    val title = n.title?.takeIf { it.isNotBlank() } ?: n.type?.replace('_', ' ') ?: "Update"
    val body = n.message?.takeIf { it.isNotBlank() }.orEmpty()
    val meta = listOfNotNull(n.sentAt, n.channel).filter { it.isNotBlank() }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen),
    ) {
        TlCompactCard(
            accentLeading = !n.isRead,
        ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = if (n.isRead) FontWeight.Medium else FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.secondary,
        )
        if (body.isNotBlank()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
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
}
