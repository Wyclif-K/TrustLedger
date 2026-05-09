package com.example.trustledger.viewmodel

import android.app.Application
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.trustledger.data.ChangePasswordRequest
import com.example.trustledger.data.LoginData
import com.example.trustledger.data.LoginRequest
import com.example.trustledger.data.LoanApplicationRequest
import com.example.trustledger.data.LoanDto
import com.example.trustledger.data.LoanRepaymentRequest
import com.example.trustledger.data.LogoutRequest
import com.example.trustledger.data.NotificationDto
import com.example.trustledger.data.SavingsBalance
import com.example.trustledger.data.TransactionDto
import com.example.trustledger.data.backend.TrustLedgerApi
import com.example.trustledger.data.backend.TrustLedgerBackend
import com.example.trustledger.data.backend.TrustLedgerPrefs
import com.example.trustledger.LauncherIconHelper
import com.example.trustledger.R
import com.example.trustledger.data.UserDto
import com.example.trustledger.notification.TrustLedgerNotificationHelper
import com.example.trustledger.security.BiometricLoginSupport
import com.example.trustledger.security.SecureCredentialStore
import com.example.trustledger.utils.humanReadableApiError
import com.example.trustledger.utils.normalizeTrustLedgerApiBaseUrl
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

class MainViewModel(application: Application) : AndroidViewModel(application) {

    /** Shown on the scaffold snackbar host; [successAccent] drives success styling after password change etc. */
    data class SnackbarNotice(
        val message: String,
        val successAccent: Boolean = false,
    )

    private var api: TrustLedgerApi = TrustLedgerBackend.api(application)
    private val prefs = application.getSharedPreferences(TrustLedgerPrefs.NAME, Context.MODE_PRIVATE)

    enum class ThemeMode { SYSTEM, LIGHT, DARK }

    var themeMode by mutableStateOf(loadThemeMode())
        private set

    var dynamicColorEnabled by mutableStateOf(prefs.getBoolean(PREF_DYNAMIC_COLOR, false))
        private set

    var user by mutableStateOf<UserDto?>(null)
        private set

    var accessToken by mutableStateOf<String?>(null)
        private set

    var balance by mutableStateOf<SavingsBalance?>(null)
        private set

    var balanceError by mutableStateOf<String?>(null)
        private set

    var loans by mutableStateOf<List<LoanDto>>(emptyList())
        private set

    var loansError by mutableStateOf<String?>(null)
        private set

    var transactions by mutableStateOf<List<TransactionDto>>(emptyList())
        private set

    var transactionsError by mutableStateOf<String?>(null)
        private set

    var unreadNotificationCount by mutableStateOf(0)
        private set

    var notifications by mutableStateOf<List<NotificationDto>>(emptyList())
        private set

    var notificationsError by mutableStateOf<String?>(null)
        private set

    var notificationsBusy by mutableStateOf(false)
        private set

    private var liveRefreshJob: Job? = null
    private var loanActionJob: Job? = null

    /** False until the first successful unread count after sign-in (avoids alert spam on open). */
    private var unreadBaselineEstablished = false

    var isLoading by mutableStateOf(false)
        private set

    /** Apply / repay loan in flight (avoid disabling the whole app like [isLoading]). */
    var loanMutationInProgress by mutableStateOf(false)
        private set

    /** Last loan apply/repay error; shown on Loans screen (not [errorMessage], which is login/profile). */
    var loanMutationError by mutableStateOf<String?>(null)
        private set

    var isRefreshing by mutableStateOf(false)
        private set

    var errorMessage by mutableStateOf<String?>(null)
        private set

    var snackbarNotice by mutableStateOf<SnackbarNotice?>(null)
        private set

    var passwordChangeInProgress by mutableStateOf(false)
        private set

    var connectionTestRunning by mutableStateOf(false)
        private set

    var connectionTestResult by mutableStateOf<String?>(null)
        private set

    /** True when encrypted credentials exist and device biometrics are ready (login screen). */
    var biometricLoginAvailable by mutableStateOf(false)
        private set

    /** Show opt-in checkbox before any saved credential exists. */
    var canOfferBiometricOptIn by mutableStateOf(false)
        private set

    fun refreshBiometricLoginAvailability() {
        val app = getApplication<Application>()
        biometricLoginAvailable = BiometricLoginSupport.canOfferFingerprintButton(app)
        canOfferBiometricOptIn = BiometricLoginSupport.deviceSupportsStrongBiometric(app) &&
            !SecureCredentialStore.hasCredentials(app)
    }

    fun clearConnectionTestResult() {
        connectionTestResult = null
    }

    /** Probes GET /health for the URL in the field; if blank, uses the saved/default base URL. */
    fun runConnectionTest(urlFromField: String) {
        viewModelScope.launch {
            connectionTestRunning = true
            connectionTestResult = try {
                withContext(Dispatchers.IO) {
                    val raw = urlFromField.trim()
                    val base =
                        if (raw.isEmpty()) TrustLedgerBackend.resolveBaseUrl(getApplication()) else raw
                    TrustLedgerBackend.probeHealthAtBaseUrl(base)
                }
            } catch (e: Exception) {
                humanReadableApiError(e)
            } finally {
                connectionTestRunning = false
            }
        }
    }

    fun clearError() {
        errorMessage = null
    }

    /** Value shown in Settings (no trailing slash). */
    fun getApiBaseUrlForEditing(): String {
        val stored = prefs.getString(TrustLedgerPrefs.API_BASE_URL, null)?.trim()
        if (!stored.isNullOrBlank()) {
            return stored.trimEnd('/')
        }
        return TrustLedgerBackend.defaultApiBaseUrl(getApplication())
    }

    /** Effective API root (no trailing slash), for login UI — same resolution as Retrofit. */
    fun apiBaseUrlForDisplay(): String =
        TrustLedgerBackend.resolveBaseUrl(getApplication()).trimEnd('/')

    /**
     * Persists URL, rebuilds Retrofit, clears local session if one existed.
     * @return null on success, or a short error message
     */
    fun saveApiBaseUrl(raw: String): String? {
        val normalized = normalizeTrustLedgerApiBaseUrl(raw)
            ?: return "Enter a valid host or URL (e.g. https://your-app.up.railway.app or http://192.168.43.56:3000 — /api/v1 is added automatically)."
        val before = TrustLedgerBackend.resolveBaseUrl(getApplication()).trimEnd('/')
        val after = normalized.trimEnd('/')
        val urlChanged = before != after
        prefs.edit().putString(TrustLedgerPrefs.API_BASE_URL, normalized).apply()
        api = TrustLedgerBackend.api(getApplication())
        if (accessToken != null && urlChanged) {
            clearLocalSessionForServerChange()
            snackbarNotice = SnackbarNotice("Server URL updated. Please sign in again.")
        }
        return null
    }

    private fun clearLocalSessionForServerChange() {
        stopLiveRefresh()
        prefs.edit()
            .remove(TrustLedgerPrefs.ACCESS)
            .remove(TrustLedgerPrefs.REFRESH)
            .apply()
        accessToken = null
        user = null
        balance = null
        loans = emptyList()
        transactions = emptyList()
        unreadNotificationCount = 0
        notifications = emptyList()
        unreadBaselineEstablished = false
        errorMessage = null
        syncLauncherIcon()
        refreshBiometricLoginAvailability()
    }

    fun consumeSnackbar() {
        snackbarNotice = null
    }

    init {
        refreshBiometricLoginAvailability()
        // Keep restoreSession last so UI theme/restored session behaves as before.
        restoreSession()
    }

    fun updateDynamicColorEnabled(enabled: Boolean) {
        dynamicColorEnabled = enabled
        prefs.edit().putBoolean(PREF_DYNAMIC_COLOR, enabled).apply()
    }

    fun updateThemeMode(mode: ThemeMode) {
        themeMode = mode
        prefs.edit().putString(PREF_THEME_MODE, mode.name).apply()
    }

    fun cycleThemeMode() {
        val next = when (themeMode) {
            ThemeMode.SYSTEM -> ThemeMode.LIGHT
            ThemeMode.LIGHT -> ThemeMode.DARK
            ThemeMode.DARK -> ThemeMode.SYSTEM
        }
        updateThemeMode(next)
    }

    fun restoreSession() {
        val token = prefs.getString(TrustLedgerPrefs.ACCESS, null)
        if (token.isNullOrBlank()) {
            accessToken = null
            user = null
            balance = null
            loans = emptyList()
            transactions = emptyList()
            syncLauncherIcon()
            return
        }

        accessToken = token
        viewModelScope.launch {
            try {
                isLoading = true
                errorMessage = null
                balanceError = null
                loansError = null
                transactionsError = null
                loadMeAndBalance()
                syncLauncherIcon()
                fetchUnreadNotificationCount(alertIfIncreased = true)
                startLiveRefresh()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                errorMessage = humanReadableApiError(e)
                logoutInternal()
            } finally {
                isLoading = false
            }
        }
    }

    fun clearBalanceError() {
        balanceError = null
    }

    fun clearLoansError() {
        loansError = null
    }

    fun clearLoanMutationError() {
        loanMutationError = null
    }

    fun clearTransactionsError() {
        transactionsError = null
    }

    fun refreshDashboard() {
        viewModelScope.launch {
            try {
                isRefreshing = true
                isLoading = true
                errorMessage = null
                balanceError = null
                loansError = null
                transactionsError = null
                loadBalance()
                loadLoans()
                loadTransactions()
                fetchUnreadNotificationCount(alertIfIncreased = false)
            } catch (e: Exception) {
                errorMessage = humanReadableApiError(e)
            } finally {
                isLoading = false
                isRefreshing = false
            }
        }
    }

    fun refreshBalance() {
        viewModelScope.launch {
            try {
                isRefreshing = true
                balanceError = null
                loadBalance()
            } catch (e: Exception) {
                balanceError = humanReadableApiError(e)
            } finally {
                isRefreshing = false
            }
        }
    }

    /** Refresh savings without toggling pull-to-refresh (e.g. Loans tab). */
    fun refreshBalanceQuiet() {
        viewModelScope.launch {
            try {
                loadBalance()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                balanceError = humanReadableApiError(e)
            }
        }
    }

    fun refreshLoans() {
        viewModelScope.launch {
            try {
                isRefreshing = true
                loansError = null
                loadLoans()
            } catch (e: Exception) {
                loansError = humanReadableApiError(e)
            } finally {
                isRefreshing = false
            }
        }
    }

    fun refreshTransactions() {
        viewModelScope.launch {
            try {
                isRefreshing = true
                transactionsError = null
                loadTransactions()
            } catch (e: Exception) {
                transactionsError = humanReadableApiError(e)
            } finally {
                isRefreshing = false
            }
        }
    }

    fun login(email: String, password: String, persistForBiometric: Boolean = false) {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                val envelope = api.login(LoginRequest(email.trim(), password))
                if (!envelope.success) {
                    errorMessage = envelope.message ?: "Login failed"
                    return@launch
                }

                val data: LoginData = envelope.data ?: run {
                    errorMessage = "Invalid server response"
                    return@launch
                }

                accessToken = data.accessToken
                user = data.user
                syncLauncherIcon()
                prefs.edit().apply {
                    putString(TrustLedgerPrefs.ACCESS, data.accessToken)
                    if (!data.refreshToken.isNullOrBlank()) {
                        putString(TrustLedgerPrefs.REFRESH, data.refreshToken)
                    }
                }.apply()

                val app = getApplication<Application>()
                if (persistForBiometric &&
                    BiometricLoginSupport.deviceSupportsStrongBiometric(app)
                ) {
                    SecureCredentialStore.save(app, email.trim(), password)
                }
                refreshBiometricLoginAvailability()
            } catch (e: Exception) {
                errorMessage = humanReadableApiError(e)
                return@launch
            } finally {
                if (accessToken == null || user == null) {
                    isLoading = false
                }
            }

            try {
                loadBalance()
                loadLoans()
                loadTransactions()
                fetchUnreadNotificationCount(alertIfIncreased = true)
                startLiveRefresh()
            } catch (_: Exception) {
            } finally {
                isLoading = false
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            val refresh = prefs.getString(TrustLedgerPrefs.REFRESH, null)
            try {
                if (!refresh.isNullOrBlank()) {
                    api.logout(LogoutRequest(refresh))
                }
            } catch (_: Exception) {
            }
            logoutInternal(clearSnackbar = true)
        }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            passwordChangeInProgress = true
            errorMessage = null
            try {
                val token = accessToken ?: run {
                    errorMessage = "Not signed in"
                    return@launch
                }
                val env = api.changePassword(
                    "Bearer $token",
                    ChangePasswordRequest(currentPassword, newPassword),
                )
                if (!env.success) {
                    errorMessage = env.message ?: "Could not change password"
                    return@launch
                }
                snackbarNotice = SnackbarNotice(
                    message = "Password updated successfully. For your security, you've been " +
                        "signed out everywhere. Sign back in using your new password.",
                    successAccent = true,
                )
                SecureCredentialStore.clear(getApplication())
                logoutInternal(clearSnackbar = false)
            } catch (e: Exception) {
                errorMessage = humanReadableApiError(e)
            } finally {
                passwordChangeInProgress = false
            }
        }
    }

    private fun logoutInternal(clearSnackbar: Boolean = true) {
        stopLiveRefresh()
        prefs.edit()
            .remove(TrustLedgerPrefs.ACCESS)
            .remove(TrustLedgerPrefs.REFRESH)
            .apply()
        accessToken = null
        user = null
        balance = null
        loans = emptyList()
        transactions = emptyList()
        unreadNotificationCount = 0
        notifications = emptyList()
        unreadBaselineEstablished = false
        errorMessage = null
        if (clearSnackbar) snackbarNotice = null
        syncLauncherIcon()
        refreshBiometricLoginAvailability()
    }

    private fun syncLauncherIcon() {
        LauncherIconHelper.syncForRole(getApplication(), user?.role)
    }

    private suspend fun loadMeAndBalance() {
        val token = accessToken ?: return
        val me = api.me("Bearer $token")
        if (!me.success) throw RuntimeException(me.message ?: "Failed to load user")

        user = me.data
        if (user == null) throw RuntimeException("User not found")

        loadBalance()
        loadLoans()
        loadTransactions()
    }

    private suspend fun loadBalance() {
        try {
            val token = accessToken ?: return
            val memberId = user?.memberId ?: return

            val env = api.balance("Bearer $token", memberId)
            if (!env.success) throw RuntimeException(env.message ?: "Failed to load balance")

            balance = env.data
            balanceError = null
        } catch (e: Exception) {
            balanceError = humanReadableApiError(e)
        }
    }

    private suspend fun loadLoans() {
        try {
            val token = accessToken ?: return
            val memberId = user?.memberId ?: return
            val env = api.memberLoans("Bearer $token", memberId)
            if (!env.success) throw RuntimeException(env.message ?: "Failed to load loans")
            loans = env.data ?: emptyList()
            loansError = null
        } catch (e: Exception) {
            loansError = humanReadableApiError(e)
        }
    }

    private suspend fun loadTransactions() {
        try {
            val token = accessToken ?: return
            val memberId = user?.memberId ?: return
            val env = api.memberTransactions("Bearer $token", memberId)
            if (!env.success) throw RuntimeException(env.message ?: "Failed to load transactions")
            transactions = env.data ?: emptyList()
            transactionsError = null
        } catch (e: Exception) {
            transactionsError = humanReadableApiError(e)
        }
    }

    private fun startLiveRefresh() {
        stopLiveRefresh()
        liveRefreshJob = viewModelScope.launch {
            while (isActive && accessToken != null) {
                delay(15_000)
                try {
                    loadBalance()
                    loadLoans()
                    loadTransactions()
                    fetchUnreadNotificationCount(alertIfIncreased = true)
                } catch (_: Exception) {
                    // Keep polling even if one attempt fails.
                }
            }
        }
    }

    private fun stopLiveRefresh() {
        liveRefreshJob?.cancel()
        liveRefreshJob = null
    }

    fun applyLoan(amount: Double, termMonths: Int, purpose: String) {
        if (loanActionJob?.isActive == true) return
        loanActionJob = viewModelScope.launch {
            try {
                loanMutationInProgress = true
                loanMutationError = null
                val token = accessToken ?: throw RuntimeException("Not logged in")
                val memberId = user?.memberId ?: throw RuntimeException("Member not found")
                val request = LoanApplicationRequest(
                    memberId = memberId,
                    amount = amount,
                    termMonths = termMonths,
                    purpose = purpose.trim(),
                )
                val env = api.applyLoan("Bearer $token", request)
                if (!env.success) {
                    throw RuntimeException(env.message ?: "Failed to apply loan")
                }
                loadLoans()
                snackbarNotice = SnackbarNotice("Loan application submitted successfully.")
            } catch (e: Exception) {
                loanMutationError = humanReadableApiError(e)
            } finally {
                loanMutationInProgress = false
            }
        }
    }

    fun repayLoan(loanId: String, amount: Double) {
        if (loanActionJob?.isActive == true) return
        loanActionJob = viewModelScope.launch {
            try {
                loanMutationInProgress = true
                loanMutationError = null
                val token = accessToken ?: throw RuntimeException("Not logged in")
                val reference = "APP-${System.currentTimeMillis()}"
                val body = LoanRepaymentRequest(
                    amount = amount,
                    reference = reference,
                    channel = "MOBILE_APP",
                )
                val env = api.repayLoan("Bearer $token", loanId, body)
                if (!env.success) {
                    throw RuntimeException(env.message ?: "Repayment failed")
                }
                loadLoans()
                loadBalance()
                snackbarNotice = SnackbarNotice("Repayment recorded successfully.")
            } catch (e: Exception) {
                loanMutationError = humanReadableApiError(e)
            } finally {
                loanMutationInProgress = false
            }
        }
    }

    fun loadNotifications() {
        viewModelScope.launch {
            val token = accessToken ?: return@launch
            notificationsBusy = true
            notificationsError = null
            try {
                val env = api.notifications(
                    authorization = "Bearer $token",
                    limit = 50,
                    unreadOnly = null,
                    scope = "mine",
                )
                if (!env.success) {
                    notificationsError = env.message ?: "Failed to load notifications"
                    return@launch
                }
                notifications = env.data ?: emptyList()
            } catch (e: Exception) {
                notificationsError = humanReadableApiError(e)
            } finally {
                notificationsBusy = false
            }
        }
    }

    fun clearNotificationsError() {
        notificationsError = null
    }

    fun markNotificationRead(id: String) {
        viewModelScope.launch {
            val token = accessToken ?: return@launch
            try {
                val env = api.markNotificationRead("Bearer $token", id)
                if (!env.success) {
                    notificationsError = env.message ?: "Could not update notification"
                    return@launch
                }
                notifications = notifications.map { n ->
                    if (n.id == id) n.copy(isRead = true) else n
                }
                fetchUnreadNotificationCount(alertIfIncreased = false)
            } catch (e: Exception) {
                notificationsError = humanReadableApiError(e)
            }
        }
    }

    fun markAllNotificationsRead() {
        viewModelScope.launch {
            val token = accessToken ?: return@launch
            try {
                val env = api.markAllNotificationsRead("Bearer $token")
                if (!env.success) {
                    notificationsError = env.message ?: "Could not mark all read"
                    return@launch
                }
                notifications = notifications.map { it.copy(isRead = true) }
                fetchUnreadNotificationCount(alertIfIncreased = false)
            } catch (e: Exception) {
                notificationsError = humanReadableApiError(e)
            }
        }
    }

    /**
     * Updates [unreadNotificationCount]. When [alertIfIncreased] is true, a system notification
     * is shown if the count goes up (not on the first sync after sign-in).
     */
    private suspend fun fetchUnreadNotificationCount(alertIfIncreased: Boolean) {
        val token = accessToken ?: return
        try {
            val env = api.unreadNotificationCount("Bearer $token")
            if (!env.success || env.data == null) return
            val newCount = env.data.count
            if (!unreadBaselineEstablished) {
                unreadNotificationCount = newCount
                unreadBaselineEstablished = true
                return
            }
            val previous = unreadNotificationCount
            unreadNotificationCount = newCount
            if (!alertIfIncreased || newCount <= previous) return
            if (!TrustLedgerNotificationHelper.canPost(getApplication())) return
            postUnreadDigestNotification()
        } catch (_: Exception) {
        }
    }

    private suspend fun postUnreadDigestNotification() {
        val app = getApplication<Application>()
        try {
            val token = accessToken ?: return
            val env = api.notifications(
                authorization = "Bearer $token",
                limit = 1,
                unreadOnly = true,
                scope = "mine",
            )
            val first = if (env.success) env.data?.firstOrNull() else null
            val title = first?.title?.takeIf { !it.isNullOrBlank() }
                ?: app.getString(R.string.notifications_new_update)
            val text = first?.message?.takeIf { !it.isNullOrBlank() }
                ?: app.getString(R.string.notifications_tap_to_view)
            TrustLedgerNotificationHelper.showNewUpdates(app, title, text)
        } catch (_: Exception) {
            TrustLedgerNotificationHelper.showNewUpdates(
                app,
                app.getString(R.string.notifications_new_update),
                app.getString(R.string.notifications_tap_to_view),
            )
        }
    }

    fun formatUgX(value: Double?): String {
        if (value == null) return "UGX —"
        val locale = Locale("en", "UG")
        val formatted = java.text.NumberFormat.getNumberInstance(locale).format(value)
        return "UGX $formatted"
    }

    private fun loadThemeMode(): ThemeMode {
        val raw = prefs.getString(PREF_THEME_MODE, ThemeMode.SYSTEM.name) ?: ThemeMode.SYSTEM.name
        return runCatching { ThemeMode.valueOf(raw) }.getOrDefault(ThemeMode.SYSTEM)
    }

    private companion object {
        private const val PREF_THEME_MODE = "pref_theme_mode"
        private const val PREF_DYNAMIC_COLOR = "pref_dynamic_color"
    }
}

