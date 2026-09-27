package com.saaserp.attendance.ui.profile

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.saaserp.attendance.data.remote.StaffDto
import com.saaserp.attendance.data.remote.UpdateStaffRequestDto
import com.saaserp.attendance.data.repository.StaffRepository
import com.saaserp.attendance.data.repository.ProfileResult
import com.saaserp.attendance.di.ServiceLocator
import com.saaserp.attendance.util.UrlResolver
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfileUiState(
    val isLoading: Boolean = true,
    val isSaving: Boolean = false,
    val isUploadingPhoto: Boolean = false,
    val name: String = "",
    val designation: String = "",
    val department: String = "",
    val subject: String = "",
    val nationalCode: String = "",
    val dateOfJoining: String = "",
    val phone: String = "",
    val email: String = "",
    val qualification: String = "",
    val experienceYears: String = "",
    val address: String = "",
    val bio: String = "",
    val photoUrl: String? = null,
    val fieldErrors: Map<String, String> = emptyMap(),
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val isDirty: Boolean = false,
)

class ProfileViewModel(
    private val staffRepository: StaffRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private var initialLoadedState: ProfileUiState? = null

    init {
        loadProfile()
    }

    fun loadProfile() {
        val cached = staffRepository.getCachedStaff()
        if (cached != null) {
            val resolvedPhoto = UrlResolver.resolve(cached.photo_url)
            val cachedState = ProfileUiState(
                isLoading = false,
                name = cached.name,
                designation = cached.designation,
                department = cached.department,
                subject = cached.subject ?: "",
                nationalCode = cached.national_code ?: "",
                dateOfJoining = cached.date_of_joining ?: "",
                phone = cached.phone ?: "",
                email = cached.email ?: "",
                qualification = cached.qualification,
                experienceYears = cached.experience_years?.toString() ?: "",
                address = cached.address ?: "",
                bio = cached.bio ?: "",
                photoUrl = resolvedPhoto,
                isDirty = false,
            )
            initialLoadedState = cachedState
            _uiState.value = cachedState
        }

        viewModelScope.launch {
            if (cached == null) {
                _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            }
            when (val result = staffRepository.getMyProfile(forceRefresh = true)) {
                is ProfileResult.Success -> {
                    val f = result.data
                    val resolvedPhoto = UrlResolver.resolve(f.photo_url)
                    val loadedState = ProfileUiState(
                        isLoading = false,
                        name = f.name,
                        designation = f.designation,
                        department = f.department,
                        subject = f.subject ?: "",
                        nationalCode = f.national_code ?: "",
                        dateOfJoining = f.date_of_joining ?: "",
                        phone = f.phone ?: "",
                        email = f.email ?: "",
                        qualification = f.qualification,
                        experienceYears = f.experience_years?.toString() ?: "",
                        address = f.address ?: "",
                        bio = f.bio ?: "",
                        photoUrl = resolvedPhoto,
                        isDirty = false,
                    )
                    initialLoadedState = loadedState
                    _uiState.value = loadedState
                }
                is ProfileResult.Error -> {
                    if (cached == null) {
                        _uiState.update {
                            it.copy(isLoading = false, errorMessage = result.message)
                        }
                    }
                }
            }
        }
    }

    fun onNameChanged(v: String) = updateField("name", v) { it.copy(name = v) }
    fun onDesignationChanged(v: String) = updateField("designation", v) { it.copy(designation = v) }
    fun onDepartmentChanged(v: String) = updateField("department", v) { it.copy(department = v) }
    fun onSubjectChanged(v: String) = updateField("subject", v) { it.copy(subject = v) }
    fun onNationalCodeChanged(v: String) = updateField("nationalCode", v) { it.copy(nationalCode = v.uppercase()) }
    fun onDateOfJoiningChanged(v: String) = updateField("dateOfJoining", v) { it.copy(dateOfJoining = v) }
    fun onPhoneChanged(v: String) {
        val digitsOnly = v.filter { it.isDigit() }.take(10)
        updateField("phone", digitsOnly) { it.copy(phone = digitsOnly) }
    }
    fun onEmailChanged(v: String) = updateField("email", v) { it.copy(email = v) }
    fun onQualificationChanged(v: String) = updateField("qualification", v) { it.copy(qualification = v) }
    fun onExperienceYearsChanged(v: String) = updateField("experienceYears", v) { it.copy(experienceYears = v) }
    fun onAddressChanged(v: String) = updateField("address", v) { it.copy(address = v) }
    fun onBioChanged(v: String) = updateField("bio", v) { it.copy(bio = v) }

    private fun updateField(key: String, value: String, updater: (ProfileUiState) -> ProfileUiState) {
        _uiState.update { state ->
            val updated = updater(state)
            val newErrors = updated.fieldErrors.toMutableMap()
            newErrors.remove(key)
            val dirty = checkIsDirty(updated)
            updated.copy(fieldErrors = newErrors, errorMessage = null, successMessage = null, isDirty = dirty)
        }
    }

    private fun checkIsDirty(current: ProfileUiState): Boolean {
        val initial = initialLoadedState ?: return false
        return current.name != initial.name ||
                current.designation != initial.designation ||
                current.department != initial.department ||
                current.subject != initial.subject ||
                current.nationalCode != initial.nationalCode ||
                current.dateOfJoining != initial.dateOfJoining ||
                current.phone != initial.phone ||
                current.email != initial.email ||
                current.qualification != initial.qualification ||
                current.experienceYears != initial.experienceYears ||
                current.address != initial.address ||
                current.bio != initial.bio ||
                current.photoUrl != initial.photoUrl
    }

    fun resetChanges() {
        val initial = initialLoadedState ?: return
        _uiState.value = initial.copy(
            errorMessage = null,
            successMessage = "Changes discarded",
            isDirty = false,
        )
    }

    /**
     * Uploading used to only stage the new photo locally, telling the
     * employee to separately tap "Save Changes" to actually persist it —
     * in practice, staff walked away as soon as the upload spinner
     * finished, never noticing they still had to save. That left the
     * Staff Directory showing the old photo indefinitely even though
     * the file itself had uploaded fine. A photo change now saves
     * immediately, same as tapping Save Changes with just the photo
     * updated — any other fields save with it using whatever is
     * currently in the form (already-valid values loaded from the
     * server, or edits the employee was mid-typing).
     */
    fun uploadPhoto(localFilePath: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isUploadingPhoto = true, errorMessage = null) }
            when (val uploadResult = staffRepository.uploadPortrait(localFilePath)) {
                is ProfileResult.Success -> {
                    val resolved = UrlResolver.resolve(uploadResult.data) ?: uploadResult.data
                    val state = _uiState.value.copy(photoUrl = resolved)

                    val req = UpdateStaffRequestDto(
                        name = state.name.trim(),
                        designation = state.designation.trim(),
                        department = state.department.trim(),
                        qualification = state.qualification.trim(),
                        subject = state.subject.trim().ifBlank { null },
                        email = state.email.trim().ifBlank { null },
                        phone = state.phone.trim().ifBlank { null },
                        national_code = state.nationalCode.trim().ifBlank { null },
                        date_of_joining = state.dateOfJoining.trim().ifBlank { null },
                        experience_years = state.experienceYears.trim().toIntOrNull(),
                        bio = state.bio.trim().ifBlank { null },
                        photo_url = state.photoUrl,
                        address = state.address.trim().ifBlank { null },
                    )

                    when (val saveResult = staffRepository.updateMyProfile(req)) {
                        is ProfileResult.Success -> {
                            val updated = saveResult.data
                            val savedResolved = UrlResolver.resolve(updated.photo_url) ?: updated.photo_url
                            val savedState = state.copy(
                                isUploadingPhoto = false,
                                photoUrl = savedResolved,
                                successMessage = "Photo updated!",
                                isDirty = false,
                            )
                            initialLoadedState = savedState
                            _uiState.value = savedState
                        }
                        is ProfileResult.Error -> {
                            // The file uploaded fine — only the DB save failed — so
                            // keep the new photo staged locally and fall back to the
                            // old two-step flow rather than losing the upload.
                            _uiState.update {
                                val next = it.copy(
                                    isUploadingPhoto = false,
                                    photoUrl = resolved,
                                    errorMessage = "Photo uploaded but couldn't save automatically (${saveResult.message}). Tap 'Save Changes' to retry.",
                                )
                                next.copy(isDirty = checkIsDirty(next))
                            }
                        }
                    }
                }
                is ProfileResult.Error -> {
                    _uiState.update {
                        it.copy(isUploadingPhoto = false, errorMessage = uploadResult.message)
                    }
                }
            }
        }
    }

    fun saveProfile() {
        val state = _uiState.value
        val errors = mutableMapOf<String, String>()

        if (state.name.isBlank()) errors["name"] = "Full Name is required"
        if (state.designation.isBlank()) errors["designation"] = "Designation is required"
        if (state.department.isBlank()) errors["department"] = "Department is required"
        if (state.qualification.isBlank()) errors["qualification"] = "Qualification is required"

        if (state.phone.isNotBlank()) {
            val digits = state.phone.replace(Regex("[\\s\\-\\(\\)\\.]"), "")
            if (!digits.matches(Regex("^(?:\\+91|0)?[6-9]\\d{9}$"))) {
                errors["phone"] = "Enter a valid 10-digit mobile number"
            }
        }

        if (state.email.isNotBlank() && !state.email.matches(Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"))) {
            errors["email"] = "Enter a valid email address"
        }

        if (state.experienceYears.isNotBlank()) {
            val exp = state.experienceYears.toIntOrNull()
            if (exp == null || exp < 0 || exp > 60) {
                errors["experienceYears"] = "Experience must be 0 to 60 years"
            }
        }

        if (errors.isNotEmpty()) {
            _uiState.update { it.copy(fieldErrors = errors, errorMessage = "Please fix highlighted fields") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, errorMessage = null, successMessage = null) }

            val req = UpdateStaffRequestDto(
                name = state.name.trim(),
                designation = state.designation.trim(),
                department = state.department.trim(),
                qualification = state.qualification.trim(),
                subject = state.subject.trim().ifBlank { null },
                email = state.email.trim().ifBlank { null },
                phone = state.phone.trim().ifBlank { null },
                national_code = state.nationalCode.trim().ifBlank { null },
                date_of_joining = state.dateOfJoining.trim().ifBlank { null },
                experience_years = state.experienceYears.trim().toIntOrNull(),
                bio = state.bio.trim().ifBlank { null },
                photo_url = state.photoUrl,
                address = state.address.trim().ifBlank { null },
            )

            when (val result = staffRepository.updateMyProfile(req)) {
                is ProfileResult.Success -> {
                    val updated = result.data
                    val resolved = UrlResolver.resolve(updated.photo_url) ?: updated.photo_url
                    val savedState = state.copy(
                        isSaving = false,
                        photoUrl = resolved,
                        successMessage = "Profile updated successfully!",
                        errorMessage = null,
                        isDirty = false,
                    )
                    initialLoadedState = savedState
                    _uiState.value = savedState
                }
                is ProfileResult.Error -> {
                    _uiState.update {
                        it.copy(isSaving = false, errorMessage = result.message)
                    }
                }
            }
        }
    }

    fun clearMessages() {
        _uiState.update { it.copy(errorMessage = null, successMessage = null) }
    }

    companion object {
        fun provideFactory(context: Context): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return ProfileViewModel(
                        staffRepository = ServiceLocator.staffRepository(context),
                    ) as T
                }
            }
    }
}
