package com.example.trustledger

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModelProvider
import com.example.trustledger.ui.navigation.AuthenticatedApp
import com.example.trustledger.ui.screens.LoginScreen
import com.example.trustledger.ui.screens.SettingsScreen
import com.example.trustledger.ui.theme.TrustLedgerTheme
import com.example.trustledger.viewmodel.MainViewModel

class MainActivity : ComponentActivity() {

    private enum class UnauthScreen { LOGIN, SETTINGS }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        val vm = ViewModelProvider(this)[MainViewModel::class.java]

        setContent {
            val systemDark = isSystemInDarkTheme()
            val darkTheme = when (vm.themeMode) {
                MainViewModel.ThemeMode.SYSTEM -> systemDark
                MainViewModel.ThemeMode.LIGHT -> false
                MainViewModel.ThemeMode.DARK -> true
            }

            var unauthScreen by remember { mutableStateOf(UnauthScreen.LOGIN) }

            LaunchedEffect(vm.user != null) {
                if (vm.user != null) {
                    unauthScreen = UnauthScreen.LOGIN
                }
            }

            val snackbarHostState = remember { SnackbarHostState() }
            LaunchedEffect(vm.snackbarMessage) {
                val msg = vm.snackbarMessage
                if (!msg.isNullOrBlank()) {
                    snackbarHostState.showSnackbar(msg)
                    vm.consumeSnackbar()
                }
            }

            TrustLedgerTheme(
                darkTheme = darkTheme,
                dynamicColor = vm.dynamicColorEnabled,
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    Scaffold(
                        modifier = Modifier.fillMaxSize(),
                        contentWindowInsets = WindowInsets(0.dp, 0.dp, 0.dp, 0.dp),
                        snackbarHost = {
                            SnackbarHost(
                                hostState = snackbarHostState,
                                modifier = Modifier
                                    .navigationBarsPadding()
                                    .padding(bottom = 8.dp),
                            )
                        },
                    ) { padding ->
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(padding),
                        ) {
                            AnimatedContent(
                                targetState = Pair(vm.user != null, unauthScreen),
                                transitionSpec = {
                                    fadeIn(animationSpec = tween(180)) togetherWith fadeOut(animationSpec = tween(140))
                                },
                                label = "root",
                            ) { (isAuthed, unauthScr) ->
                                if (!isAuthed) {
                                    when (unauthScr) {
                                        UnauthScreen.LOGIN -> LoginScreen(
                                            onLogin = { email, password -> vm.login(email, password) },
                                            isLoading = vm.isLoading,
                                            errorMessage = vm.errorMessage,
                                            apiBaseUrlDisplay = vm.apiBaseUrlForDisplay(),
                                            connectionTestRunning = vm.connectionTestRunning,
                                            connectionTestResult = vm.connectionTestResult,
                                            onTestConnection = { vm.runConnectionTest("") },
                                            onClearConnectionTestResult = { vm.clearConnectionTestResult() },
                                            onOpenSettings = { unauthScreen = UnauthScreen.SETTINGS },
                                        )
                                        UnauthScreen.SETTINGS -> SettingsScreen(
                                            vm = vm,
                                            onBack = { unauthScreen = UnauthScreen.LOGIN },
                                        )
                                    }
                                } else {
                                    AuthenticatedApp(
                                        vm = vm,
                                        onLogout = { vm.logout() },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
