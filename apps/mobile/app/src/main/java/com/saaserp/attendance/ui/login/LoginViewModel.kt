package com.saaserp.attendance.ui.login

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.saaserp.attendance.data.auth.AuthResult
import com.saaserp.attendance.di.ServiceLocator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val rememberMe: Boolean = true,
    val isLoading: Boolean = false,
    val error: String? = null,
    val loggedIn: Boolean = false,
    val mustChangePassword: Boolean = false,
    val showForgotPassword: Boolean = false,
    val forgotIdentifier: String = "",
    val forgotSubmitting: Boolean = false,
    val forgotSent: Boolean = false,
    /** Inline error inside the Forgot dialog (e.g. no such account). */
    val forgotError: String? = null,
    /** This device's last password-reset request, if any — drives the status card. */
    val resetRequest: com.saaserp.attendance.data.auth.ResetRequest? = null,
    val resetRefreshing: Boolean = false,
)

class LoginViewModel(application: Application) : AndroidViewModel(application) {
    private val authRepository = ServiceLocator.authRepository(application)

    // Prefill the last remembered credentials so a logged-out employee signs
    // straight back in with one tap.
    private val _uiState = MutableStateFlow(
        LoginUiState(
            email = authRepository.rememberedLoginId ?: "",
            password = authRepository.rememberedPassword ?: "",
            loggedIn = authRepository.isLoggedIn,
            resetRequest = authRepository.currentResetRequest(),
        )
    )
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    init {
        // Coming back to the login screen: catch up on a decision made while the app was closed.
        if (authRepository.currentResetRequest()?.status == "pending") refreshResetRequest()
    }

    fun refreshResetRequest() {
        _uiState.value = _uiState.value.copy(resetRefreshing = true)
        viewModelScope.launch {
            val updated = authRepository.refreshResetRequest()
            com.saaserp.attendance.sync.ResetRequestWorker.notifyIfResolved(getApplication())
            _uiState.value = _uiState.value.copy(resetRequest = authRepository.currentResetRequest() ?: updated, resetRefreshing = false)
        }
    }

    fun dismissResetRequest() {
        authRepository.clearResetRequest()
        _uiState.value = _uiState.value.copy(resetRequest = null)
    }

    fun onEmailChange(value: String) {
        val current = _uiState.value
        val savedId = authRepository.rememberedLoginId?.trim()
        val syncedPassword = when {
            savedId != null && value.trim() == savedId ->
                authRepository.rememberedPassword ?: current.password
            current.email.trim() == savedId ->
                // Typed away from the remembered account — drop its password
                // so another user's id never submits with a stale password.
                ""
            else -> current.password
        }
        _uiState.value = current.copy(email = value, password = syncedPassword, error = null)
    }

    fun onRememberMeChange(checked: Boolean) {
        _uiState.value = _uiState.value.copy(rememberMe = checked)
    }

    fun onPasswordChange(value: String) {
        _uiState.value = _uiState.value.copy(password = value, error = null)
    }

    fun login() {
        val state = _uiState.value
        val cleanEmail = state.email.trim()
        val cleanPassword = state.password

        if (cleanEmail.isBlank() || cleanPassword.isBlank()) {
            _uiState.value = state.copy(error = "Enter both email/phone and password")
            return
        }

        // Accepts either an email or a phone number — AuthRepository resolves
        // a phone to the real account email before signing in.
        val looksLikeEmail = android.util.Patterns.EMAIL_ADDRESS.matcher(cleanEmail).matches()
        val digitsOnly = cleanEmail.filter { it.isDigit() }
        val looksLikePhone = digitsOnly.length in 10..13
        if (!looksLikeEmail && !looksLikePhone) {
            _uiState.value = state.copy(error = "Enter a valid email or phone number")
            return
        }

        _uiState.value = state.copy(email = cleanEmail, isLoading = true, error = null)
        viewModelScope.launch {
            when (val result = authRepository.login(cleanEmail, cleanPassword)) {
                is AuthResult.Success -> {
                    // Persist (or drop) the credentials per the toggle so the
                    // next logout lands back here ready for one-tap sign-in.
                    if (_uiState.value.rememberMe) {
                        authRepository.rememberCredentials(cleanEmail, cleanPassword)
                    } else {
                        authRepository.forgetCredentials()
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        loggedIn = true,
                        mustChangePassword = result.mustChangePassword,
                    )
                }
                is AuthResult.Failure -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, error = result.message)
                }
            }
        }
    }

    fun openForgotPassword() {
        _uiState.value = _uiState.value.copy(showForgotPassword = true, forgotIdentifier = _uiState.value.email, forgotSent = false, forgotError = null)
    }

    fun dismissForgotPassword() {
        _uiState.value = _uiState.value.copy(showForgotPassword = false, forgotIdentifier = "", forgotSent = false, forgotError = null)
    }

    fun onForgotIdentifierChange(value: String) {
        _uiState.value = _uiState.value.copy(forgotIdentifier = value, forgotError = null)
    }

    fun submitForgotPassword() {
        val identifier = _uiState.value.forgotIdentifier.trim()
        if (identifier.isBlank()) return
        _uiState.value = _uiState.value.copy(forgotSubmitting = true, forgotError = null)
        viewModelScope.launch {
            when (val result = authRepository.requestPasswordReset(identifier)) {
                is com.saaserp.attendance.data.auth.ResetRequestResult.Sent -> {
                    com.saaserp.attendance.sync.ResetRequestWorker.schedule(getApplication())
                    _uiState.value = _uiState.value.copy(forgotSubmitting = false, forgotSent = true, resetRequest = result.request)
                }
                // Unknown account: rejected instantly, nothing was sent to the admin.
                is com.saaserp.attendance.data.auth.ResetRequestResult.NotFound ->
                    _uiState.value = _uiState.value.copy(forgotSubmitting = false, forgotError = result.message)
                is com.saaserp.attendance.data.auth.ResetRequestResult.Error ->
                    _uiState.value = _uiState.value.copy(forgotSubmitting = false, forgotError = result.message)
            }
        }
    }
}
