package com.example.trustledger.ui.screens

import android.util.Patterns
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Http
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.SettingsEthernet
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.trustledger.R
import com.example.trustledger.ui.theme.BrandGold
import com.example.trustledger.ui.theme.BrandGoldBright
import com.example.trustledger.ui.theme.BrandNavy

private val FieldShape = RoundedCornerShape(12.dp)
private val CardShape = RoundedCornerShape(24.dp)

private fun CharSequence.isValidEmail(): Boolean =
    isNotBlank() && Patterns.EMAIL_ADDRESS.matcher(trim()).matches()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onLogin: (email: String, password: String, persistForBiometric: Boolean) -> Unit,
    isLoading: Boolean,
    errorMessage: String?,
    apiBaseUrlDisplay: String,
    connectionTestRunning: Boolean,
    connectionTestResult: String?,
    onTestConnection: () -> Unit,
    onClearConnectionTestResult: () -> Unit,
    onOpenSettings: () -> Unit = {},
    biometricLoginAvailable: Boolean,
    canOfferBiometricOptIn: Boolean,
    onBiometricLoginClick: () -> Unit,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    var saveForBiometric by rememberSaveable { mutableStateOf(false) }
    var emailError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var showForgotDialog by rememberSaveable { mutableStateOf(false) }
    var showServerSheet by rememberSaveable { mutableStateOf(false) }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val context = LocalContext.current

    val hostBadForPhone =
        apiBaseUrlDisplay.contains("127.0.0.1", ignoreCase = true) ||
            apiBaseUrlDisplay.contains("localhost", ignoreCase = true)

    val usesHttps = remember(apiBaseUrlDisplay) {
        apiBaseUrlDisplay.trim().startsWith("https://", ignoreCase = true)
    }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = MaterialTheme.colorScheme.primary,
        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.85f),
        focusedLabelColor = BrandNavy,
        unfocusedLabelColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.78f),
        focusedLeadingIconColor = MaterialTheme.colorScheme.primary,
        unfocusedLeadingIconColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f),
        errorBorderColor = MaterialTheme.colorScheme.error,
        errorLabelColor = MaterialTheme.colorScheme.error,
        errorLeadingIconColor = MaterialTheme.colorScheme.error,
    )

    fun validateForm(): Boolean {
        var ok = true
        if (email.isBlank()) {
            emailError = null
        } else if (!email.isValidEmail()) {
            emailError = context.getString(R.string.login_email_error_invalid)
            ok = false
        } else {
            emailError = null
        }
        if (password.isBlank()) {
            passwordError = context.getString(R.string.login_password_error_required)
            ok = false
        } else {
            passwordError = null
        }
        return ok
    }

    val canAttemptSubmit =
        !isLoading && email.isNotBlank() && password.isNotBlank()

    if (showForgotDialog) {
        AlertDialog(
            onDismissRequest = { showForgotDialog = false },
            confirmButton = {
                TextButton(onClick = { showForgotDialog = false }) {
                    Text(stringResource(R.string.login_forgot_dialog_ok))
                }
            },
            title = { Text(stringResource(R.string.login_forgot_dialog_title)) },
            text = { Text(stringResource(R.string.login_forgot_dialog_body)) },
        )
    }

    if (showServerSheet) {
        ModalBottomSheet(
            onDismissRequest = { showServerSheet = false },
            sheetState = sheetState,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 28.dp)
                    .navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    text = stringResource(R.string.login_server_sheet_title),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                LoginApiServerCard(
                    apiBaseUrlDisplay = apiBaseUrlDisplay,
                    hostBadForPhone = hostBadForPhone,
                    connectionTestRunning = connectionTestRunning,
                    connectionTestResult = connectionTestResult,
                    isLoading = isLoading,
                    onTestConnection = onTestConnection,
                    onClearConnectionTestResult = onClearConnectionTestResult,
                    onOpenSettings = {
                        showServerSheet = false
                        onOpenSettings()
                    },
                )
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        BrandGold.copy(alpha = 0.18f),
                        BrandNavy.copy(alpha = 0.07f),
                        MaterialTheme.colorScheme.surface,
                        MaterialTheme.colorScheme.surface,
                    ),
                ),
            ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(4.dp))

            Box(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(end = 40.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(
                                        MaterialTheme.colorScheme.primary,
                                        MaterialTheme.colorScheme.tertiary,
                                    ),
                                ),
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "TL",
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "TrustLedger",
                            style = MaterialTheme.typography.headlineMedium,
                            color = MaterialTheme.colorScheme.secondary,
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .width(40.dp)
                                .height(3.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(MaterialTheme.colorScheme.primary),
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Savings, loans, and repayments in one place.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f),
                        )
                    }
                }
                IconButton(
                    onClick = { showServerSheet = true },
                    enabled = !isLoading,
                    modifier = Modifier.align(Alignment.TopEnd),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Settings,
                        contentDescription = stringResource(R.string.cd_open_server_sheet),
                        tint = MaterialTheme.colorScheme.secondary,
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = CardShape,
                elevation = CardDefaults.cardElevation(
                    defaultElevation = 4.dp,
                    pressedElevation = 4.dp,
                ),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .background(
                                Brush.horizontalGradient(
                                    listOf(
                                        MaterialTheme.colorScheme.primary,
                                        MaterialTheme.colorScheme.tertiary,
                                    ),
                                ),
                            ),
                    )
                    Column(
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = stringResource(R.string.login_welcome_title),
                                style = MaterialTheme.typography.titleLarge,
                                color = MaterialTheme.colorScheme.secondary,
                            )
                            Text(
                                text = stringResource(R.string.login_welcome_body),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.78f),
                            )
                        }
                        Text(
                            text = "Sign in",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        HorizontalDivider(
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                        )
                        OutlinedTextField(
                            value = email,
                            onValueChange = {
                                email = it
                                emailError = null
                            },
                            label = { Text("Email") },
                            singleLine = true,
                            enabled = !isLoading,
                            isError = emailError != null,
                            supportingText = {
                                emailError?.let { err ->
                                    Text(err, color = MaterialTheme.colorScheme.error)
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = FieldShape,
                            colors = fieldColors,
                            leadingIcon = {
                                Icon(
                                    Icons.Outlined.Email,
                                    contentDescription = null,
                                    tint = if (emailError != null) {
                                        MaterialTheme.colorScheme.error
                                    } else {
                                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)
                                    },
                                )
                            },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Email,
                                imeAction = ImeAction.Next,
                            ),
                        )
                        OutlinedTextField(
                            value = password,
                            onValueChange = {
                                password = it
                                passwordError = null
                            },
                            label = { Text("Password") },
                            singleLine = true,
                            enabled = !isLoading,
                            isError = passwordError != null,
                            supportingText = {
                                passwordError?.let { err ->
                                    Text(err, color = MaterialTheme.colorScheme.error)
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = FieldShape,
                            colors = fieldColors,
                            leadingIcon = {
                                Icon(
                                    Icons.Outlined.Lock,
                                    contentDescription = null,
                                    tint = if (passwordError != null) {
                                        MaterialTheme.colorScheme.error
                                    } else {
                                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)
                                    },
                                )
                            },
                            visualTransformation = if (passwordVisible) {
                                VisualTransformation.None
                            } else {
                                PasswordVisualTransformation()
                            },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Password,
                                imeAction = ImeAction.Done,
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = {
                                    if (validateForm() && canAttemptSubmit) {
                                        onLogin(email.trim(), password, saveForBiometric)
                                    }
                                },
                            ),
                            trailingIcon = {
                                IconButton(
                                    onClick = { passwordVisible = !passwordVisible },
                                    enabled = !isLoading,
                                ) {
                                    Icon(
                                        imageVector = if (passwordVisible) {
                                            Icons.Outlined.VisibilityOff
                                        } else {
                                            Icons.Outlined.Visibility
                                        },
                                        contentDescription = if (passwordVisible) {
                                            "Hide password"
                                        } else {
                                            "Show password"
                                        },
                                    )
                                }
                            },
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End,
                        ) {
                            TextButton(
                                onClick = { showForgotDialog = true },
                                enabled = !isLoading,
                            ) {
                                Text(stringResource(R.string.login_forgot_password))
                            }
                        }
                        if (!errorMessage.isNullOrBlank()) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.9f),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(
                                    text = errorMessage,
                                    color = MaterialTheme.colorScheme.onErrorContainer,
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(12.dp),
                                )
                            }
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Lock,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp),
                                tint = if (usesHttps) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.tertiary
                                },
                            )
                            Text(
                                text = if (usesHttps) {
                                    stringResource(R.string.login_secured_https)
                                } else {
                                    stringResource(R.string.login_secured_http)
                                },
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.82f),
                            )
                        }
                        val continueShape = RoundedCornerShape(14.dp)
                        val continueInteraction = remember { MutableInteractionSource() }
                        val canTapContinue = canAttemptSubmit && !isLoading
                        val continueDimmed = !canTapContinue && !isLoading
                        val continueFill = Brush.horizontalGradient(
                            colors = listOf(BrandGoldBright, BrandGold, BrandGoldBright),
                        )
                        val continueStroke = BrandNavy.copy(alpha = if (continueDimmed) 0.75f else 1f)
                        val continueLabel =
                            BrandNavy.copy(alpha = if (continueDimmed) 0.65f else 1f)

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 52.dp)
                                .shadow(
                                    elevation = 12.dp,
                                    shape = continueShape,
                                    ambientColor = BrandNavy.copy(alpha = 0.38f),
                                    spotColor = BrandGoldBright.copy(alpha = 0.65f),
                                )
                                .clip(continueShape)
                                .border(2.dp, continueStroke, continueShape)
                                .background(
                                    brush = continueFill,
                                    shape = continueShape,
                                    alpha = if (continueDimmed) 0.78f else 1f,
                                )
                                .clickable(
                                    interactionSource = continueInteraction,
                                    indication = ripple(
                                        bounded = true,
                                        color = BrandNavy.copy(alpha = 0.18f),
                                    ),
                                    enabled = canTapContinue,
                                    onClick = {
                                        if (!validateForm()) return@clickable
                                        onLogin(email.trim(), password, saveForBiometric)
                                    },
                                )
                                .padding(vertical = 14.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            when {
                                isLoading -> Row(
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    CircularProgressIndicator(
                                        strokeWidth = 2.5.dp,
                                        modifier = Modifier.size(22.dp),
                                        color = BrandNavy,
                                    )
                                    Text(
                                        "Signing in…",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.SemiBold,
                                        color = BrandNavy,
                                    )
                                }
                                else -> Text(
                                    text = "Continue",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = continueLabel,
                                )
                            }
                        }
                        if (biometricLoginAvailable) {
                            OutlinedButton(
                                onClick = onBiometricLoginClick,
                                enabled = !isLoading,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 48.dp),
                                shape = RoundedCornerShape(14.dp),
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Fingerprint,
                                    contentDescription = null,
                                    modifier = Modifier.size(20.dp),
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(stringResource(R.string.login_biometric_button))
                            }
                        }
                        if (canOfferBiometricOptIn) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Checkbox(
                                    checked = saveForBiometric,
                                    onCheckedChange = { saveForBiometric = it },
                                    enabled = !isLoading,
                                )
                                Text(
                                    text = stringResource(R.string.login_biometric_checkbox),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f),
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun LoginApiServerCard(
    apiBaseUrlDisplay: String,
    hostBadForPhone: Boolean,
    connectionTestRunning: Boolean,
    connectionTestResult: String?,
    isLoading: Boolean,
    onTestConnection: () -> Unit,
    onClearConnectionTestResult: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.outlinedCardColors(
            containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
        ),
        border = CardDefaults.outlinedCardBorder().copy(
            brush = Brush.horizontalGradient(
                colors = listOf(
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
                    MaterialTheme.colorScheme.secondary.copy(alpha = 0.25f),
                ),
            ),
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.SettingsEthernet,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.size(22.dp),
                )
                Text(
                    text = "API server",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.Http,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
                Text(
                    text = apiBaseUrlDisplay,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
            }
            Text(
                text = stringResource(R.string.login_network_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.78f),
            )
            if (hostBadForPhone) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.85f),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = "On this phone, 127.0.0.1 / localhost is the phone itself, not your PC. Use your PC’s Wi‑Fi IP, or USB: adb reverse tcp:3000 tcp:3000 — then 127.0.0.1 only works with that reverse.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TextButton(
                    onClick = onOpenSettings,
                    enabled = !isLoading,
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Icon(
                        Icons.Outlined.SettingsEthernet,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Server settings")
                }
                TextButton(
                    onClick = {
                        onClearConnectionTestResult()
                        onTestConnection()
                    },
                    enabled = !isLoading && !connectionTestRunning,
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Icon(
                        Icons.Outlined.CloudDone,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Test connection")
                }
            }
            when {
                connectionTestRunning -> Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(18.dp),
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        "Checking health…",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                !connectionTestResult.isNullOrBlank() -> Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        text = connectionTestResult,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }
        }
    }
}
