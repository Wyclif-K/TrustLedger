package com.example.trustledger.data

import com.google.gson.annotations.SerializedName

data class ApiEnvelope<T>(
    val success: Boolean,
    val message: String? = null,
    val data: T? = null,
)

/** GET /health — shape differs slightly on 200 vs 503. */
data class HealthDto(
    val success: Boolean? = null,
    val service: String? = null,
    val database: String? = null,
    val fabric: String? = null,
    val message: String? = null,
    val timestamp: String? = null,
)

data class LoginRequest(val email: String, val password: String)

data class ChangePasswordRequest(val currentPassword: String, val newPassword: String)

data class LoginData(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String? = null,
    val user: UserDto,
)

data class RefreshRequest(@SerializedName("refreshToken") val refreshToken: String)

data class RefreshData(@SerializedName("accessToken") val accessToken: String)

data class LogoutRequest(@SerializedName("refreshToken") val refreshToken: String? = null)

data class UserDto(
    val id: String,
    val memberId: String,
    val email: String,
    val fullName: String,
    val role: String,
)

data class SavingsBalance(
    val memberId: String? = null,
    val balance: Double? = null,
    val totalDeposited: Double? = null,
    val totalWithdrawn: Double? = null,
)

data class LoanApplicationRequest(
    val memberId: String,
    val amount: Double,
    val termMonths: Int,
    val purpose: String,
    val guarantorId: String = "",
)

data class LoanRepaymentRequest(
    val amount: Double,
    val reference: String,
    val channel: String = "MOBILE_APP",
)

data class LoanDto(
    val loanId: String? = null,
    val memberId: String? = null,
    val amount: Double? = null,
    val status: String? = null,
    val outstandingBalance: Double? = null,
    val nextDueDate: String? = null,
    val termMonths: Int? = null,
    val monthlyInstalment: Double? = null,
    val totalRepayable: Double? = null,
)

data class TransactionDto(
    val txId: String? = null,
    val type: String? = null,
    val amount: Double? = null,
    val reference: String? = null,
    val timestamp: String? = null,
)

/** GET /notifications/unread-count?scope=mine */
data class NotificationUnreadCountDto(
    val count: Int = 0,
)

/** GET /notifications */
data class NotificationDto(
    val id: String,
    val type: String? = null,
    val title: String? = null,
    val message: String? = null,
    val channel: String? = null,
    val isRead: Boolean = false,
    val sentAt: String? = null,
    val createdAt: String? = null,
    val memberId: String? = null,
)
