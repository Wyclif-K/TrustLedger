package com.example.trustledger.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.example.trustledger.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TlNotificationBellButton(
    unreadCount: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val label = if (unreadCount > 0) {
        stringResource(R.string.cd_unread_notifications)
    } else {
        stringResource(R.string.cd_notifications)
    }
    BadgedBox(
        badge = {
            if (unreadCount > 0) {
                Badge(
                    containerColor = MaterialTheme.colorScheme.error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ) {
                    val text = if (unreadCount > 99) "99+" else unreadCount.toString()
                    Text(text)
                }
            }
        },
        modifier = modifier,
    ) {
        IconButton(onClick = onClick) {
            Icon(
                imageVector = Icons.Outlined.Notifications,
                contentDescription = label,
            )
        }
    }
}
