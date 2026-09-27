package com.saaserp.attendance.data.auth

import android.util.Log
import com.saaserp.attendance.BuildConfig
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

sealed class AuthResult {
    data class Success(val employeeId: String, val fullName: String, val mustChangePassword: Boolean) : AuthResult()
    data class Failure(val message: String) : AuthResult()
}

sealed class PasswordChangeResult {
    object Success : PasswordChangeResult()
    data class Failure(val message: String) : PasswordChangeResult()
}

class AuthRepository(
    private val authApi: SupabaseAuthApi,
    private val restApi: SupabaseRestApi,
    private val tokenStore: SecureTokenStore,
    private val httpClient: OkHttpClient = OkHttpClient(),
) {
    private val apiKey = BuildConfig.SUPABASE_ANON_KEY

    val isLoggedIn: Boolean get() = tokenStore.isLoggedIn
    val employeeId: String? get() = tokenStore.employeeId
    val employeeName: String? get() = tokenStore.employeeName
    val employeeEmail: String? get() = tokenStore.employeeEmail
    val employeePhotoUrl: String? get() = tokenStore.employeePhotoUrl
    val hasSeenTour: Boolean get() = tokenStore.hasSeenTour
    val isAppLockEnabled: Boolean get() = tokenStore.isAppLockEnabled
    val mustChangePassword: Boolean get() = tokenStore.mustChangePassword

    /**
     * A plain property read of [employeePhotoUrl] gives Compose nothing to
     * subscribe to, so a composable that read it once (e.g. the top-bar
     * avatar, rendered before the profile-photo fetch that now runs at
     * launch has finished) never recomposed when the value changed —
     * the avatar stayed blank until something else forced that composable
     * to re-run, which in practice only ever happened after visiting the
     * Profile screen. This is the actual observable source of truth; the
     * plain property above stays for non-Compose callers.
     */
    private val _employeePhotoUrlFlow = MutableStateFlow(tokenStore.employeePhotoUrl)
    val employeePhotoUrlFlow: StateFlow<String?> = _employeePhotoUrlFlow.asStateFlow()

    /** Same StateFlow-for-Compose reasoning as [employeePhotoUrlFlow] — drives whether the roster bottom-nav tab shows up. */
    private val _canViewRosterAttendanceFlow = MutableStateFlow(tokenStore.canViewRosterAttendance)
    val canViewRosterAttendanceFlow: StateFlow<Boolean> = _canViewRosterAttendanceFlow.asStateFlow()

    fun updateCanViewRosterAttendance(canView: Boolean) {
        tokenStore.canViewRosterAttendance = canView
        _canViewRosterAttendanceFlow.value = canView
    }

    private val _appLanguageFlow = MutableStateFlow(com.saaserp.attendance.util.AppLanguage.fromCode(tokenStore.appLanguageCode))
    val appLanguageFlow: StateFlow<com.saaserp.attendance.util.AppLanguage> = _appLanguageFlow.asStateFlow()

    fun setAppLanguage(language: com.saaserp.attendance.util.AppLanguage) {
        tokenStore.appLanguageCode = language.code
        _appLanguageFlow.value = language
    }

    fun setTourSeen(seen: Boolean) {
        tokenStore.hasSeenTour = seen
    }

    fun setAppLockEnabled(enabled: Boolean) {
        tokenStore.isAppLockEnabled = enabled
    }

    fun updateEmployeeName(newName: String) {
        tokenStore.employeeName = newName
    }

    fun updateEmployeePhoto(photoUrl: String?) {
        tokenStore.employeePhotoUrl = photoUrl
        _employeePhotoUrlFlow.value = photoUrl
    }

    /** Last "remember me" credentials (encrypted store) for re-login after logout. */
    val rememberedLoginId: String? get() = tokenStore.savedLoginId
    val rememberedPassword: String? get() = tokenStore.savedPassword

    fun rememberCredentials(loginId: String, password: String) {
        tokenStore.savedLoginId = loginId
        tokenStore.savedPassword = password
    }

    fun forgetCredentials() {
        tokenStore.savedLoginId = null
        tokenStore.savedPassword = null
    }

    /**
     * The login field accepts a phone number as well as an email — resolves
     * it to the real account email via our own server (same endpoint the
     * web admin login uses) before calling Supabase's password grant, which
     * only ever knows email+password. Returns null on any failure; the
     * caller shows the same generic "invalid email/phone or password" it
     * would show for a wrong password, never revealing whether the phone
     * number itself was recognized.
     */
    private suspend fun resolveIdentifier(identifier: String): String? = withContext(Dispatchers.IO) {
        try {
            val url = BuildConfig.API_BASE_URL.toHttpUrl().resolve("api/auth/resolve-login")
                ?: return@withContext null
            val body = JSONObject().put("identifier", identifier).toString()
                .toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url(url).post(body).build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val json = JSONObject(response.body?.string() ?: "{}")
                json.optString("email").ifBlank { null }
            }
        } catch (e: Exception) {
            Log.e(TAG, "resolveIdentifier failed: ${e.javaClass.simpleName}: ${e.message}")
            null
        }
    }

    suspend fun login(identifier: String, password: String): AuthResult {
        val trimmedIdentifier = identifier.trim()
        val email = if (trimmedIdentifier.contains("@")) {
            trimmedIdentifier
        } else {
            resolveIdentifier(trimmedIdentifier)
                ?: return AuthResult.Failure("Invalid email/phone or password")
        }

        val response = try {
            authApi.passwordGrant(apikey = apiKey, body = PasswordGrantRequest(email, password))
        } catch (e: Exception) {
            return AuthResult.Failure(e.message ?: "Network error while signing in")
        }

        val body = response.body()
        if (!response.isSuccessful || body?.accessToken == null || body.user == null) {
            val reason = body?.errorDescription ?: body?.msg ?: body?.error ?: "Invalid email or password"
            return AuthResult.Failure(reason)
        }

        tokenStore.accessToken = body.accessToken
        tokenStore.refreshToken = body.refreshToken
        tokenStore.employeeId = body.user.id
        tokenStore.employeeEmail = body.user.email

        // Fetch the profile row for full_name / role_key / is_active — the
        // auth token alone doesn't carry those.
        val profileResponse = try {
            restApi.getOwnProfile(
                apikey = apiKey,
                bearer = "Bearer ${body.accessToken}",
                idFilter = "eq.${body.user.id}",
            )
        } catch (e: Exception) {
            null
        }
        val profile = profileResponse?.body()?.firstOrNull()

        if (profile != null && !profile.is_active) {
            tokenStore.clearSession()
            return AuthResult.Failure("This account has been disabled. Contact your organization admin.")
        }
        if (profile != null && profile.role_key != "super_admin" && profile.roles?.has_attendance_access != true) {
            // Which roles may use this app is admin-editable (Roles &
            // Permissions matrix' "Attendance App Access" column), not a
            // hardcoded set — super_admin is always allowed, same as it
            // always has full access everywhere else.
            tokenStore.clearSession()
            return AuthResult.Failure("This account is not set up for the attendance app.")
        }

        val fullName = profile?.full_name ?: body.user.email ?: "Employee"
        tokenStore.employeeName = fullName
        if (!profile?.avatar_url.isNullOrBlank()) {
            updateEmployeePhoto(profile?.avatar_url)
        }
        val mustChangePassword = profile?.must_change_password ?: false
        tokenStore.mustChangePassword = mustChangePassword

        return AuthResult.Success(body.user.id, fullName, mustChangePassword)
    }

    /**
     * Submits a "forgot password" request for a staff member who can't log
     * in — identified by email or phone, same as the web admin's identifier
     * resolution. Always reports success regardless of whether the
     * identifier matched an account, so the response can't be used to probe
     * for valid accounts; the caller shows one generic confirmation message
     * either way.
     */
    suspend fun requestPasswordReset(identifier: String): ResetRequestResult = withContext(Dispatchers.IO) {
        try {
            val url = BuildConfig.API_BASE_URL.toHttpUrl().resolve("api/auth/request-password-reset")
                ?: return@withContext ResetRequestResult.Error("Unable to reach the server")
            val body = JSONObject().put("identifier", identifier).toString()
                .toRequestBody("application/json".toMediaType())
            httpClient.newCall(Request.Builder().url(url).post(body).build()).execute().use { response ->
                val json = try { JSONObject(response.body?.string() ?: "{}") } catch (_: Exception) { JSONObject() }
                when {
                    response.code == 404 ->
                        ResetRequestResult.NotFound(json.optString("error", "No account found with this email or phone number."))
                    response.isSuccessful && json.optString("request_id").isNotBlank() -> {
                        val request = ResetRequest(
                            id = json.getString("request_id"),
                            token = json.getString("client_token"),
                            identifier = identifier,
                            status = json.optString("status", "pending"),
                        )
                        saveResetRequest(request)
                        ResetRequestResult.Sent(request)
                    }
                    response.code == 429 -> ResetRequestResult.Error("Too many attempts. Try again in a few minutes.")
                    else -> ResetRequestResult.Error(json.optString("error", "Couldn't send the request. Try again."))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "requestPasswordReset failed: ${e.javaClass.simpleName}: ${e.message}")
            ResetRequestResult.Error("No internet connection. Try again.")
        }
    }

    fun currentResetRequest(): ResetRequest? = ResetRequest.fromJson(tokenStore.resetRequestJson)

    fun saveResetRequest(request: ResetRequest) {
        tokenStore.resetRequestJson = request.toJson()
    }

    fun clearResetRequest() {
        tokenStore.resetRequestJson = null
    }

    /**
     * Asks the server for the outcome of this device's own request and
     * updates the locally stored copy. Returns the (possibly updated)
     * request, or null if there is none. A network failure keeps the stored
     * status as it was.
     */
    suspend fun refreshResetRequest(): ResetRequest? = withContext(Dispatchers.IO) {
        val current = currentResetRequest() ?: return@withContext null
        if (current.status != "pending") return@withContext current
        try {
            val url = BuildConfig.API_BASE_URL.toHttpUrl().resolve("api/auth/password-reset-status")
                ?.newBuilder()?.addQueryParameter("id", current.id)?.addQueryParameter("token", current.token)?.build()
                ?: return@withContext current
            httpClient.newCall(Request.Builder().url(url).get().build()).execute().use { response ->
                if (response.code == 404) {
                    // Request was deleted server-side — nothing left to track.
                    clearResetRequest()
                    return@withContext null
                }
                if (!response.isSuccessful) return@withContext current
                val json = JSONObject(response.body?.string() ?: "{}")
                val updated = current.copy(
                    status = json.optString("status", current.status),
                    rejectReason = json.optString("reject_reason", "").ifBlank { null },
                )
                saveResetRequest(updated)
                updated
            }
        } catch (e: Exception) {
            Log.w(TAG, "refreshResetRequest failed: ${e.message}")
            current
        }
    }

    /**
     * Replaces the signed-in employee's temporary password with one of their
     * own choosing. Same server endpoint the web admin panel uses — it
     * verifies [currentPassword] by re-authenticating before accepting the
     * change.
     */
    suspend fun changePassword(currentPassword: String, newPassword: String): PasswordChangeResult = withContext(Dispatchers.IO) {
        val url = BuildConfig.API_BASE_URL.toHttpUrl().resolve("api/auth/change-password")
            ?: return@withContext PasswordChangeResult.Failure("Unable to reach the server")
        val payload = JSONObject()
            .put("currentPassword", currentPassword)
            .put("newPassword", newPassword)
            .toString()

        fun callWith(token: String) = httpClient.newCall(
            Request.Builder()
                .url(url)
                .post(payload.toRequestBody("application/json".toMediaType()))
                .header("Authorization", "Bearer $token")
                .build()
        ).execute()

        try {
            var token = tokenStore.accessToken
                ?: return@withContext PasswordChangeResult.Failure("You're signed out — please log in again")
            var response = callWith(token)

            // This call bypasses the authenticated Retrofit clients (and their
            // AuthAuthenticator), so an access token that expired since login
            // never gets its usual silent refresh — do it once here instead
            // of failing a change that would otherwise succeed on retry.
            if (response.code == 401) {
                response.close()
                token = refreshAccessToken()
                    ?: return@withContext PasswordChangeResult.Failure("Your session expired — please log in again")
                response = callWith(token)
            }

            val changeSucceeded = response.use { res ->
                val json = try { JSONObject(res.body?.string() ?: "{}") } catch (e: Exception) { JSONObject() }
                if (res.isSuccessful) {
                    true
                } else {
                    return@withContext PasswordChangeResult.Failure(json.optString("error").ifBlank { "Failed to set new password" })
                }
            }

            if (changeSucceeded) {
                tokenStore.mustChangePassword = false

                // Keep the remembered password in sync so re-login after
                // logout keeps working with the new password.
                if (tokenStore.savedLoginId != null) {
                    tokenStore.savedPassword = newPassword
                }

                // Supabase revokes the account's existing sessions when its
                // password changes — the token this request just used to
                // authenticate is already dead. Sign in fresh with the new
                // password so the app keeps a live session instead of every
                // call after this one failing with a stale-token 401.
                val email = tokenStore.employeeEmail
                val grantResponse = if (email != null) {
                    try {
                        authApi.passwordGrant(apikey = apiKey, body = PasswordGrantRequest(email, newPassword))
                    } catch (e: Exception) {
                        null
                    }
                } else null
                val grantBody = grantResponse?.body()

                if (grantResponse?.isSuccessful == true && grantBody?.accessToken != null) {
                    tokenStore.accessToken = grantBody.accessToken
                    tokenStore.refreshToken = grantBody.refreshToken
                } else {
                    // Couldn't get a fresh session — the old one is dead
                    // regardless (Supabase revokes it on password change),
                    // so leaving stale tokens in place would just crash the
                    // next authenticated call instead of prompting a clean
                    // re-login. The new password IS saved; this only means
                    // they must sign in with it.
                    tokenStore.accessToken = null
                    tokenStore.refreshToken = null
                    SessionEvents.notifyExpired()
                }
            }
            PasswordChangeResult.Success
        } catch (e: Exception) {
            Log.e(TAG, "changePassword failed: ${e.javaClass.simpleName}: ${e.message}")
            PasswordChangeResult.Failure(e.message ?: "Network error while setting new password")
        }
    }

    /** Called by the network layer on a 401 — attempts a silent refresh. Returns the new access token, or null if the session is dead and the user must log in again. */
    /**
     * Supabase rotates the refresh token on every use — it's single-use.
     * Several call sites hit 401 around the same moment (the Retrofit
     * clients' own AuthAuthenticator, plus manual retries in
     * PhotoUploader/StaffRepository for calls that bypass it), and
     * without this mutex each would fire its own refresh request with the
     * SAME now-shared refresh token: the first swaps it for a new pair,
     * every other concurrent attempt then gets rejected as reusing an
     * already-spent token — which looked like a dead session and forced a
     * real logout even though the access token was perfectly refreshable.
     * Concurrent callers now await one shared in-flight refresh instead.
     */
    private val refreshMutex = Mutex()
    @Volatile private var inFlightRefresh: Deferred<String?>? = null

    suspend fun refreshAccessToken(): String? = coroutineScope {
        val deferred = refreshMutex.withLock {
            inFlightRefresh?.takeIf { it.isActive } ?: async { doRefreshAccessToken() }.also { inFlightRefresh = it }
        }
        deferred.await()
    }

    private suspend fun doRefreshAccessToken(): String? {
        val refreshToken = tokenStore.refreshToken ?: return null
        val response = try {
            authApi.refreshGrant(apikey = apiKey, body = RefreshGrantRequest(refreshToken))
        } catch (e: Exception) {
            return null
        }
        val body = response.body()
        if (!response.isSuccessful || body?.accessToken == null) {
            return null
        }
        tokenStore.accessToken = body.accessToken
        tokenStore.refreshToken = body.refreshToken ?: refreshToken
        return body.accessToken
    }

    fun currentAccessToken(): String? = tokenStore.accessToken

    fun logout() {
        tokenStore.clearSession()
        _employeePhotoUrlFlow.value = null
        _canViewRosterAttendanceFlow.value = false
    }

    private companion object {
        const val TAG = "AuthRepository"
    }
}
