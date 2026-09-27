package com.saaserp.attendance.ui.checkin

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Cameraswitch
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saaserp.attendance.camera.CameraCapture
import com.saaserp.attendance.ui.tour.coachTarget
import com.saaserp.attendance.di.ServiceLocator
import com.saaserp.attendance.location.LocationCapture
import com.saaserp.attendance.ui.components.GlassSurface
import com.saaserp.attendance.ui.theme.AmberGold
import com.saaserp.attendance.ui.theme.DarkDialogSurface
import com.saaserp.attendance.ui.theme.LightDialogCream
import com.saaserp.attendance.ui.theme.Saffron500
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.ui.theme.Saffron700
import com.saaserp.attendance.ui.theme.StatusFlaggedOrange
import com.saaserp.attendance.ui.theme.StatusPendingAmber
import com.saaserp.attendance.ui.theme.StatusRejectedRed
import com.saaserp.attendance.util.humanizeReason
import com.saaserp.attendance.util.humanizeReasons
import com.saaserp.attendance.util.s
import com.saaserp.attendance.ui.theme.StatusVerifiedGreen
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckInScreen(viewModel: CheckInViewModel = viewModel(), onExitApp: () -> Unit = {}) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val uiState by viewModel.uiState.collectAsState()
    val scope = rememberCoroutineScope()
    val authRepository = remember { ServiceLocator.authRepository(context) }
    val employeeName = authRepository.employeeName ?: "Staff Member"

    var hasPermissions by remember {
        mutableStateOf(REQUIRED_PERMISSIONS.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        })
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        hasPermissions = result.values.all { it }
    }
    LaunchedEffect(Unit) {
        if (!hasPermissions) permissionLauncher.launch(REQUIRED_PERMISSIONS)
    }

    var cameraCapture by remember { mutableStateOf<CameraCapture?>(null) }
    // Live blink-challenge signal (see LivenessDetector) — re-collected
    // whenever the camera instance changes (bind/unbind), reset to false
    // any time capture is cancelled/restarted so a stale blink from a
    // previous attempt can't carry over.
    var blinkDetected by remember { mutableStateOf(false) }
    LaunchedEffect(cameraCapture) {
        blinkDetected = false
        cameraCapture?.livenessDetector?.blinkDetected?.collect { blinkDetected = it }
    }

    // Release camera hardware whenever we leave READY phase or when photo has been captured
    LaunchedEffect(uiState.phase, uiState.capturedPhotoPath) {
        if (uiState.phase != CapturePhase.READY || uiState.capturedPhotoPath != null) {
            cameraCapture?.unbind()
            cameraCapture = null
        }
    }
    DisposableEffect(Unit) {
        onDispose { cameraCapture?.unbind() }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 12.dp),
        ) {
            // ── Top Header & Greeting ──
            val employeePhotoUrl = com.saaserp.attendance.util.UrlResolver.resolve(authRepository.employeePhotoUrl)

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f),
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .border(
                                2.dp,
                                Brush.linearGradient(listOf(Saffron500, AmberGold)),
                                CircleShape,
                            )
                            .shadow(6.dp, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (!employeePhotoUrl.isNullOrBlank()) {
                            coil.compose.SubcomposeAsyncImage(
                                model = coil.request.ImageRequest.Builder(context)
                                    .data(com.saaserp.attendance.util.UrlResolver.toCoilModel(employeePhotoUrl))
                                    .crossfade(true)
                                    .build(),
                                contentDescription = "Employee Portrait",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                                error = {
                                    Box(
                                        modifier = Modifier.fillMaxSize().background(Saffron600),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            employeeName.trim().firstOrNull()?.uppercase() ?: "T",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White,
                                        )
                                    }
                                },
                            )
                        } else {
                            Box(
                                modifier = Modifier.fillMaxSize().background(Saffron600),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    employeeName.trim().firstOrNull()?.uppercase() ?: "T",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Column {
                        Text(
                            text = s("Mark Attendance", "उपस्थिति दर्ज करें"),
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onBackground,
                        )
                        Text(
                            text = s("Hello, $employeeName", "नमस्ते, $employeeName"),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                // Live Date Pill
                Surface(
                    shape = RoundedCornerShape(50.dp),
                    color = Saffron500.copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, Saffron500.copy(alpha = 0.35f)),
                ) {
                    Text(
                        text = SimpleDateFormat("dd MMM, EEE", Locale.getDefault()).format(Date()),
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = Saffron700,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // ── Permissions Not Granted Alert ──
            if (!hasPermissions) {
                GlassSurface(
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    contentPadding = 20.dp,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(StatusPendingAmber.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Filled.Security,
                                contentDescription = null,
                                tint = StatusPendingAmber,
                                modifier = Modifier.size(22.dp),
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Permissions Required",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                text = "Camera & high-accuracy GPS location permissions are needed to mark verified attendance.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = { permissionLauncher.launch(REQUIRED_PERMISSIONS) },
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Grant Permissions", fontWeight = FontWeight.Bold)
                    }
                }
            } else {
                // ── Main Check-In State Container ──
                when (uiState.phase) {
                    CapturePhase.IDLE -> {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .verticalScroll(rememberScrollState())
                                .padding(bottom = 12.dp),
                        ) {
                            AnimatedContent(
                                modifier = Modifier.coachTarget("checkin_main"),
                                targetState = when {
                                    uiState.dayComplete -> 0
                                    uiState.sessionOpen -> 1
                                    else -> 2
                                },
                                transitionSpec = {
                                    fadeIn(tween(300)) + slideInVertically(tween(300)) { it / 10 } togetherWith
                                        fadeOut(tween(150))
                                },
                                label = "checkInCardContent",
                            ) { state ->
                                when (state) {
                                    0 -> AlreadyCheckedInAppreciationView(
                                        employeeName = employeeName,
                                        todayPunchCount = uiState.todayPunchCount,
                                        onCheckInAgain = { viewModel.startCapturing() },
                                        onExitApp = onExitApp,
                                    )
                                    1 -> CheckedInSessionView(
                                        locationError = uiState.locationError,
                                        shiftNumber = ((uiState.todayPunchCount + 1) / 2).coerceAtLeast(1),
                                        onCheckOut = { viewModel.startCapturing() },
                                        onRequestHalfDay = { viewModel.requestHalfDay() },
                                    )
                                    else -> IdleCheckInView(
                                        locationError = uiState.locationError,
                                        onStartCheckIn = { viewModel.startCapturing() },
                                    )
                                }
                            }

                            // ── Always-available secondary actions ──
                            Box(modifier = Modifier.coachTarget("colleague")) {
                                MarkForColleagueRow(onClick = { viewModel.openColleagueModeChoice() })
                            }

                            if (uiState.alreadyCheckedInToday && uiState.isFirstOfMonth) {
                                DiscardAndRetakeRow(
                                    isDiscarding = uiState.isDiscarding,
                                    onClick = { viewModel.discardTodayForRetake() },
                                )
                            }
                        }
                    }

                    CapturePhase.LOCATING -> {
                        LocatingStateView()
                    }

                    CapturePhase.OUTSIDE_RANGE -> {
                        CampusGuideView(
                            distanceM = uiState.distanceToCampusM,
                            target = uiState.campusTarget,
                            guideLat = uiState.guideLat,
                            guideLng = uiState.guideLng,
                            onCancel = { viewModel.cancelCapturing() },
                        )
                    }

                    CapturePhase.READY -> {
                        Column(
                            modifier = Modifier
                                .weight(1f, fill = false)
                                .verticalScroll(rememberScrollState()),
                        ) {
                            uiState.location?.let { LocationMetaCard(it, uiState.isOnline) }

                            Spacer(modifier = Modifier.height(12.dp))

                            // Viewfinder Frame: Live Preview OR Captured Still Photo
                            GlassSurface(
                                modifier = Modifier.fillMaxWidth(),
                                contentPadding = 12.dp,
                                elevation = 24.dp,
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(1f)
                                        .clip(RoundedCornerShape(22.dp))
                                        .background(Color.Black),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    val capturedPath = uiState.capturedPhotoPath
                                    if (capturedPath != null && File(capturedPath).exists()) {
                                        // ── Show Captured Still Photo (Video Stopped) ──
                                        val bitmap = remember(capturedPath) {
                                            BitmapFactory.decodeFile(capturedPath)
                                        }
                                        if (bitmap != null) {
                                            Image(
                                                bitmap = bitmap.asImageBitmap(),
                                                contentDescription = "Captured attendance photo",
                                                contentScale = ContentScale.Crop,
                                                modifier = Modifier.fillMaxSize(),
                                            )
                                        }

                                        // Scanning & Verifying Overlay on Top of Still Photo
                                        Box(
                                            modifier = Modifier
                                                .fillMaxSize()
                                                .background(Color.Black.copy(alpha = 0.45f)),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            Column(
                                                horizontalAlignment = Alignment.CenterHorizontally,
                                                modifier = Modifier.padding(16.dp),
                                            ) {
                                                CircularProgressIndicator(
                                                    modifier = Modifier.size(44.dp),
                                                    color = AmberGold,
                                                    strokeWidth = 3.5.dp,
                                                )
                                                Spacer(modifier = Modifier.height(14.dp))
                                                Text(
                                                    text = "Verifying Photo & Location…",
                                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                                    color = Color.White,
                                                    textAlign = TextAlign.Center,
                                                )
                                                Spacer(modifier = Modifier.height(4.dp))
                                                Text(
                                                    text = "Photo captured successfully",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = Color.White.copy(alpha = 0.8f),
                                                    textAlign = TextAlign.Center,
                                                )
                                            }
                                        }
                                    } else {
                                        // ── Live Camera Feed ──
                                        AndroidView(
                                            factory = { ctx ->
                                                PreviewView(ctx).also { previewView ->
                                                    val capture = CameraCapture(ctx, lifecycleOwner)
                                                    cameraCapture = capture
                                                    scope.launch { try { capture.bind(previewView) } catch (_: Throwable) { /* camera unavailable — don't crash the app */ } }
                                                }
                                            },
                                            modifier = Modifier.fillMaxSize(),
                                        )

                                        // Viewfinder Overlay Corner Brackets & Guide
                                        ViewfinderOverlay(blinkDetected = blinkDetected)

                                        // Flip front/back camera — resets to front every time
                                        // this screen is (re)entered, since front camera is
                                        // what a selfie check-in actually needs; this is just
                                        // a deliberate, one-off override, not a remembered mode.
                                        Box(
                                            modifier = Modifier
                                                .align(Alignment.TopEnd)
                                                .padding(12.dp)
                                                .size(44.dp)
                                                .clip(CircleShape)
                                                .background(Color.Black.copy(alpha = 0.35f)),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            IconButton(onClick = {
                                                val capture = cameraCapture ?: return@IconButton
                                                scope.launch { capture.flipCamera() }
                                            }) {
                                                Icon(
                                                    imageVector = Icons.Filled.Cameraswitch,
                                                    contentDescription = "Flip camera",
                                                    tint = Color.White,
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // ── Bottom Capture Controls Row ──
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 16.dp, bottom = 4.dp),
                        ) {
                            // High-contrast, clearly visible circular Cancel button
                            Box(
                                modifier = Modifier
                                    .size(52.dp)
                                    .clip(CircleShape)
                                    .background(
                                        Brush.linearGradient(
                                            listOf(
                                                Color.White.copy(alpha = 0.28f),
                                                Color.White.copy(alpha = 0.12f),
                                            )
                                        )
                                    )
                                    .border(1.5.dp, Color.White.copy(alpha = 0.45f), CircleShape)
                                    .clickable { viewModel.cancelCapturing() },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.Close,
                                    contentDescription = "Cancel capture",
                                    tint = MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.size(24.dp),
                                )
                            }

                            Spacer(modifier = Modifier.width(12.dp))

                            // Main "Capture & Check In" button
                            Button(
                                onClick = {
                                    val capture = cameraCapture ?: return@Button
                                    // A blink actually seen is a real positive
                                    // signal; not seeing one by the time the
                                    // user taps capture is NOT treated as a
                                    // failure (null, not false) — this never
                                    // gates or delays capture, so a user who
                                    // taps quickly is never wrongly flagged
                                    // for "failing" a check they were never
                                    // forced to wait through.
                                    val liveness = if (blinkDetected) true else null
                                    scope.launch {
                                        val path = capture.capture()
                                        // Immediately release live video stream
                                        capture.unbind()
                                        cameraCapture = null
                                        viewModel.performCheckIn(path, livenessVerified = liveness)
                                    }
                                },
                                enabled = !uiState.isCapturing,
                                shape = RoundedCornerShape(18.dp),
                                // Solid brand fill while "Verifying & Saving…"
                                // (M3's default disabled grey renders as a
                                // two-tone block on-device).
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.primary,
                                    contentColor = MaterialTheme.colorScheme.onPrimary,
                                    disabledContainerColor = MaterialTheme.colorScheme.primary,
                                    disabledContentColor = MaterialTheme.colorScheme.onPrimary,
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(52.dp)
                                    .shadow(8.dp, RoundedCornerShape(18.dp), ambientColor = Saffron600.copy(alpha = 0.35f)),
                            ) {
                                if (uiState.isCapturing) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(20.dp),
                                        color = MaterialTheme.colorScheme.onPrimary,
                                        strokeWidth = 2.5.dp,
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text(
                                        text = s("Verifying & Saving…", "सत्यापित और सहेजा जा रहा है…"),
                                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Filled.CheckCircle,
                                        contentDescription = null,
                                        modifier = Modifier.size(20.dp),
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = s("Capture & Check In", "फोटो लें और चेक इन करें"),
                                        style = MaterialTheme.typography.labelLarge.copy(
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 15.sp,
                                        ),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Success / Result Solid Opaque Confirmation Dialog with Dimmed Backdrop ──
        uiState.result?.let { result ->
            AttendanceConfirmationDialog(
                result = result,
                employeeName = employeeName,
                onDismiss = viewModel::dismissResult,
            )
        }

        // ── Reminder dialog: mark in (organization start) / mark out (organization end) ──
        uiState.reminderPrompt?.let { prompt ->
            val isIn = prompt == "IN"
            AlertDialog(
                onDismissRequest = { viewModel.dismissReminderPrompt() },
                icon = { Icon(Icons.Filled.Notifications, contentDescription = null, tint = Saffron600) },
                title = {
                    Text(if (isIn) s("Mark in your attendance for today", "आज की उपस्थिति दर्ज करें") else s("Organization time is over", "स्कूल का समय समाप्त हो गया"))
                },
                text = {
                    Text(
                        if (isIn) s(
                            "Tap Mark In to open the camera and record your attendance.",
                            "कैमरा खोलकर उपस्थिति दर्ज करने के लिए मार्क इन दबाएँ।",
                        ) else s(
                            "You're still checked in. Mark out now so your attendance is recorded correctly.",
                            "आप अभी भी चेक-इन हैं। सही उपस्थिति के लिए अभी मार्क आउट करें।",
                        ),
                    )
                },
                confirmButton = {
                    Button(onClick = { viewModel.confirmReminderPrompt() }) {
                        Text(if (isIn) s("Mark In", "मार्क इन") else s("Mark Out", "मार्क आउट"))
                    }
                },
                dismissButton = {
                    OutlinedButton(onClick = { viewModel.dismissReminderPrompt() }) {
                        Text(s("Later", "बाद में"))
                    }
                },
            )
        }

        // ── "Mark for a Colleague": Mark In / Mark Out choice ──
        if (uiState.showColleagueModeChoice) {
            ColleagueModeDialog(
                onMarkIn = { viewModel.openColleaguePicker("IN") },
                onMarkOut = { viewModel.openColleaguePicker("OUT") },
                onDismiss = { viewModel.dismissColleagueModeChoice() },
            )
        }

        // ── "Mark for a Colleague" Picker ──
        if (uiState.showColleaguePicker) {
            ColleaguePickerSheet(
                mode = uiState.colleagueMode,
                colleagues = uiState.colleagues,
                isLoading = uiState.colleaguesLoading,
                onSelect = { viewModel.selectColleague(it) },
                onDismiss = { viewModel.dismissColleaguePicker() },
            )
        }

        // ── Discard & Retake failure ──
        uiState.discardError?.let { message ->
            AlertDialog(
                onDismissRequest = { viewModel.dismissDiscardError() },
                icon = { Icon(Icons.Filled.Error, contentDescription = null, tint = StatusRejectedRed) },
                title = { Text("Couldn't Discard Attendance") },
                text = { Text(message) },
                confirmButton = {
                    Button(onClick = { viewModel.dismissDiscardError() }) {
                        Text("OK")
                    }
                },
            )
        }

        // ── Request Half-Day confirmation ──
        if (uiState.showHalfDayConfirm) {
            AlertDialog(
                onDismissRequest = { viewModel.dismissHalfDayConfirm() },
                icon = { Icon(Icons.Filled.CalendarMonth, contentDescription = null, tint = Saffron600) },
                title = { Text("Request Half-Day?") },
                text = { Text("This checks you out right now and marks today as a half day. You'll still need to verify with your face and location, same as a normal check-out.") },
                confirmButton = {
                    Button(
                        onClick = { viewModel.confirmHalfDayRequest() },
                        colors = ButtonDefaults.buttonColors(containerColor = Saffron600, contentColor = Color.White),
                    ) {
                        Text("Confirm & Check Out", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    OutlinedButton(onClick = { viewModel.dismissHalfDayConfirm() }) { Text("Cancel") }
                },
            )
        }
    }
}

/** Small pill row offering "Mark for a Colleague" — always visible on the idle screen, whether or not the signed-in employee has checked in today. */
@Composable
private fun MarkForColleagueRow(onClick: () -> Unit) {
    // A warm saffron fill at low alpha reads as clean amber on the light
    // cream backdrop, but the exact same math over AMOLED black composites
    // as a muddy brown instead of a neutral dark card — the accent border
    // and icon stay saffron either way (that's the intended brand color),
    // only the fill itself switches to a neutral dark tint in dark mode.
    val isDark = isSystemInDarkTheme()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .background(if (isDark) Color.White.copy(alpha = 0.04f) else Saffron500.copy(alpha = 0.08f))
            .border(1.dp, Saffron500.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(Saffron500.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.People, contentDescription = null, tint = Saffron600, modifier = Modifier.size(17.dp))
        }
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = s("Mark for a Colleague", "सहकर्मी के लिए दर्ज करें"),
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, fontSize = 13.sp),
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = s("Standing in for a colleague who forgot phone? Verify here.", "सहकर्मी फ़ोन भूल गए? यहाँ उपस्थिति दर्ज करें।"),
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp, lineHeight = 14.sp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(modifier = Modifier.width(6.dp))
        Icon(
            Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = null,
            tint = Saffron600.copy(alpha = 0.6f),
            modifier = Modifier.size(12.dp),
        )
    }
}

/** "Discard & Retake" — only ever shown on the 1st of the month, for the signed-in employee's own attendance. */
@Composable
private fun DiscardAndRetakeRow(isDiscarding: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 10.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(enabled = !isDiscarding, onClick = onClick)
            .background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.25f))
            .border(1.dp, StatusRejectedRed.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (isDiscarding) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = StatusRejectedRed)
        } else {
            Icon(Icons.Filled.Refresh, contentDescription = null, tint = StatusRejectedRed, modifier = Modifier.size(20.dp))
        }
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text("Discard & Retake Today's Attendance", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold), color = StatusRejectedRed)
            Text(
                "Made a mistake with today's photo? This is your once-a-month window to fix it.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}


/**
 * Celebratory Appreciation Card shown when attendance is ALREADY recorded for today.
 * Offers "Check In Again (New Shift)" so employees with multiple shifts or re-entries on
 * the same day can record subsequent IN punches.
 */
@Composable
private fun AlreadyCheckedInAppreciationView(
    employeeName: String,
    todayPunchCount: Int = 0,
    onCheckInAgain: () -> Unit,
    onExitApp: () -> Unit,
) {
    val infiniteTransition = rememberInfiniteTransition(label = "celebration")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.96f,
        targetValue = 1.04f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulseScale",
    )
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.18f,
        targetValue = 0.45f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "glowAlpha",
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth(),
    ) {
        GlassSurface(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            contentPadding = 14.dp,
            elevation = 16.dp,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth(),
            ) {
                // Animated Celebratory Badge (Clean pulsating green ring with soft breathing glow)
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .scale(pulseScale)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                listOf(
                                    StatusVerifiedGreen.copy(alpha = glowAlpha),
                                    AmberGold.copy(alpha = 0.12f),
                                    Color.Transparent,
                                )
                            )
                        )
                        .border(2.dp, StatusVerifiedGreen.copy(alpha = 0.6f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Filled.CheckCircle,
                        contentDescription = "Verified",
                        tint = StatusVerifiedGreen,
                        modifier = Modifier.size(38.dp),
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = s("Attendance Completed!", "उपस्थिति दर्ज हो गई!"),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = StatusVerifiedGreen,
                    textAlign = TextAlign.Center,
                )

                Spacer(modifier = Modifier.height(2.dp))

                Text(
                    text = s("Great job, $employeeName!", "शाबाश, $employeeName!"),
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                )

                Spacer(modifier = Modifier.height(2.dp))

                Text(
                    text = s(
                        "Your presence is verified and recorded for today. You are all set to conduct your classes. Have an inspiring day!",
                        "आपकी उपस्थिति सत्यापित और दर्ज कर ली गई है। आप कक्षाएं लेने के लिए तैयार हैं। आपका दिन शुभ हो!"
                    ),
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.5.sp, lineHeight = 15.sp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Verification details pill with multi-shift count
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = StatusVerifiedGreen.copy(alpha = 0.12f),
                    border = BorderStroke(1.dp, StatusVerifiedGreen.copy(alpha = 0.35f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                        ) {
                            Icon(
                                Icons.Filled.ThumbUp,
                                contentDescription = null,
                                tint = StatusVerifiedGreen,
                                modifier = Modifier.size(15.dp),
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = s("Status: Present & Verified for Today", "स्थिति: आज उपस्थित एवं सत्यापित"),
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, fontSize = 12.sp),
                                color = StatusVerifiedGreen,
                            )
                        }
                        if (todayPunchCount > 0) {
                            Spacer(modifier = Modifier.height(2.dp))
                            val completedShifts = todayPunchCount / 2
                            Text(
                                text = if (completedShifts > 1) {
                                    s("$completedShifts Shifts Completed Today ($todayPunchCount punches)", "आज $completedShifts शिफ्ट पूर्ण ($todayPunchCount पंच)")
                                } else {
                                    s("1 Shift Completed Today ($todayPunchCount punches)", "आज 1 शिफ्ट पूर्ण ($todayPunchCount पंच)")
                                },
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Primary action: Check In again for another shift or afternoon session
                Button(
                    onClick = onCheckInAgain,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary
                    ),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = 44.dp)
                        .shadow(6.dp, RoundedCornerShape(14.dp), ambientColor = Saffron600.copy(alpha = 0.35f)),
                ) {
                    Icon(Icons.AutoMirrored.Filled.Login, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = s("Check In Again (New Shift)", "पुनः चेक इन करें (नई शिफ्ट)"),
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, fontSize = 14.sp),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Secondary action: Exit app
                OutlinedButton(
                    onClick = onExitApp,
                    shape = RoundedCornerShape(14.dp),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = 38.dp),
                ) {
                    Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = s("Exit App", "ऐप से बाहर निकलें"),
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, fontSize = 13.sp),
                    )
                }
            }
        }
    }
}

/**
 * Shown once checked in for the day, before checking out — offers "Check
 * Out" (goes through the same face+GPS capture flow, tagged as an OUT
 * event) and a secondary "Request Half-Day" action for a self-declared
 * early exit.
 */
@Composable
private fun CheckedInSessionView(
    locationError: String?,
    shiftNumber: Int = 1,
    onCheckOut: () -> Unit,
    onRequestHalfDay: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
    ) {
        locationError?.let { err ->
            GlassSurface(
                modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
                contentPadding = 12.dp,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Error, contentDescription = "Error", tint = StatusRejectedRed, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Location Error", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold), color = StatusRejectedRed)
                        Text(err, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        GlassSurface(modifier = Modifier.fillMaxWidth(), contentPadding = 16.dp, elevation = 16.dp) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(Color(0xFF34D399).copy(alpha = 0.25f), Saffron600.copy(alpha = 0.25f)))),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = Color(0xFF34D399), modifier = Modifier.size(22.dp))
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = if (shiftNumber > 1) "You're Checked In (Shift $shiftNumber)" else "You're Checked In",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = if (shiftNumber > 1) "Check out when you complete shift $shiftNumber." else "Check out when you leave for the day.",
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.5.sp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Button(
                onClick = onCheckOut,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary, contentColor = MaterialTheme.colorScheme.onPrimary),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 44.dp)
                    .shadow(6.dp, RoundedCornerShape(14.dp), ambientColor = Saffron600.copy(alpha = 0.35f)),
            ) {
                Icon(Icons.Filled.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(s("Verify & Check Out", "सत्यापित करें और चेक आउट करें"), style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, fontSize = 14.sp))
            }

            Spacer(modifier = Modifier.height(6.dp))

            OutlinedButton(
                onClick = onRequestHalfDay,
                shape = RoundedCornerShape(14.dp),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 38.dp),
            ) {
                Icon(Icons.Filled.CalendarMonth, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(s("Request Half-Day", "हाफ़ डे का अनुरोध करें"), style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, fontSize = 13.sp))
            }
        }
    }
}

/**
 * Modern Idle Screen with guidelines and primary "Verify & Mark Attendance" action
 */
@Composable
private fun IdleCheckInView(
    locationError: String?,
    onStartCheckIn: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
    ) {
        // Location error alert if any
        locationError?.let { err ->
            GlassSurface(
                modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
                contentPadding = 12.dp,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.Error,
                        contentDescription = "Error",
                        tint = StatusRejectedRed,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = s("Location Error", "स्थान त्रुटि"),
                            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                            color = StatusRejectedRed,
                        )
                        Text(
                            text = err,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        // Instruction / Info Card
        GlassSurface(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = 16.dp,
            elevation = 16.dp,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                listOf(AmberGold.copy(alpha = 0.25f), Saffron600.copy(alpha = 0.25f))
                            )
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Face,
                        contentDescription = null,
                        tint = Saffron600,
                        modifier = Modifier.size(22.dp),
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Text(
                        text = s("Facial & GPS Verification", "चेहरा और जीपीएस सत्यापन"),
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = s("Real-time geofenced staff check-in", "रीयल-टाइम जियोफ़ेंस्ड स्टाफ चेक-इन"),
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.5.sp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Step items
            CheckInStepRow(
                number = "1",
                title = s("Campus Geofence", "कैंपस जियोफ़ेंस"),
                desc = s("GPS confirms your presence within SaaS ERP campus bounds.", "जीपीएस डीएसपीएस कैंपस के भीतर आपकी उपस्थिति की पुष्टि करता है।"),
            )
            Spacer(modifier = Modifier.height(6.dp))
            CheckInStepRow(
                number = "2",
                title = s("Facial Capture", "चेहरे की फोटो"),
                desc = s("Front camera captures a clear live photo for AI match.", "फ्रंट camera एआई मिलान के लिए स्पष्ट लाइव फोटो लेता है।"),
            )
            Spacer(modifier = Modifier.height(6.dp))
            CheckInStepRow(
                number = "3",
                title = s("Instant Verification", "तुरंत सत्यापन"),
                desc = s("Attendance is logged and verified with organization records.", "उपस्थिति दर्ज की जाती है और स्कूल रिकॉर्ड से सत्यापित की जाती है।"),
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Primary CTA Button
            Button(
                onClick = onStartCheckIn,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 46.dp)
                    .shadow(6.dp, RoundedCornerShape(14.dp), ambientColor = Saffron600.copy(alpha = 0.35f)),
            ) {
                Icon(
                    Icons.Filled.CameraAlt,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = s("Verify & Mark Attendance", "सत्यापित करें और उपस्थिति दर्ज करें"),
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                    ),
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            val context = LocalContext.current
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .clickable {
                        try {
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, Uri.parse("https://dspsupaul.com")).apply {
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                }
                            )
                        } catch (e: Exception) {
                            // No browser available — nothing sensible to fall back to.
                        }
                    }
                    .padding(vertical = 10.dp),
            ) {
                Icon(
                    Icons.Filled.Language,
                    contentDescription = null,
                    tint = Saffron600,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = s("Explore dspsupaul.com", "dspsupaul.com देखें"),
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = Saffron600,
                )
            }
        }
    }
}

@Composable
private fun CheckInStepRow(number: String, title: String, desc: String) {
    Row(verticalAlignment = Alignment.Top) {
        Box(
            modifier = Modifier
                .size(22.dp)
                .clip(CircleShape)
                .background(Saffron500.copy(alpha = 0.15f))
                .border(1.dp, Saffron500.copy(alpha = 0.4f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = number,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                color = Saffron700,
            )
        }
        Spacer(modifier = Modifier.width(10.dp))
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = desc,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * Animated Loading View while acquiring GPS coordinates
 */
@Composable
private fun LocatingStateView() {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 0.9f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "radarScale",
    )

    GlassSurface(
        modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        contentPadding = 32.dp,
        elevation = 20.dp,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .scale(scale)
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            listOf(
                                AmberGold.copy(alpha = 0.35f),
                                Saffron600.copy(alpha = 0.15f),
                                Color.Transparent,
                            )
                        )
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.LocationOn,
                    contentDescription = "Locating",
                    tint = Saffron600,
                    modifier = Modifier.size(36.dp),
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = "Acquiring GPS Location…",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onSurface,
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "Verifying presence within SaaS ERP campus geofence perimeter.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(20.dp))

            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = Saffron600,
                strokeWidth = 2.5.dp,
            )
        }
    }
}

/**
 * Live "guide me to campus" card shown when the employee is outside the
 * geofence — a compass arrow (device heading vs. bearing-to-campus) and a
 * distance readout that both update in real time as they walk, so they can
 * see themselves closing in instead of just being told "no." Auto-advances
 * to the camera the instant [distanceM] drops inside the radius
 * ([CheckInViewModel.startGuideLoop] drives that from outside).
 */
@Composable
private fun CampusGuideView(
    distanceM: Int?,
    target: com.saaserp.attendance.location.CampusTarget?,
    guideLat: Double?,
    guideLng: Double?,
    onCancel: () -> Unit,
) {
    val context = LocalContext.current
    val heading by com.saaserp.attendance.location.rememberDeviceHeading()

    val bearingToCampus = if (target != null && guideLat != null && guideLng != null) {
        com.saaserp.attendance.location.CampusGeofence.bearingDegrees(guideLat, guideLng, target)
    } else {
        0f
    }

    GlassSurface(
        modifier = Modifier.fillMaxWidth().padding(top = 20.dp),
        contentPadding = 28.dp,
        elevation = 20.dp,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            listOf(
                                AmberGold.copy(alpha = 0.3f),
                                Saffron600.copy(alpha = 0.12f),
                                Color.Transparent,
                            )
                        )
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.Navigation,
                    contentDescription = "Direction to campus",
                    tint = Saffron600,
                    modifier = Modifier
                        .size(52.dp)
                        .rotate(bearingToCampus - heading),
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = "Head Toward SaaS ERP Campus",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onSurface,
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = if (distanceM != null) {
                    "You're ${distanceM}m away — check-in unlocks automatically once you're within range."
                } else {
                    "Checking your distance from campus…"
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = {
                    val lat = target?.lat
                    val lng = target?.lng
                    if (lat != null && lng != null) {
                        try {
                            context.startActivity(
                                Intent(
                                    Intent.ACTION_VIEW,
                                    Uri.parse("google.navigation:q=$lat,$lng&mode=w"),
                                ).apply {
                                    setPackage("com.google.android.apps.maps")
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                }
                            )
                        } catch (e: Exception) {
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng(SaaS ERP+Campus)")).apply {
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                }
                            )
                        }
                    }
                },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Saffron600, contentColor = Color.White),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Filled.Navigation, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Open Walking Directions", fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(10.dp))

            OutlinedButton(
                onClick = onCancel,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Cancel", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

/**
 * Viewfinder visual overlay with scanner corner brackets & a guiding oval —
 * pulses while positioning, then settles and the hint changes to "hold
 * steady" a moment before capture, so there's a clear rhythm to follow
 * instead of a single static frame.
 */
@Composable
private fun ViewfinderOverlay(blinkDetected: Boolean = false) {
    var settled by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(1800)
        settled = true
    }

    val infiniteTransition = rememberInfiniteTransition(label = "faceGuidePulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.97f,
        targetValue = 1.03f,
        animationSpec = infiniteRepeatable(
            animation = tween(if (settled) 900 else 550, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "faceGuideScale",
    )
    val guideColor = if (settled) Color(0xFF34D399) else AmberGold

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        // Center oval guide for face positioning — color/rhythm change once
        // "settled" so it reads as guidance, not just decoration.
        Box(
            modifier = Modifier
                .size(190.dp, 240.dp)
                .scale(pulseScale)
                .border(
                    BorderStroke(
                        1.5.dp,
                        Brush.linearGradient(
                            listOf(
                                guideColor.copy(alpha = 0.75f),
                                Saffron500.copy(alpha = 0.4f),
                                guideColor.copy(alpha = 0.75f),
                            )
                        )
                    ),
                    shape = RoundedCornerShape(100.dp),
                ),
        )

        // Top-left corner bracket
        Text(
            text = "┌",
            color = AmberGold,
            fontSize = 32.sp,
            fontWeight = FontWeight.Light,
            modifier = Modifier.align(Alignment.TopStart),
        )
        // Top-right corner bracket
        Text(
            text = "┐",
            color = AmberGold,
            fontSize = 32.sp,
            fontWeight = FontWeight.Light,
            modifier = Modifier.align(Alignment.TopEnd),
        )
        // Bottom-left corner bracket
        Text(
            text = "└",
            color = AmberGold,
            fontSize = 32.sp,
            fontWeight = FontWeight.Light,
            modifier = Modifier.align(Alignment.BottomStart),
        )
        // Bottom-right corner bracket
        Text(
            text = "┘",
            color = AmberGold,
            fontSize = 32.sp,
            fontWeight = FontWeight.Light,
            modifier = Modifier.align(Alignment.BottomEnd),
        )

        // Instruction badge at top of preview
        Surface(
            shape = RoundedCornerShape(50.dp),
            color = Color.Black.copy(alpha = 0.6f),
            modifier = Modifier.align(Alignment.TopCenter).padding(top = 8.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            ) {
                // Only actually blinks (an eyelid-close/open animation) while
                // waiting for the challenge — once ML Kit confirms a real
                // blink, the icon freezes open and turns green instead of
                // continuing to animate, so the badge itself doubles as the
                // pass/fail signal, not just the text next to it.
                BlinkingEyeIcon(isWaitingForBlink = settled && !blinkDetected)
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = when {
                        blinkDetected -> "✓ Liveness confirmed"
                        settled -> "Blink once, then hold steady…"
                        else -> "Center your face in the oval"
                    },
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = if (blinkDetected) Color(0xFF34D399) else Color.White,
                )
            }
        }
    }
}

/** Eyelid-close-then-open loop (via scaleY keyframes) to visually prompt the blink-liveness challenge, rather than only relying on the instruction text next to it. */
@Composable
private fun BlinkingEyeIcon(isWaitingForBlink: Boolean) {
    val infiniteTransition = rememberInfiniteTransition(label = "eyeBlink")
    val eyelidScaleY by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = keyframes {
                durationMillis = 2400
                1f at 0
                1f at 1900 using FastOutSlowInEasing
                0.08f at 2050 using FastOutSlowInEasing
                1f at 2250 using FastOutSlowInEasing
            },
        ),
        label = "eyelidScaleY",
    )

    Icon(
        imageVector = Icons.Filled.Visibility,
        contentDescription = null,
        tint = if (isWaitingForBlink) Color.White else Color(0xFF34D399),
        modifier = Modifier
            .size(16.dp)
            .graphicsLayer {
                scaleY = if (isWaitingForBlink) eyelidScaleY else 1f
            },
    )
}

/** GPS + connectivity metadata card */
@Composable
private fun LocationMetaCard(location: LocationCapture, isOnline: Boolean) {
    GlassSurface(modifier = Modifier.fillMaxWidth(), contentPadding = 14.dp) {
        Column {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.LocationOn,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = "%.5f, %.5f".format(location.lat, location.lng),
                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }

                // Accuracy Badge
                Surface(
                    shape = RoundedCornerShape(50.dp),
                    color = if (location.mockLocationReported) StatusRejectedRed.copy(alpha = 0.15f) else StatusVerifiedGreen.copy(alpha = 0.15f),
                    border = BorderStroke(
                        1.dp,
                        if (location.mockLocationReported) StatusRejectedRed.copy(alpha = 0.35f) else StatusVerifiedGreen.copy(alpha = 0.35f),
                    ),
                ) {
                    Text(
                        text = if (location.mockLocationReported) "Mock GPS" else "GPS ±${location.accuracyM.toInt()}m",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = if (location.mockLocationReported) StatusRejectedRed else StatusVerifiedGreen,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (isOnline) Icons.Filled.Wifi else Icons.Filled.WifiOff,
                    contentDescription = null,
                    tint = if (isOnline) StatusVerifiedGreen else StatusPendingAmber,
                    modifier = Modifier.size(15.dp),
                )
                Text(
                    text = if (isOnline) "Online — immediate cloud verification" else "Offline — saved for sync upon connection",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isOnline) StatusVerifiedGreen else StatusPendingAmber,
                    modifier = Modifier.padding(start = 6.dp),
                )
            }
        }
    }
}

/**
 * Animated Celebration / Result Confirmation Dialog
 * Uses a SOLID, high-opacity container with a dimmed backdrop to prevent background text bleed-through.
 */
@Composable
private fun AttendanceConfirmationDialog(
    result: CheckInResult,
    employeeName: String,
    onDismiss: () -> Unit,
) {
    val isDark = isSystemInDarkTheme()
    val (title, subtitle, color, icon, isSuccess) = when (result) {
        is CheckInResult.Verified -> StatusDialogVisual(
            title = s("Attendance Verified!", "उपस्थिति सत्यापित!"),
            subtitle = humanizeReasons(result.reasons).joinToString(" • ").ifBlank { "Identity & campus geofence successfully validated." },
            color = StatusVerifiedGreen,
            icon = Icons.Filled.CheckCircle,
            isSuccess = true,
        )
        is CheckInResult.Flagged -> StatusDialogVisual(
            title = s("Attendance Flagged for Review", "समीक्षा हेतु चिह्नित"),
            subtitle = "Saved, but your organization admin will need to double-check this one. Why: " +
                humanizeReasons(result.reasons).joinToString("; "),
            color = StatusFlaggedOrange,
            icon = Icons.Filled.Warning,
            isSuccess = false,
        )
        is CheckInResult.Rejected -> StatusDialogVisual(
            title = s("Check-In Not Accepted", "चेक-इन स्वीकार नहीं हुआ"),
            subtitle = humanizeReason(result.reason),
            color = StatusRejectedRed,
            icon = Icons.Filled.Error,
            isSuccess = false,
        )
        CheckInResult.SavedOffline -> StatusDialogVisual(
            title = s("Saved — Queued to Sync", "सहेजा गया — सिंक होना बाकी है"),
            subtitle = "Your check-in is saved securely on this device. It'll try syncing right away, and is guaranteed to sync within 15 minutes even if the network or server is busy — check History for the confirmed status.",
            color = StatusPendingAmber,
            icon = Icons.Filled.HourglassTop,
            isSuccess = true,
        )
        is CheckInResult.Error -> StatusDialogVisual(
            title = s("Could Not Check In", "चेक-इन नहीं हो सका"),
            subtitle = result.message,
            color = StatusRejectedRed,
            icon = Icons.Filled.Error,
            isSuccess = false,
        )
    }

    var animatedScale by remember { mutableStateOf(0.7f) }
    LaunchedEffect(Unit) {
        animatedScale = 1f
    }
    val scale by animateFloatAsState(
        targetValue = animatedScale,
        animationSpec = tween(350, easing = FastOutSlowInEasing),
        label = "dialogScale",
    )

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = true,
        ),
    ) {
        // Dimmed backdrop scrim (70% dark overlay) to blur and focus foreground
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.70f))
                .clickable(onClick = onDismiss)
                .padding(24.dp),
            contentAlignment = Alignment.Center,
        ) {
            // SOLID, Opaque Dialog Container (No background bleed-through)
            Surface(
                shape = RoundedCornerShape(32.dp),
                color = if (isDark) DarkDialogSurface else LightDialogCream,
                shadowElevation = 24.dp,
                border = BorderStroke(
                    1.5.dp,
                    Brush.linearGradient(
                        listOf(
                            color.copy(alpha = 0.6f),
                            AmberGold.copy(alpha = 0.35f),
                            color.copy(alpha = 0.6f),
                        )
                    )
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .scale(scale)
                    .clickable(enabled = false) {}, // Prevent dismiss when clicking inside dialog
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(28.dp),
                ) {
                    // Status Icon Badge with Pulsating Halo (Clean icon, no star shapes)
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(color.copy(alpha = 0.15f))
                            .border(2.dp, color.copy(alpha = 0.45f), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = title,
                            tint = color,
                            modifier = Modifier.size(44.dp),
                        )
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    Text(
                        text = title,
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = color,
                        textAlign = TextAlign.Center,
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    if (isSuccess) {
                        Text(
                            text = "Thank you, $employeeName!",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                    }

                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp,
                    )

                    Spacer(modifier = Modifier.height(18.dp))

                    // Record Timestamp & Details Box
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = if (isDark) Color(0xFF1B110B) else Color(0xFFF7EFE4),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(
                                    text = "Record Time",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Text(
                                    text = SimpleDateFormat("hh:mm a, dd MMM yyyy", Locale.getDefault()).format(Date()),
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(
                                    text = "Status",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Text(
                                    text = if (isSuccess) "RECORDED" else "ATTENTION NEEDED",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.ExtraBold),
                                    color = color,
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // OK Dismiss Button
                    Button(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = color,
                            contentColor = Color.White,
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                            .shadow(8.dp, RoundedCornerShape(16.dp), ambientColor = color.copy(alpha = 0.4f)),
                    ) {
                        Text(
                            text = if (isSuccess) "OK, Thank You" else "OK",
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                            ),
                        )
                    }
                }
            }
        }
    }
}

private data class StatusDialogVisual(
    val title: String,
    val subtitle: String,
    val color: Color,
    val icon: ImageVector,
    val isSuccess: Boolean,
)
