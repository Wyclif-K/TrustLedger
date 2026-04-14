package com.example.trustledger.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.example.trustledger.ui.screens.HomeScreen
import com.example.trustledger.ui.screens.LoansScreen
import com.example.trustledger.ui.screens.NotificationsScreen
import com.example.trustledger.ui.screens.ProfileScreen
import com.example.trustledger.ui.screens.SettingsScreen
import com.example.trustledger.ui.screens.TransactionsScreen
import com.example.trustledger.viewmodel.MainViewModel

/**
 * Single place for authenticated in-app routes and the [NavHost] graph.
 * (Name is distinct from `androidx.navigation.NavGraph`, which is used via [androidx.navigation.NavGraph.Companion.findStartDestination].)
 */
object NavGraph {
    const val HOME = "home"
    const val LOANS = "loans"
    const val ACTIVITY = "activity"
    const val PROFILE = "profile"
    const val SETTINGS = "settings"
    const val NOTIFICATIONS = "notifications"

    const val START_DESTINATION = HOME

    val mainTabs = setOf(HOME, LOANS, ACTIVITY, PROFILE)
}

@Composable
fun TrustLedgerNavHost(
    navController: NavHostController,
    vm: MainViewModel,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    NavHost(
        navController = navController,
        startDestination = NavGraph.START_DESTINATION,
        modifier = modifier,
    ) {
        composable(NavGraph.HOME) {
            HomeScreen(
                vm = vm,
                onOpenSettings = { navController.navigate(NavGraph.SETTINGS) },
                onOpenNotifications = { navController.navigate(NavGraph.NOTIFICATIONS) },
            )
        }
        composable(NavGraph.LOANS) {
            LoansScreen(
                vm = vm,
                onOpenNotifications = { navController.navigate(NavGraph.NOTIFICATIONS) },
            )
        }
        composable(NavGraph.ACTIVITY) {
            TransactionsScreen(
                vm = vm,
                onOpenNotifications = { navController.navigate(NavGraph.NOTIFICATIONS) },
            )
        }
        composable(NavGraph.PROFILE) {
            ProfileScreen(
                vm = vm,
                onLogout = onLogout,
                onOpenSettings = { navController.navigate(NavGraph.SETTINGS) },
                onOpenNotifications = { navController.navigate(NavGraph.NOTIFICATIONS) },
            )
        }
        composable(NavGraph.NOTIFICATIONS) {
            NotificationsScreen(
                vm = vm,
                onBack = { navController.popBackStack() },
            )
        }
        composable(NavGraph.SETTINGS) {
            SettingsScreen(
                vm = vm,
                onBack = { navController.popBackStack() },
            )
        }
    }
}
