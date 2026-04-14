package com.example.trustledger.data.remote.api

import com.example.trustledger.data.ApiEnvelope
import com.example.trustledger.data.HealthDto
import com.example.trustledger.data.ChangePasswordRequest
import com.example.trustledger.data.LoanApplicationRequest
import com.example.trustledger.data.LoanDto
import com.example.trustledger.data.LoanRepaymentRequest
import com.example.trustledger.data.LoginData
import com.example.trustledger.data.LoginRequest
import com.example.trustledger.data.LogoutRequest
import com.example.trustledger.data.RefreshData
import com.example.trustledger.data.RefreshRequest
import com.example.trustledger.data.SavingsBalance
import com.example.trustledger.data.TransactionDto
import com.example.trustledger.data.UserDto
import retrofit2.Response
import com.example.trustledger.data.NotificationDto
import com.example.trustledger.data.NotificationUnreadCountDto
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface TrustLedgerApiService {
    @GET("health")
    suspend fun health(): Response<HealthDto>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): ApiEnvelope<LoginData>

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): ApiEnvelope<RefreshData>

    @POST("auth/logout")
    suspend fun logout(@Body body: LogoutRequest): ApiEnvelope<Unit>

    @GET("auth/me")
    suspend fun me(@Header("Authorization") authorization: String): ApiEnvelope<UserDto>

    @GET("members/{memberId}/balance")
    suspend fun balance(
        @Header("Authorization") authorization: String,
        @Path("memberId") memberId: String,
    ): ApiEnvelope<SavingsBalance>

    @GET("members/{memberId}/loans")
    suspend fun memberLoans(
        @Header("Authorization") authorization: String,
        @Path("memberId") memberId: String,
    ): ApiEnvelope<List<LoanDto>>

    @GET("members/{memberId}/transactions")
    suspend fun memberTransactions(
        @Header("Authorization") authorization: String,
        @Path("memberId") memberId: String,
    ): ApiEnvelope<List<TransactionDto>>

    @PUT("auth/password")
    suspend fun changePassword(
        @Header("Authorization") authorization: String,
        @Body body: ChangePasswordRequest,
    ): ApiEnvelope<Any>

    @POST("loans")
    suspend fun applyLoan(
        @Header("Authorization") authorization: String,
        @Body body: LoanApplicationRequest,
    ): ApiEnvelope<LoanDto>

    @POST("loans/{loanId}/repay")
    suspend fun repayLoan(
        @Header("Authorization") authorization: String,
        @Path("loanId") loanId: String,
        @Body body: LoanRepaymentRequest,
    ): ApiEnvelope<Any>

    @GET("notifications/unread-count")
    suspend fun unreadNotificationCount(
        @Header("Authorization") authorization: String,
        @Query("scope") scope: String = "mine",
    ): ApiEnvelope<NotificationUnreadCountDto>

    @GET("notifications")
    suspend fun notifications(
        @Header("Authorization") authorization: String,
        @Query("limit") limit: Int = 50,
        @Query("unreadOnly") unreadOnly: Boolean? = null,
        @Query("scope") scope: String = "mine",
    ): ApiEnvelope<List<NotificationDto>>

    @PATCH("notifications/{id}/read")
    suspend fun markNotificationRead(
        @Header("Authorization") authorization: String,
        @Path("id") id: String,
    ): ApiEnvelope<Map<String, Any?>>

    @PATCH("notifications/read-all")
    suspend fun markAllNotificationsRead(
        @Header("Authorization") authorization: String,
    ): ApiEnvelope<Map<String, Any?>>
}
