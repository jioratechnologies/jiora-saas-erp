package com.saaserp.attendance.ui.setpassword

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.saaserp.attendance.data.auth.PasswordChangeResult
import com.saaserp.attendance.di.ServiceLocator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SetPasswordUiState(
    val currentPassword: String = "",
    val newPassword: String = "",
    val confirmPassword: String = "",
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val done: Boolean = false,
)

class SetPasswordViewModel(application: Application) : AndroidViewModel(application) {
    private val authRepository = ServiceLocator.authRepository(application)

    private val _uiState = MutableStateFlow(SetPasswordUiState())
    val uiState: StateFlow<SetPasswordUiState> = _uiState.asStateFlow()

    fun onCurrentPasswordChange(value: String) {
        _uiState.value = _uiState.value.copy(currentPassword = value, error = null)
    }

    fun onNewPasswordChange(value: String) {
        _uiState.value = _uiState.value.copy(newPassword = value, error = null)
    }

    fun onConfirmPasswordChange(value: String) {
        _uiState.value = _uiState.value.copy(confirmPassword = value, error = null)
    }

    fun submit() {
        val state = _uiState.value
        if (state.newPassword.length < 6) {
            _uiState.value = state.copy(error = "New password must be at least 6 characters")
            return
        }
        if (state.newPassword != state.confirmPassword) {
            _uiState.value = state.copy(error = "New password and confirmation don't match")
            return
        }
        if (state.newPassword == state.currentPassword) {
            _uiState.value = state.copy(error = "New password must be different from your current one")
            return
        }

        _uiState.value = state.copy(isSubmitting = true, error = null)
        viewModelScope.launch {
            when (val result = authRepository.changePassword(state.currentPassword, state.newPassword)) {
                is PasswordChangeResult.Success -> {
                    _uiState.value = _uiState.value.copy(isSubmitting = false, done = true)
                }
                is PasswordChangeResult.Failure -> {
                    _uiState.value = _uiState.value.copy(isSubmitting = false, error = result.message)
                }
            }
        }
    }
}
