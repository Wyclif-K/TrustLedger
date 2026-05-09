package com.example.trustledger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.example.trustledger.ui.components.TlNotificationBellButton
import com.example.trustledger.ui.theme.BrandNavy
import com.example.trustledger.ui.components.TlGoldOutlineButton
import com.example.trustledger.ui.components.TlAccentCard
import com.example.trustledger.ui.components.TlAvatarLetter
import com.example.trustledger.ui.components.TlBlockchainTrustBadge
import com.example.trustledger.ui.components.TlPrimaryButton
import com.example.trustledger.ui.components.TlSectionHeader
import com.example.trustledger.ui.components.TlTopBarTitle
import com.example.trustledger.viewmodel.MainViewModel

private val FieldShape = RoundedCornerShape(14.dp)

/** Gap between Current / New(+meter) / Confirm(+match) blocks — uniform vertical rhythm */
private val PasswordSectionSpacing = 16.dp

private enum class PasswordStrength {
    NONE, WEAK, MEDIUM, STRONG,
}

private fun evaluatePasswordStrength(password: String): PasswordStrength {
    if (password.isEmpty()) return PasswordStrength.NONE
    val hasLower = password.any { it.isLowerCase() }
    val hasUpper = password.any { it.isUpperCase() }
    val hasDigit = password.any { it.isDigit() }
    val hasSymbol = password.any { !it.isLetterOrDigit() }
    val charsetScore = listOf(hasLower, hasUpper, hasDigit, hasSymbol).count { it }
    val len = password.length

    return when {
        len < 8 || charsetScore <= 1 -> PasswordStrength.WEAK
        charsetScore >= 4 && len >= 12 -> PasswordStrength.STRONG
        charsetScore == 4 && len >= 10 -> PasswordStrength.STRONG
        charsetScore >= 3 && len >= 11 -> PasswordStrength.STRONG
        len >= 8 && charsetScore >= 2 -> PasswordStrength.MEDIUM
        else -> PasswordStrength.WEAK
    }
}

@Composable
private fun PasswordStrengthIndicator(password: String) {
    val strength = evaluatePasswordStrength(password)
    if (strength == PasswordStrength.NONE) return

    val inactive = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            for (segment in 0 until 3) {
                val fillLevel = when (strength) {
                    PasswordStrength.WEAK -> 1
                    PasswordStrength.MEDIUM -> 2
                    PasswordStrength.STRONG -> 3
                    PasswordStrength.NONE -> 0
                }
                val color = when {
                    segment >= fillLevel -> inactive
                    strength == PasswordStrength.WEAK ->
                        MaterialTheme.colorScheme.error
                    strength == PasswordStrength.MEDIUM ->
                        MaterialTheme.colorScheme.tertiary
                    else ->
                        Color(0xFF2E7D32)
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(5.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(color),
                )
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = when (strength) {
                PasswordStrength.WEAK -> "Weak"
                PasswordStrength.MEDIUM -> "Medium"
                PasswordStrength.STRONG -> "Strong"
                PasswordStrength.NONE -> ""
            },
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = when (strength) {
                PasswordStrength.WEAK -> MaterialTheme.colorScheme.error
                PasswordStrength.MEDIUM -> MaterialTheme.colorScheme.tertiary
                PasswordStrength.STRONG -> Color(0xFF2E7D32)
                PasswordStrength.NONE -> MaterialTheme.colorScheme.onSurfaceVariant
            },
        )
    }
}

@Composable
private fun ConfirmPasswordMatchRow(
    confirmPassword: String,
    matches: Boolean,
) {
    if (confirmPassword.isEmpty()) return

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = if (matches) "✅" else "❌",
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(
            text = if (matches) {
                "Matches new password"
            } else {
                "Does not match new password"
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    vm: MainViewModel,
    onLogout: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenNotifications: () -> Unit,
) {
    val user = vm.user
    val initial = user?.fullName?.firstOrNull { !it.isWhitespace() }
        ?: user?.email?.firstOrNull { !it.isWhitespace() }
        ?: '?'

    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var showCurrent by remember { mutableStateOf(false) }
    var showNew by remember { mutableStateOf(false) }
    var showConfirm by remember { mutableStateOf(false) }

    val newOk = newPassword.length >= 8
    val matchOk = newPassword == confirmPassword && confirmPassword.isNotBlank()

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
                        title = "Profile",
                        subtitle = "Account & security",
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Spacer(modifier = Modifier.height(4.dp))

            TlAccentCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    TlAvatarLetter(letter = initial)
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(
                                Icons.Outlined.Person,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.padding(bottom = 2.dp),
                            )
                            Text(
                                text = user?.fullName.orEmpty().ifBlank { "Member" },
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.secondary,
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = user?.email.orEmpty(),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "ID ${user?.memberId ?: "—"}  ·  ${user?.role ?: "—"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            TlSectionHeader(
                title = "Security",
                icon = Icons.Outlined.Lock,
            )
            TlAccentCard {
                Text(
                    text = "Change password",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.secondary,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "New password must be at least 8 characters. All sessions are signed out after a successful change.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                )
                Spacer(modifier = Modifier.height(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(PasswordSectionSpacing)) {
                    OutlinedTextField(
                        value = currentPassword,
                        onValueChange = { currentPassword = it },
                        label = { Text("Current password") },
                        singleLine = true,
                        enabled = !vm.passwordChangeInProgress,
                        modifier = Modifier.fillMaxWidth(),
                        shape = FieldShape,
                        colors = fieldColors,
                        visualTransformation = if (showCurrent) {
                            VisualTransformation.None
                        } else {
                            PasswordVisualTransformation()
                        },
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Next,
                        ),
                        trailingIcon = {
                            IconButton(onClick = { showCurrent = !showCurrent }) {
                                Icon(
                                    imageVector = if (showCurrent) {
                                        Icons.Outlined.VisibilityOff
                                    } else {
                                        Icons.Outlined.Visibility
                                    },
                                    contentDescription = if (showCurrent) "Hide" else "Show",
                                )
                            }
                        },
                    )

                    Column(modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = newPassword,
                            onValueChange = { newPassword = it },
                            label = { Text("New password") },
                            singleLine = true,
                            enabled = !vm.passwordChangeInProgress,
                            modifier = Modifier.fillMaxWidth(),
                            shape = FieldShape,
                            colors = fieldColors,
                            isError = newPassword.isNotBlank() && !newOk,
                            supportingText = null,
                            visualTransformation = if (showNew) {
                                VisualTransformation.None
                            } else {
                                PasswordVisualTransformation()
                            },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Next,
                            ),
                            trailingIcon = {
                                IconButton(onClick = { showNew = !showNew }) {
                                    Icon(
                                        imageVector = if (showNew) {
                                            Icons.Outlined.VisibilityOff
                                        } else {
                                            Icons.Outlined.Visibility
                                        },
                                        contentDescription = if (showNew) "Hide" else "Show",
                                    )
                                }
                            },
                        )
                        PasswordStrengthIndicator(newPassword)
                        if (newPassword.isNotBlank() && !newOk) {
                            Text(
                                text = "Use at least 8 characters.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }

                    Column(modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = confirmPassword,
                            onValueChange = { confirmPassword = it },
                            label = { Text("Confirm new password") },
                            singleLine = true,
                            enabled = !vm.passwordChangeInProgress,
                            modifier = Modifier.fillMaxWidth(),
                            shape = FieldShape,
                            colors = fieldColors,
                            isError = confirmPassword.isNotBlank() && !matchOk,
                            supportingText = null,
                            visualTransformation = if (showConfirm) {
                                VisualTransformation.None
                            } else {
                                PasswordVisualTransformation()
                            },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done,
                            ),
                            trailingIcon = {
                                IconButton(onClick = { showConfirm = !showConfirm }) {
                                    Icon(
                                        imageVector = if (showConfirm) {
                                            Icons.Outlined.VisibilityOff
                                        } else {
                                            Icons.Outlined.Visibility
                                        },
                                        contentDescription = if (showConfirm) "Hide" else "Show",
                                    )
                                }
                            },
                        )
                        ConfirmPasswordMatchRow(
                            confirmPassword = confirmPassword,
                            matches = matchOk && newPassword.isNotBlank(),
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                vm.errorMessage?.takeIf { it.isNotBlank() }?.let { msg ->
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.9f),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            text = msg,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(12.dp),
                        )
                    }
                }
                TlPrimaryButton(
                    onClick = {
                        vm.clearError()
                        vm.changePassword(
                            currentPassword = currentPassword,
                            newPassword = newPassword,
                        )
                    },
                    enabled = !vm.passwordChangeInProgress &&
                        currentPassword.isNotBlank() &&
                        newOk &&
                        matchOk,
                    fullContrastWhileInactive = vm.passwordChangeInProgress,
                ) {
                    when {
                        vm.passwordChangeInProgress -> {
                            CircularProgressIndicator(
                                strokeWidth = 2.5.dp,
                                modifier = Modifier.size(22.dp),
                                color = BrandNavy,
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "Updating password…",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = BrandNavy,
                            )
                        }
                        else -> Text(
                            text = "Update password",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = BrandNavy,
                        )
                    }
                }
            }

            TlGoldOutlineButton(
                onClick = onLogout,
                enabled = !vm.passwordChangeInProgress,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(text = "Sign out")
            }

            Spacer(modifier = Modifier.height(16.dp))
            TlBlockchainTrustBadge()

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
