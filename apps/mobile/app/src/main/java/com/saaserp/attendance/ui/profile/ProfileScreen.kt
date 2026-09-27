package com.saaserp.attendance.ui.profile

import android.app.DatePickerDialog
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Organization
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Work
import com.saaserp.attendance.util.BiometricLockHelper
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import com.saaserp.attendance.ui.tour.coachTarget
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import com.saaserp.attendance.data.auth.PasswordChangeResult
import com.saaserp.attendance.di.ServiceLocator
import com.saaserp.attendance.ui.components.GlassSurface
import com.saaserp.attendance.ui.components.ImageCropDialog
import com.saaserp.attendance.ui.theme.AmberGold
import com.saaserp.attendance.ui.theme.DarkDialogSurface
import com.saaserp.attendance.ui.theme.DarkFloatingBar
import com.saaserp.attendance.ui.theme.DarkIconButtonBg
import com.saaserp.attendance.ui.theme.LightCreamCard
import com.saaserp.attendance.ui.theme.LightDialogCream
import com.saaserp.attendance.ui.theme.Saffron500
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.util.s
import kotlinx.coroutines.launch
import java.io.File
import java.util.Calendar
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onNavigateBack: () -> Unit,
    onLoggedOut: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProfileViewModel = viewModel(factory = ProfileViewModel.provideFactory(LocalContext.current)),
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val isDark = isSystemInDarkTheme()
    val scrollState = rememberScrollState()

    var showLogoutDialog by remember { mutableStateOf(false) }
    var showPhotoOptionsSheet by remember { mutableStateOf(false) }
    var showCropDialog by remember { mutableStateOf(false) }
    var cropSourceUri by remember { mutableStateOf<Uri?>(null) }
    var tempCameraImageUri by remember { mutableStateOf<Uri?>(null) }
    var showUnsavedDialog by remember { mutableStateOf(false) }

    // Intercept hardware and gesture back if there are unsaved changes
    BackHandler(enabled = state.isDirty) {
        showUnsavedDialog = true
    }

    // Launcher for Gallery Picker
    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia(),
    ) { uri: Uri? ->
        if (uri != null) {
            cropSourceUri = uri
            showCropDialog = true
        }
    }

    // Launcher for Camera Capture
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture(),
    ) { success: Boolean ->
        if (success && tempCameraImageUri != null) {
            cropSourceUri = tempCameraImageUri
            showCropDialog = true
        }
    }

    var showJoiningDatePicker by remember { mutableStateOf(false) }

    if (showJoiningDatePicker) {
        com.saaserp.attendance.ui.components.AppDatePickerDialog(
            title = s("Date of joining", "नियुक्ति की तिथि"),
            initial = runCatching { java.time.LocalDate.parse(state.dateOfJoining) }.getOrNull(),
            maxDate = java.time.LocalDate.now(),
            onConfirm = { viewModel.onDateOfJoiningChanged(it.toString()); showJoiningDatePicker = false },
            onDismiss = { showJoiningDatePicker = false },
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding(),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(
                    onClick = {
                        if (state.isDirty) {
                            showUnsavedDialog = true
                        } else {
                            onNavigateBack()
                        }
                    },
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(
                            if (isDark) DarkIconButtonBg else LightCreamCard
                        )
                        .border(1.dp, Saffron500.copy(alpha = 0.3f), CircleShape),
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = MaterialTheme.colorScheme.onBackground,
                    )
                }

                Spacer(Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        s("Edit Staff Profile", "फैकल्टी प्रोफ़ाइल संपादित करें"),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    Text(
                        if (state.isDirty) s("● Unsaved Changes", "● असहेजे परिवर्तन") else s("Official Roster & Self-Service", "आधिकारिक रोस्टर एवं स्व-सेवा"),
                        style = MaterialTheme.typography.bodySmall,
                        color = if (state.isDirty) AmberGold else Saffron600,
                        fontWeight = FontWeight.SemiBold,
                    )
                }

                IconButton(
                    onClick = { viewModel.loadProfile() },
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(
                            if (isDark) DarkIconButtonBg else LightCreamCard
                        ),
                ) {
                    Icon(
                        Icons.Filled.Refresh,
                        contentDescription = "Refresh",
                        tint = Saffron600,
                    )
                }

                Spacer(Modifier.width(8.dp))

                IconButton(
                    onClick = { showLogoutDialog = true },
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(
                            if (isDark) DarkIconButtonBg else LightCreamCard
                        ),
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.Logout,
                        contentDescription = "Log Out",
                        tint = Color(0xFFEF4444),
                    )
                }
            }

            if (state.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .weight(1f),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Saffron600)
                        Spacer(Modifier.height(14.dp))
                        Text(
                            s("Loading profile details...", "प्रोफ़ाइल विवरण लोड हो रहा है..."),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            } else {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(scrollState)
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                ) {
                    // Success Banner
                    AnimatedVisibility(
                        visible = state.successMessage != null,
                        enter = fadeIn() + expandVertically(),
                        exit = fadeOut() + shrinkVertically(),
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0xFF10B981).copy(alpha = 0.15f))
                                .border(1.dp, Color(0xFF10B981).copy(alpha = 0.45f), RoundedCornerShape(16.dp))
                                .padding(14.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Filled.CheckCircle,
                                    contentDescription = null,
                                    tint = Color(0xFF10B981),
                                    modifier = Modifier.size(20.dp),
                                )
                                Spacer(Modifier.width(10.dp))
                                Text(
                                    state.successMessage ?: "",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF10B981),
                                )
                            }
                        }
                    }

                    // Error Banner
                    AnimatedVisibility(
                        visible = state.errorMessage != null,
                        enter = fadeIn() + expandVertically(),
                        exit = fadeOut() + shrinkVertically(),
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0xFFEF4444).copy(alpha = 0.15f))
                                .border(1.dp, Color(0xFFEF4444).copy(alpha = 0.45f), RoundedCornerShape(16.dp))
                                .padding(14.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Filled.Error,
                                    contentDescription = null,
                                    tint = Color(0xFFEF4444),
                                    modifier = Modifier.size(20.dp),
                                )
                                Spacer(Modifier.width(10.dp))
                                Text(
                                    state.errorMessage ?: "",
                                    style = MaterialTheme.typography.bodySmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFFEF4444),
                                )
                            }
                        }
                    }

                    // Photo Card & Avatar Section (single padding layer: the inner
                    // Column owns the 20.dp inset so no double glass band shows).
                    GlassSurface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(24.dp),
                        contentPadding = 0.dp,
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(116.dp)
                                    .clip(CircleShape)
                                    .border(
                                        2.5.dp,
                                        Brush.linearGradient(listOf(Saffron500, AmberGold)),
                                        CircleShape,
                                    )
                                    .shadow(10.dp, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                if (!state.photoUrl.isNullOrBlank()) {
                                    SubcomposeAsyncImage(
                                        model = ImageRequest.Builder(context)
                                            .data(com.saaserp.attendance.util.UrlResolver.toCoilModel(state.photoUrl))
                                            .crossfade(true)
                                            .build(),
                                        contentDescription = "Staff Photo",
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize(),
                                        loading = {
                                            Box(
                                                modifier = Modifier.fillMaxSize().background(Color(0xFF2C1D15)),
                                                contentAlignment = Alignment.Center,
                                            ) {
                                                CircularProgressIndicator(color = Saffron500, modifier = Modifier.size(24.dp))
                                            }
                                        },
                                        error = {
                                            InitialsAvatarFallback(state.name)
                                        },
                                    )
                                } else {
                                    InitialsAvatarFallback(state.name)
                                }

                                if (state.isUploadingPhoto) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .background(Color.Black.copy(alpha = 0.65f)),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        CircularProgressIndicator(
                                            color = Saffron500,
                                            modifier = Modifier.size(32.dp),
                                        )
                                    }
                                }
                            }

                            Spacer(Modifier.height(14.dp))

                            Button(
                                onClick = { showPhotoOptionsSheet = true },
                                modifier = Modifier.coachTarget("profile_photo"),
                                enabled = !state.isUploadingPhoto,
                                shape = RoundedCornerShape(20.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Saffron600,
                                    contentColor = Color.White,
                                ),
                                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
                            ) {
                                Icon(
                                    Icons.Filled.CameraAlt,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp),
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    s("Change Photo", "फोटो बदलें"),
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(20.dp))

                    // SECTION 1: Personal & Academic Identity
                    SectionHeader(s("Personal & Academic Identity", "व्यक्तिगत एवं शैक्षणिक पहचान"), Icons.Filled.Person)
                    Spacer(Modifier.height(10.dp))

                    ProfileInputField(
                        label = s("Full Name *", "पूरा नाम *"),
                        value = state.name,
                        onValueChange = { viewModel.onNameChanged(it) },
                        error = state.fieldErrors["name"],
                        placeholder = "e.g. Dr. Suraj Deo",
                        icon = Icons.Filled.Person,
                    )

                    Spacer(Modifier.height(12.dp))

                    ProfileInputField(
                        label = s("Designation *", "पदनाम *"),
                        value = state.designation,
                        onValueChange = { viewModel.onDesignationChanged(it) },
                        error = state.fieldErrors["designation"],
                        placeholder = "e.g. Senior Staff / Vice Principal",
                        icon = Icons.Filled.Work,
                    )

                    Spacer(Modifier.height(12.dp))

                    ProfileInputField(
                        label = s("Department *", "विभाग *"),
                        value = state.department,
                        onValueChange = { viewModel.onDepartmentChanged(it) },
                        error = state.fieldErrors["department"],
                        placeholder = "e.g. Science & Mathematics",
                        icon = Icons.Filled.Organization,
                    )

                    Spacer(Modifier.height(12.dp))

                    ProfileInputField(
                        label = s("Subject Specialization", "विषय विशेषज्ञता"),
                        value = state.subject,
                        onValueChange = { viewModel.onSubjectChanged(it) },
                        placeholder = "e.g. Physics & Applied Mathematics",
                        icon = Icons.Filled.Organization,
                    )

                    Spacer(Modifier.height(12.dp))

                    ProfileInputField(
                        label = s("Qualification *", "योग्यता *"),
                        value = state.qualification,
                        onValueChange = { viewModel.onQualificationChanged(it) },
                        error = state.fieldErrors["qualification"],
                        placeholder = "e.g. M.Sc. (Physics), B.Ed.",
                        icon = Icons.Filled.Organization,
                    )

                    Spacer(Modifier.height(12.dp))

                    ProfileInputField(
                        label = s("Teaching Experience (Years)", "शिक्षण अनुभव (वर्ष)"),
                        value = state.experienceYears,
                        onValueChange = { viewModel.onExperienceYearsChanged(it) },
                        error = state.fieldErrors["experienceYears"],
                        placeholder = "e.g. 8",
                        keyboardType = KeyboardType.Number,
                        icon = Icons.Filled.Work,
                    )

                    Spacer(Modifier.height(24.dp))

                    // SECTION 2: Official Organization Record & Verification
                    SectionHeader(s("Official Record & Verification", "आधिकारिक रिकॉर्ड एवं सत्यापन"), Icons.Filled.Badge)
                    Spacer(Modifier.height(10.dp))

                    ProfileInputField(
                        label = s("National Code (ID / Reg.)", "राष्ट्रीय कोड (आईडी / पंजी.)"),
                        value = state.nationalCode,
                        onValueChange = { viewModel.onNationalCodeChanged(it) },
                        placeholder = "e.g. TP38441240 / TR16357447",
                        icon = Icons.Filled.Badge,
                    )

                    Spacer(Modifier.height(12.dp))

                    // Date of Joining with Picker
                    Column {
                        Text(
                            s("Date of Joining (Calendar)", "नियुक्ति तिथि (कैलेंडर)"),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground,
                            modifier = Modifier.padding(bottom = 6.dp),
                        )
                        OutlinedTextField(
                            value = state.dateOfJoining.ifBlank { s("Tap to select date...", "तिथि चुनने हेतु टैप करें...") },
                            onValueChange = {},
                            readOnly = true,
                            enabled = true,
                            trailingIcon = {
                                IconButton(onClick = { showJoiningDatePicker = true }) {
                                    Icon(Icons.Filled.CalendarMonth, contentDescription = "Pick Date", tint = Saffron600)
                                }
                            },
                            leadingIcon = {
                                Icon(Icons.Filled.CalendarMonth, contentDescription = null, tint = Saffron600)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { showJoiningDatePicker = true },
                            shape = RoundedCornerShape(14.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Saffron600,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f),
                            ),
                        )
                    }

                    Spacer(Modifier.height(12.dp))

                    // SECTION 3: Contact & Communication
                    SectionHeader(s("Contact & Communication", "संपर्क एवं संचार"), Icons.Filled.Phone)
                    Spacer(Modifier.height(10.dp))

                    Box(modifier = Modifier.coachTarget("profile_contact")) {
                    ProfileInputField(
                        label = s("Mobile / Phone Number", "मोबाइल / फ़ोन नंबर"),
                        value = state.phone,
                        onValueChange = { viewModel.onPhoneChanged(it) },
                        error = state.fieldErrors["phone"],
                        placeholder = "e.g. 9876543210 or +91 98765 43210",
                        keyboardType = KeyboardType.Phone,
                        icon = Icons.Filled.Phone,
                    )
                    }

                    Spacer(Modifier.height(12.dp))

                    ProfileInputField(
                        label = s("Email", "ईमेल"),
                        value = state.email,
                        onValueChange = { viewModel.onEmailChanged(it) },
                        error = state.fieldErrors["email"],
                        placeholder = "e.g. name@dspsupaul.com",
                        keyboardType = KeyboardType.Email,
                        icon = Icons.Filled.Email,
                    )

                    Spacer(Modifier.height(12.dp))

                    ProfileInputField(
                        label = s("Residential / Correspondence Address", "आवासीय / पत्राचार पता"),
                        value = state.address,
                        onValueChange = { viewModel.onAddressChanged(it) },
                        placeholder = "e.g. Bhawanipur, Sitapur, Supaul",
                        icon = Icons.Filled.Home,
                        singleLine = false,
                        maxLines = 3,
                    )

                    Spacer(Modifier.height(12.dp))

                    ProfileInputField(
                        label = s("Professional Bio / Vision Message", "व्यावसायिक बायो / विज़न संदेश"),
                        value = state.bio,
                        onValueChange = { viewModel.onBioChanged(it) },
                        placeholder = "e.g. Passionate educator dedicated to conceptual learning...",
                        icon = Icons.Filled.Info,
                        singleLine = false,
                        maxLines = 4,
                    )

                    Spacer(Modifier.height(24.dp))

                    // SECTION 4: Security & App Privacy
                    SectionHeader(s("Security & App Privacy", "सुरक्षा एवं ऐप गोपनीयता"), Icons.Filled.Security)
                    Spacer(Modifier.height(10.dp))

                    val authRepo = remember { com.saaserp.attendance.di.ServiceLocator.authRepository(context) }
                    var appLockEnabled by remember { mutableStateOf(authRepo.isAppLockEnabled) }
                    var securityWarningMsg by remember { mutableStateOf<String?>(null) }

                    GlassSurface(
                        modifier = Modifier.fillMaxWidth().coachTarget("profile_biometric"),
                        shape = RoundedCornerShape(16.dp),
                        contentPadding = 0.dp,
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f),
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(CircleShape)
                                            .background(
                                                if (appLockEnabled) Saffron500.copy(alpha = 0.2f) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f)
                                            ),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Icon(
                                            Icons.Filled.Fingerprint,
                                            contentDescription = null,
                                            tint = if (appLockEnabled) Saffron600 else MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.size(24.dp),
                                        )
                                    }
                                    Spacer(Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            s("Biometric & Screen Lock", "बायोमेट्रिक एवं स्क्रीन लॉक"),
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.onBackground,
                                        )
                                        Text(
                                            if (appLockEnabled) s("App is protected with device fingerprint / PIN", "ऐप डिवाइस फ़िंगरप्रिंट / पिन से सुरक्षित है") else s("Require fingerprint / PIN when opening app", "ऐप खोलते समय फ़िंगरप्रिंट / पिन आवश्यक करें"),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }

                                androidx.compose.material3.Switch(
                                    checked = appLockEnabled,
                                    onCheckedChange = { enable ->
                                        if (enable) {
                                            val activity = context as? androidx.fragment.app.FragmentActivity
                                            if (activity != null) {
                                                if (BiometricLockHelper.isDeviceSecurityAvailable(context)) {
                                                    BiometricLockHelper.showBiometricPrompt(
                                                        activity = activity,
                                                        title = "Enable SaaS ERP App Lock",
                                                        subtitle = "Verify fingerprint or PIN to enable privacy lock",
                                                        onSuccess = {
                                                            authRepo.setAppLockEnabled(true)
                                                            appLockEnabled = true
                                                            securityWarningMsg = null
                                                        },
                                                        onError = { err ->
                                                            securityWarningMsg = "Verification cancelled: $err"
                                                        }
                                                    )
                                                } else {
                                                    securityWarningMsg = "No fingerprint or screen lock enrolled. Set a lock in Android Settings first."
                                                }
                                            } else {
                                                authRepo.setAppLockEnabled(true)
                                                appLockEnabled = true
                                            }
                                        } else {
                                            authRepo.setAppLockEnabled(false)
                                            appLockEnabled = false
                                            securityWarningMsg = null
                                        }
                                    },
                                    colors = androidx.compose.material3.SwitchDefaults.colors(
                                        checkedThumbColor = Color.White,
                                        checkedTrackColor = Saffron600,
                                        uncheckedThumbColor = MaterialTheme.colorScheme.outline,
                                        uncheckedTrackColor = MaterialTheme.colorScheme.surfaceVariant,
                                    ),
                                )
                            }

                            if (securityWarningMsg != null) {
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    securityWarningMsg ?: "",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFFEF4444),
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    var showChangePasswordDialog by remember { mutableStateOf(false) }

                    GlassSurface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .coachTarget("profile_password")
                            .clickable { showChangePasswordDialog = true },
                        shape = RoundedCornerShape(16.dp),
                        contentPadding = 0.dp,
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(Saffron500.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    Icons.Filled.Lock,
                                    contentDescription = null,
                                    tint = Saffron600,
                                    modifier = Modifier.size(22.dp),
                                )
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    s("Change Password", "पासवर्ड बदलें"),
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onBackground,
                                )
                                Text(
                                    "Set a new password by verifying your current one",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    }

                    if (showChangePasswordDialog) {
                        ChangePasswordDialog(onDismiss = { showChangePasswordDialog = false })
                    }

                    Spacer(Modifier.height(90.dp))
                }
            }
        }

        // Floating Action Bar that AUTO-APPEARS when user makes any changes (isDirty = true)
        AnimatedVisibility(
            visible = state.isDirty,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    // Fully opaque and NO shadow layer: the old 0.96/0.98 alpha
                    // plus the 16.dp shadow composited a light strip
                    // behind/below the buttons on-device. The 1.5.dp saffron
                    // border alone defines the edge now — deterministic.
                    .background(if (isDark) DarkFloatingBar else LightCreamCard)
                    .border(1.5.dp, Saffron500.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedButton(
                    onClick = { viewModel.resetChanges() },
                    shape = RoundedCornerShape(14.dp),
                    // Explicit transparent container: shows the exact solid bar
                    // color, no M3 default compositing involved.
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = Color.Transparent,
                        contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    ),
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(Icons.Filled.Close, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(s("Discard", "हटाएं"), fontWeight = FontWeight.SemiBold)
                }

                Spacer(Modifier.width(12.dp))

                Button(
                    onClick = { viewModel.saveProfile() },
                    enabled = !state.isSaving && !state.isUploadingPhoto,
                    shape = RoundedCornerShape(14.dp),
                    // Solid brand fill while "Saving…" (M3's default disabled
                    // grey renders as a two-tone block on-device).
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Saffron600,
                        contentColor = Color.White,
                        disabledContainerColor = Saffron600,
                        disabledContentColor = Color.White,
                    ),
                    modifier = Modifier.weight(1.4f),
                ) {
                    if (state.isSaving) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(s("Saving...", "सहेजा जा रहा है..."), fontWeight = FontWeight.Bold)
                    } else {
                        Icon(Icons.Filled.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(s("Save Changes", "परिवर्तन सहेजें"), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Unsaved Changes Confirmation Dialog
        if (showUnsavedDialog) {
            AlertDialog(
                onDismissRequest = { showUnsavedDialog = false },
                icon = { Icon(Icons.Filled.Warning, contentDescription = null, tint = AmberGold, modifier = Modifier.size(32.dp)) },
                title = { Text(s("Unsaved Changes", "असहेजे परिवर्तन"), fontWeight = FontWeight.Bold) },
                text = {
                    Text(s("You have unsaved changes in your profile. Do you want to discard them and exit, or stay and keep editing?", "आपकी प्रोफ़ाइल में असहेजे परिवर्तन हैं। क्या उन्हें हटाकर बाहर जाना चाहते हैं, या संपादन जारी रखना चाहते हैं?"))
                },
                confirmButton = {
                    Button(
                        onClick = {
                            showUnsavedDialog = false
                            viewModel.resetChanges()
                            onNavigateBack()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                    ) {
                        Text(s("Discard & Exit", "हटाएं और बाहर जाएं"), color = Color.White, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    OutlinedButton(onClick = { showUnsavedDialog = false }) {
                        Text(s("Keep Editing", "संपादन जारी रखें"), fontWeight = FontWeight.SemiBold)
                    }
                },
                containerColor = if (isDark) DarkDialogSurface else LightDialogCream,
            )
        }

        // Logout Confirmation Dialog
        if (showLogoutDialog) {
            AlertDialog(
                onDismissRequest = { showLogoutDialog = false },
                icon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(32.dp)) },
                title = { Text(s("Log Out?", "लॉग आउट करें?"), fontWeight = FontWeight.Bold) },
                text = { Text(s("You'll need to sign in again to mark attendance or edit your profile.", "उपस्थिति दर्ज करने या प्रोफ़ाइल संपादित करने के लिए आपको फिर से साइन इन करना होगा।")) },
                confirmButton = {
                    Button(
                        onClick = {
                            showLogoutDialog = false
                            onLoggedOut()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                    ) {
                        Text(s("Log Out", "लॉग आउट"), color = Color.White, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    OutlinedButton(onClick = { showLogoutDialog = false }) {
                        Text(s("Cancel", "रद्द करें"), fontWeight = FontWeight.SemiBold)
                    }
                },
                containerColor = if (isDark) DarkDialogSurface else LightDialogCream,
            )
        }

        // Image Cropper Dialog
        if (showCropDialog && cropSourceUri != null) {
            ImageCropDialog(
                imageUri = cropSourceUri!!,
                onDismiss = { showCropDialog = false },
                onCropSuccess = { croppedFilePath ->
                    showCropDialog = false
                    viewModel.uploadPhoto(croppedFilePath)
                },
            )
        }

        // Photo Options Bottom Sheet
        if (showPhotoOptionsSheet) {
            ModalBottomSheet(
                onDismissRequest = { showPhotoOptionsSheet = false },
                containerColor = if (isDark) DarkDialogSurface else LightDialogCream,
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                ) {
                    Text(
                        "Change Profile Photo",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    Spacer(Modifier.height(18.dp))

                    // Take Photo with Camera
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .clickable {
                                showPhotoOptionsSheet = false
                                val photoFile = File(context.cacheDir, "camera_raw_${System.currentTimeMillis()}.jpg")
                                val uri = FileProvider.getUriForFile(
                                    context,
                                    "${context.packageName}.fileprovider",
                                    photoFile,
                                )
                                tempCameraImageUri = uri
                                cameraLauncher.launch(uri)
                            }
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Filled.CameraAlt, contentDescription = null, tint = Saffron600)
                        Spacer(Modifier.width(14.dp))
                        Text(
                            "Take Selfie / Photo with Camera",
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onBackground,
                        )
                    }

                    Spacer(Modifier.height(8.dp))

                    // Choose from Gallery
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .clickable {
                                showPhotoOptionsSheet = false
                                galleryLauncher.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            }
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Filled.PhotoLibrary, contentDescription = null, tint = Saffron600)
                        Spacer(Modifier.width(14.dp))
                        Text(
                            "Choose from Gallery / Photos",
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onBackground,
                        )
                    }

                    Spacer(Modifier.height(18.dp))
                }
            }
        }
    }
}

/** Self-service password change — verifies the current password server-side before accepting the new one, same endpoint the forced first-login gate uses. */
@Composable
private fun ChangePasswordDialog(onDismiss: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val authRepo = remember { ServiceLocator.authRepository(context) }

    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var currentVisible by remember { mutableStateOf(false) }
    var newVisible by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var done by remember { mutableStateOf(false) }

    fun submit() {
        error = null
        if (newPassword.length < 6) {
            error = "New password must be at least 6 characters"
            return
        }
        if (newPassword != confirmPassword) {
            error = "New password and confirmation don't match"
            return
        }
        if (newPassword == currentPassword) {
            error = "New password must be different from your current one"
            return
        }
        isSubmitting = true
        scope.launch {
            when (val result = authRepo.changePassword(currentPassword, newPassword)) {
                is PasswordChangeResult.Success -> {
                    isSubmitting = false
                    done = true
                }
                is PasswordChangeResult.Failure -> {
                    isSubmitting = false
                    error = result.message
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Filled.Lock, contentDescription = null, tint = Saffron600) },
        title = { Text(if (done) s("Password Updated", "पासवर्ड अपडेट किया गया") else s("Change Password", "पासवर्ड बदलें"), fontWeight = FontWeight.Bold) },
        text = {
            if (done) {
                Text(s("Your password has been updated. Use it the next time you sign in.", "आपका पासवर्ड अपडेट कर दिया गया है। अगली बार साइन इन करते समय इसका उपयोग करें।"))
            } else {
                Column {
                    OutlinedTextField(
                        value = currentPassword,
                        onValueChange = { currentPassword = it; error = null },
                        label = { Text(s("Current Password", "वर्तमान पासवर्ड")) },
                        singleLine = true,
                        visualTransformation = if (currentVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { currentVisible = !currentVisible }) {
                                Icon(if (currentVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, contentDescription = null)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it; error = null },
                        label = { Text(s("New Password", "नया पासवर्ड")) },
                        placeholder = { Text(s("At least 6 characters", "कम से कम 6 अक्षर")) },
                        singleLine = true,
                        visualTransformation = if (newVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { newVisible = !newVisible }) {
                                Icon(if (newVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility, contentDescription = null)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it; error = null },
                        label = { Text(s("Confirm New Password", "नया पासवर्ड पुनः दर्ज करें")) },
                        singleLine = true,
                        visualTransformation = if (newVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (error != null) {
                        Spacer(Modifier.height(10.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.ErrorOutline, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(error ?: "", color = Color(0xFFEF4444), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        },
        confirmButton = {
            if (done) {
                Button(onClick = onDismiss) { Text(s("Done", "हो गया")) }
            } else {
                Button(
                    onClick = { submit() },
                    enabled = !isSubmitting && currentPassword.isNotBlank() && newPassword.isNotBlank() && confirmPassword.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = Saffron600, contentColor = Color.White),
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                    } else {
                        Text(s("Update Password", "पासवर्ड अपडेट करें"), fontWeight = FontWeight.Bold)
                    }
                }
            }
        },
        dismissButton = {
            if (!done) {
                OutlinedButton(onClick = onDismiss) { Text(s("Cancel", "रद्द करें")) }
            }
        },
    )
}

@Composable
private fun InitialsAvatarFallback(name: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(listOf(Saffron600, AmberGold))
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name.trim().firstOrNull()?.uppercase() ?: "F",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
    }
}

@Composable
private fun SectionHeader(title: String, icon: ImageVector) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = Saffron600, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text(
            title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
        )
    }
}

@Composable
private fun ProfileInputField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String = "",
    error: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    icon: ImageVector? = null,
    singleLine: Boolean = true,
    maxLines: Int = 1,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(bottom = 6.dp),
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder, style = MaterialTheme.typography.bodySmall) },
            leadingIcon = icon?.let { { Icon(it, contentDescription = null, tint = Saffron600.copy(alpha = 0.8f)) } },
            isError = error != null,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            singleLine = singleLine,
            maxLines = maxLines,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Saffron600,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f),
                errorBorderColor = Color(0xFFEF4444),
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        if (error != null) {
            Text(
                error,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFEF4444),
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 4.dp, top = 4.dp),
            )
        }
    }
}
