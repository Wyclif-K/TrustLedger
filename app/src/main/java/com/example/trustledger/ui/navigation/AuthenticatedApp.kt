package com.example.trustledger.ui.navigation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.trustledger.notification.TrustLedgerNotificationHelper
import com.example.trustledger.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthenticatedApp(
    vm: MainViewModel,
    onLogout: () -> Unit,
    navController: NavHostController = rememberNavController(),
) {
    val context = LocalContext.current
    val postNotifLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { }

    LaunchedEffect(vm.user?.memberId) {
        if (vm.user == null) return@LaunchedEffect
        val appCtx = context.applicationContext
        TrustLedgerNotificationHelper.ensureChannel(appCtx)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                appCtx,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                postNotifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val showBottomBar = currentRoute in NavGraph.mainTabs

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                TrustLedgerBottomBar(
                    navController = navController,
                    currentRoute = currentRoute,
                )
            }
        },
    ) { padding ->
        TrustLedgerNavHost(
            navController = navController,
            vm = vm,
            onLogout = onLogout,
            modifier = Modifier.padding(padding),
        )
    }
}
