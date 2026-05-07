package com.example.trustledger.ui.screens

import android.os.Build
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.SettingsEthernet
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.trustledger.R
import com.example.trustledger.ui.components.TlAccentCard
import com.example.trustledger.ui.components.TlPrimaryButton
import com.example.trustledger.ui.components.TlSettingsSectionLabel
import com.example.trustledger.ui.components.TlTopBarTitle
import com.example.trustledger.viewmodel.MainViewModel

private val FieldShape = RoundedCornerShape(14.dp)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    vm: MainViewModel,
    onBack: () -> Unit,
) {
    var serverUrl by remember { mutableStateOf(vm.getApiBaseUrlForEditing()) }
    var serverSaveError by remember { mutableStateOf<String?>(null) }

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
                        title = "Settings",
                        subtitle = "Connection & appearance",
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
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 12.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            TlSettingsSectionLabel("Connection")
            TlAccentCard {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        Icons.Outlined.SettingsEthernet,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        text = "API server",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.secondary,
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Base URL must end with /api/v1. On a hotspot, use your PC’s Wi‑Fi IPv4 (often 192.168.43.x).",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(4.dp))
                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = {
                        serverUrl = it
                        serverSaveError = null
                        vm.clearConnectionTestResult()
                    },
                    label = { Text("Base URL") },
                    singleLine = true,
                    enabled = !vm.isLoading,
                    modifier = Modifier.fillMaxWidth(),
                    shape = FieldShape,
                    colors = fieldColors,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    supportingText = {
                        Text("Railway: paste https://….up.railway.app (path /api/v1 added if missing). LAN: http://IP:3000/api/v1")
                    },
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OutlinedButton(
                        onClick = { vm.runConnectionTest(serverUrl) },
                        enabled = !vm.isLoading && !vm.connectionTestRunning,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                    ) {
                        Icon(
                            Icons.Outlined.CloudDone,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Test connection")
                    }
                    if (vm.connectionTestRunning) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                vm.connectionTestResult?.let { msg ->
                    val ok = msg.startsWith("OK:")
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (ok) {
                            MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.55f)
                        } else {
                            MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.85f)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = msg,
                                style = MaterialTheme.typography.bodySmall,
                                color = if (ok) {
                                    MaterialTheme.colorScheme.onSecondaryContainer
                                } else {
                                    MaterialTheme.colorScheme.onErrorContainer
                                },
                            )
                            if (!ok && msg.contains("timeout", ignoreCase = true)) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = stringResource(R.string.api_timeout_usb_tip),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
                serverSaveError?.let {
                    Text(
                        text = it,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                TlPrimaryButton(
                    onClick = {
                        serverSaveError = vm.saveApiBaseUrl(serverUrl)
                        if (serverSaveError == null) {
                            serverUrl = vm.getApiBaseUrlForEditing()
                            onBack()
                        }
                    },
                    enabled = !vm.isLoading && serverUrl.isNotBlank(),
                ) {
                    Text("Save server URL", style = MaterialTheme.typography.titleSmall)
                }
            }

            TlSettingsSectionLabel("Appearance")
            TlAccentCard {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        Icons.Outlined.Palette,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        text = "Look & feel",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.secondary,
                    )
                }
                Spacer(modifier = Modifier.height(10.dp))
                SettingRow(
                    title = "Theme",
                    subtitle = when (vm.themeMode) {
                        MainViewModel.ThemeMode.SYSTEM -> "Follow system"
                        MainViewModel.ThemeMode.LIGHT -> "Always light"
                        MainViewModel.ThemeMode.DARK -> "Always dark"
                    },
                    trailing = {
                        TextButton(
                            onClick = { vm.cycleThemeMode() },
                            enabled = !vm.isLoading,
                        ) {
                            Text(
                                text = when (vm.themeMode) {
                                    MainViewModel.ThemeMode.SYSTEM -> "System"
                                    MainViewModel.ThemeMode.LIGHT -> "Light"
                                    MainViewModel.ThemeMode.DARK -> "Dark"
                                },
                                color = MaterialTheme.colorScheme.secondary,
                            )
                        }
                    },
                )
                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 8.dp),
                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                )
                val dynamicSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                SettingRow(
                    title = "Dynamic color",
                    subtitle = if (dynamicSupported) {
                        "Wallpaper colors on Android 12+"
                    } else {
                        "Requires Android 12+"
                    },
                    trailing = {
                        Switch(
                            checked = vm.dynamicColorEnabled,
                            onCheckedChange = { vm.updateDynamicColorEnabled(it) },
                            enabled = dynamicSupported && !vm.isLoading,
                        )
                    },
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun SettingRow(
    title: String,
    subtitle: String,
    trailing: @Composable () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        trailing()
    }
}
