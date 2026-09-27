package com.saaserp.attendance

import android.os.Bundle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.TextButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.saaserp.attendance.data.auth.AuthRepository
import com.saaserp.attendance.di.ServiceLocator
import com.saaserp.attendance.ui.checkin.CheckInScreen
import com.saaserp.attendance.ui.components.GlassBackdrop
import com.saaserp.attendance.ui.components.GlassSurface
import com.saaserp.attendance.ui.history.HistoryScreen
import com.saaserp.attendance.ui.login.LoginScreen
import com.saaserp.attendance.ui.profile.ProfileScreen
import com.saaserp.attendance.ui.setpassword.SetPasswordScreen
import com.saaserp.attendance.ui.theme.AmberGold
import com.saaserp.attendance.ui.theme.DarkDialogSurface
import com.saaserp.attendance.ui.theme.DarkFloatingBar
import com.saaserp.attendance.ui.theme.LightCreamCard
import com.saaserp.attendance.ui.theme.LightDialogCream
import com.saaserp.attendance.ui.theme.DspsAttendanceTheme
import com.saaserp.attendance.ui.theme.Saffron500
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.ui.theme.Saffron700
import com.saaserp.attendance.ui.theme.StatusRejectedRed
import com.saaserp.attendance.ui.tour.CoachAction
import com.saaserp.attendance.ui.tour.CoachMarkOverlay
import com.saaserp.attendance.ui.tour.CoachMarkRegistry
import com.saaserp.attendance.ui.tour.CoachStep
import com.saaserp.attendance.ui.tour.LocalCoachMarks
import com.saaserp.attendance.ui.tour.coachTarget
import com.saaserp.attendance.util.BiometricLockHelper
import com.saaserp.attendance.util.s

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge() // Full bleed glass canvas behind system bars
        handleReminderIntent(intent)
        setContent {
            DspsAttendanceTheme {
                DspsApp(activity = this)
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleReminderIntent(intent)
    }

    /** A tapped mark-in / mark-out reminder notification asks the home screen to show its dialog. */
    private fun handleReminderIntent(intent: android.content.Intent?) {
        intent?.getStringExtra(com.saaserp.attendance.sync.ReminderNotifier.EXTRA_ACTION)?.let {
            com.saaserp.attendance.sync.ReminderNotifier.pendingAction.value = it
            intent.removeExtra(com.saaserp.attendance.sync.ReminderNotifier.EXTRA_ACTION)
        }
    }
}

/**
 * Two tours. QUICK: profile/language, camera check-in, history (+ roster for
 * roster-access roles). EXTENDED: the whole app in depth — profile editing,
 * security, mark in/out, marking for colleagues, history details, and the
 * roster/export for roster-access roles.
 */
private fun coachSteps(canViewRoster: Boolean, extended: Boolean): List<CoachStep> = buildList {
    add(CoachStep(
        "profile", Routes.CHECK_IN, Icons.Filled.Person,
        "Your profile menu", "आपका प्रोफ़ाइल मेन्यू",
        "Tap your photo here to open your profile, change the app language, replay this tour, or sign out. Language can be switched between English and Hindi at any time.",
        "अपनी फ़ोटो दबाकर प्रोफ़ाइल खोलें, ऐप की भाषा बदलें, यह टूर दोबारा देखें या साइन आउट करें। भाषा कभी भी अंग्रेज़ी और हिंदी के बीच बदली जा सकती है।",
        action = CoachAction.CHANGE_LANGUAGE,
    ))

    if (extended) {
        add(CoachStep(
            "profile_photo", Routes.PROFILE, Icons.Filled.CameraAlt,
            "Change your photo", "अपनी फ़ोटो बदलें",
            "This is your profile page. Tap Change Photo to take a new picture or pick one from your gallery, then crop it. Your portrait shows to colleagues and admins.",
            "यह आपका प्रोफ़ाइल पेज है। नई फ़ोटो लेने या गैलरी से चुनने के लिए फ़ोटो बदलें दबाएँ, फिर उसे क्रॉप करें। आपकी फ़ोटो सहकर्मियों और एडमिन को दिखती है।",
        ))
        add(CoachStep(
            "profile_contact", Routes.PROFILE, Icons.Filled.Phone,
            "Add your contact details", "अपने संपर्क विवरण जोड़ें",
            "Keep your mobile number up to date here so the office can reach you. Save your changes with the button at the bottom of the page.",
            "यहाँ अपना मोबाइल नंबर अपडेट रखें ताकि कार्यालय आपसे संपर्क कर सके। पेज के नीचे दिए बटन से बदलाव सहेजें।",
        ))
        add(CoachStep(
            "profile_biometric", Routes.PROFILE, Icons.Filled.Fingerprint,
            "Turn on biometric lock", "बायोमेट्रिक लॉक चालू करें",
            "Switch this on to protect the app with your fingerprint, face or screen lock every time it opens. Your phone must have a screen lock set.",
            "ऐप खुलने पर हर बार फ़िंगरप्रिंट, फ़ेस या स्क्रीन लॉक से सुरक्षा के लिए इसे चालू करें। फ़ोन में स्क्रीन लॉक सेट होना चाहिए।",
        ))
        add(CoachStep(
            "profile_password", Routes.PROFILE, Icons.Filled.Lock,
            "Change your password", "अपना पासवर्ड बदलें",
            "Tap here, enter your current password and then a new one (at least 6 characters) to change it.",
            "यहाँ दबाएँ, वर्तमान पासवर्ड और फिर नया पासवर्ड (कम से कम 6 अक्षर) दर्ज करके उसे बदलें।",
        ))
    }

    add(CoachStep(
        "checkin_main", Routes.CHECK_IN, Icons.Filled.CameraAlt,
        "Mark your attendance", "अपनी उपस्थिति दर्ज करें",
        if (extended) "Tap Check In at organization. The app verifies you are on campus by GPS, opens the front camera, and asks for a quick blink and a selfie. It works offline too and syncs later."
        else "Tap here at organization. The app checks your location, then opens the camera for a selfie. Come back and tap again to check out.",
        if (extended) "स्कूल में चेक इन दबाएँ। ऐप GPS से जाँचता है कि आप परिसर में हैं, फ्रंट कैमरा खोलता है और एक पलक झपकाने व सेल्फ़ी के लिए कहता है। यह ऑफ़लाइन भी काम करता है और बाद में सिंक हो जाता है।"
        else "स्कूल में यहाँ दबाएँ। ऐप आपकी लोकेशन जाँचकर सेल्फ़ी के लिए कैमरा खोलेगा। चेक-आउट के लिए दोबारा दबाएँ।",
    ))

    if (extended) {
        add(CoachStep(
            "checkin_main", Routes.CHECK_IN, Icons.Filled.Logout,
            "Marking out", "मार्क आउट करना",
            "After checking in, this same card becomes Check Out. Use it when you leave. Leaving early? Choose Request Half-Day. You can check in again later for another shift, and get a reminder notification after organization time if you forget.",
            "चेक-इन के बाद यही कार्ड चेक आउट बन जाता है। जाते समय इसे दबाएँ। जल्दी जाना है? हाफ-डे का अनुरोध चुनें। दूसरी शिफ़्ट के लिए बाद में फिर चेक-इन कर सकते हैं, और भूलने पर स्कूल समय के बाद रिमाइंडर मिलेगा।",
        ))
        add(CoachStep(
            "colleague", Routes.CHECK_IN, Icons.Filled.People,
            "Mark for a colleague", "सहकर्मी के लिए दर्ज करें",
            "A colleague forgot their phone or has no signal? Tap here to record their attendance from your phone. You will first choose Mark In or Mark Out.",
            "सहकर्मी फ़ोन भूल गए या नेटवर्क नहीं है? अपने फ़ोन से उनकी उपस्थिति दर्ज करने के लिए यहाँ दबाएँ। पहले मार्क इन या मार्क आउट चुनना होगा।",
        ))
        add(CoachStep(
            "colleague", Routes.CHECK_IN, Icons.Filled.Login,
            "Mark In for a colleague", "सहकर्मी को मार्क इन",
            "Mark In lists staff who are not checked in yet. Search by name or email, tap the person, then confirm your location and take their photo. It is saved under your name as the marker.",
            "मार्क इन में वे स्टाफ दिखते हैं जो अभी चेक-इन नहीं हैं। नाम या ईमेल से खोजें, व्यक्ति को चुनें, फिर लोकेशन की पुष्टि करें और उनकी फ़ोटो लें। यह आपके नाम से दर्ज होता है।",
        ))
        add(CoachStep(
            "colleague", Routes.CHECK_IN, Icons.Filled.Logout,
            "Mark Out for a colleague", "सहकर्मी को मार्क आउट",
            "Mark Out lists only staff who are checked in and still pending check-out. Pick the person and take their photo at the time they leave.",
            "मार्क आउट में केवल वे स्टाफ दिखते हैं जो चेक-इन हैं और चेक-आउट बाकी है। व्यक्ति को चुनें और उनके जाते समय फ़ोटो लें।",
        ))
    }

    add(CoachStep(
        "nav_history", Routes.HISTORY, Icons.Filled.History,
        "Your attendance history", "आपका उपस्थिति इतिहास",
        "See every check-in and check-out, its verification status, and anything still waiting to sync.",
        "हर चेक-इन और चेक-आउट, उसकी सत्यापन स्थिति और सिंक बाकी रिकॉर्ड यहाँ देखें।",
    ))

    if (extended) {
        add(CoachStep(
            "history_day", Routes.HISTORY, Icons.Filled.CalendarMonth,
            "Open a day's full details", "दिन का पूरा विवरण खोलें",
            "Tap any day to open a dialog with every punch: the exact time, the photo, GPS location on a map, verification status and whether it was half-day or early leave. You can filter by date range above.",
            "किसी भी दिन को दबाने पर हर उपस्थिति का विवरण खुलता है: सटीक समय, फ़ोटो, मानचित्र पर GPS स्थान, सत्यापन स्थिति और हाफ-डे या जल्दी जाना। ऊपर से तारीख सीमा से फ़िल्टर करें।",
        ))
        add(CoachStep(
            "history_marked_tab", Routes.HISTORY, Icons.Filled.People,
            "Marked by Me", "मेरे द्वारा दर्ज",
            "This tab shows today's attendance you marked for colleagues. Tap a colleague's photo for their full details. If they are still checked in, a Mark Out button appears; once they are out, you see their check-out time.",
            "यह टैब आज सहकर्मियों के लिए आपकी दर्ज की गई उपस्थिति दिखाता है। पूरा विवरण देखने के लिए सहकर्मी की फ़ोटो दबाएँ। अगर वे अभी चेक-इन हैं तो मार्क आउट बटन दिखता है; बाहर जाने के बाद उनका चेक-आउट समय दिखता है।",
        ))
    }

    if (canViewRoster) {
        add(CoachStep(
            "nav_roster", Routes.ADMIN_ROSTER, Icons.Filled.Groups,
            "Staff roster", "स्टाफ रोस्टर",
            "As an admin you can see live attendance for all staff here.",
            "एडमिन के रूप में आप यहाँ सभी स्टाफ की लाइव उपस्थिति देख सकते हैं।",
        ))
        if (extended) {
            add(CoachStep(
                "roster_date", Routes.ADMIN_ROSTER, Icons.Filled.CalendarMonth,
                "Pick a date", "तारीख चुनें",
                "Move day by day with the arrows, or tap the date to jump to any earlier day.",
                "तीरों से दिन-दर-दिन आगे-पीछे जाएँ, या किसी भी पिछली तारीख के लिए तारीख दबाएँ।",
            ))
            add(CoachStep(
                "roster_list", Routes.ADMIN_ROSTER, Icons.Filled.People,
                "Staff and their punches", "स्टाफ और उनकी उपस्थिति",
                "Tap a staff member to see each punch with its photo, verification status and GPS location on a map.",
                "किसी स्टाफ को दबाकर हर उपस्थिति की फ़ोटो, सत्यापन स्थिति और मानचित्र पर GPS स्थान देखें।",
            ))
        }
        add(CoachStep(
            "roster_export", Routes.ADMIN_ROSTER, Icons.Filled.Download,
            "Export attendance", "उपस्थिति एक्सपोर्ट करें",
            "Download attendance for any date range as PDF, Excel or CSV, for everyone or one staff member.",
            "किसी भी अवधि की उपस्थिति PDF, Excel या CSV में डाउनलोड करें, सभी या किसी एक स्टाफ के लिए।",
        ))
    }
}

private object Routes {
    const val LOGIN = "login"
    const val SET_PASSWORD = "set_password"
    const val CHECK_IN = "check_in"
    const val HISTORY = "history"
    const val PROFILE = "profile"
    const val ADMIN_ROSTER = "admin_roster"
}

@Composable
private fun DspsApp(activity: FragmentActivity) {
    val context = LocalContext.current
    val navController = rememberNavController()
    val authRepository = remember { ServiceLocator.authRepository(context) }
    val isDark = isSystemInDarkTheme()

    // App Lock Security State
    var isAppUnlocked by remember {
        mutableStateOf(!authRepository.isAppLockEnabled)
    }
    var lockErrorMessage by remember { mutableStateOf<String?>(null) }

    // Exit App Confirmation Dialog State
    var showExitDialog by remember { mutableStateOf(false) }
    var showLanguageDialog by remember { mutableStateOf(false) }

    // Guided spotlight tour over the live screens (replaces the old slide-show tour).
    val coachRegistry = remember { CoachMarkRegistry() }
    var showCoachTour by remember { mutableStateOf(false) }
    // Set on every sign-in so the tour chooser appears each time someone logs in (not only the first time).
    var tourAfterLogin by remember { mutableStateOf(false) }
    var coachExtended by remember { mutableStateOf<Boolean?>(null) } // null = still choosing Quick vs Full

    val startDestination = remember {
        when {
            !authRepository.isLoggedIn -> Routes.LOGIN
            authRepository.mustChangePassword -> Routes.SET_PASSWORD
            else -> Routes.CHECK_IN
        }
    }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val canViewRoster by authRepository.canViewRosterAttendanceFlow.collectAsState()
    val appLanguage by authRepository.appLanguageFlow.collectAsState()

    // Trigger biometric prompt when app lock is enabled and locked
    LaunchedEffect(authRepository.isAppLockEnabled) {
        if (authRepository.isAppLockEnabled && !isAppUnlocked) {
            BiometricLockHelper.showBiometricPrompt(
                activity = activity,
                onSuccess = {
                    isAppUnlocked = true
                    lockErrorMessage = null
                },
                onError = { error ->
                    lockErrorMessage = error
                },
            )
        }
    }

    // First login on this device: start the tour once we land on the home screen.
    LaunchedEffect(currentRoute) {
        if (currentRoute == Routes.CHECK_IN && authRepository.isLoggedIn && (tourAfterLogin || !authRepository.hasSeenTour)) {
            tourAfterLogin = false
            coachExtended = null
            showCoachTour = true
        }
    }

    // Android 13+ needs a runtime grant for the check-out reminder notification.
    val notificationPermissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { }
    LaunchedEffect(authRepository.isLoggedIn) {
        if (authRepository.isLoggedIn && android.os.Build.VERSION.SDK_INT >= 33 &&
            androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) !=
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }
        // App is open — any pending reminder has done its job.
        com.saaserp.attendance.sync.CheckoutReminderWorker.cancelReminder(context)
    }

    // A repository reports a definitively dead session (401 survives the
    // OkHttp Authenticator's own silent refresh) via this — same recovery
    // as a manual sign-out, so an expired session never just leaves the
    // user stuck on a broken screen.
    LaunchedEffect(Unit) {
        com.saaserp.attendance.data.auth.SessionEvents.expired.collect {
            authRepository.logout()
            navController.navigate(Routes.LOGIN) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    // Intercept back press on root screens to ask for exit confirmation
    val isRootRoute = currentRoute == Routes.CHECK_IN || currentRoute == Routes.LOGIN
    BackHandler(enabled = isRootRoute && isAppUnlocked) {
        showExitDialog = true
    }

    CompositionLocalProvider(
        com.saaserp.attendance.util.LocalAppLanguage provides appLanguage,
        LocalCoachMarks provides coachRegistry,
    ) {
    Box(modifier = Modifier.fillMaxSize()) {
        GlassBackdrop(modifier = Modifier.fillMaxSize())

        if (authRepository.isAppLockEnabled && !isAppUnlocked) {
            // Lock Screen UI Gate
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                GlassSurface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(28.dp),
                    contentPadding = 0.dp,
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(28.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Image(
                            painter = painterResource(R.drawable.dsps_logo),
                            contentDescription = "SaaS ERP Logo",
                            modifier = Modifier.size(72.dp),
                        )

                        Spacer(Modifier.height(16.dp))

                        Text(
                            "Divya Sanatan Public Organization",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground,
                            textAlign = TextAlign.Center,
                        )

                        Text(
                            "Attendance Portal Locked",
                            style = MaterialTheme.typography.bodySmall,
                            color = Saffron600,
                            fontWeight = FontWeight.SemiBold,
                        )

                        Spacer(Modifier.height(28.dp))

                        Box(
                            modifier = Modifier
                                .size(84.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(listOf(Saffron500.copy(alpha = 0.2f), AmberGold.copy(alpha = 0.2f)))
                                )
                                .border(1.5.dp, Saffron500.copy(alpha = 0.5f), CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Filled.Fingerprint,
                                contentDescription = "Biometric Lock",
                                tint = Saffron600,
                                modifier = Modifier.size(48.dp),
                            )
                        }

                        Spacer(Modifier.height(20.dp))

                        Text(
                            "App Lock is active for your privacy.\nVerify your fingerprint, face, or device PIN to continue.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            lineHeight = 18.sp,
                        )

                        if (lockErrorMessage != null) {
                            Spacer(Modifier.height(12.dp))
                            Text(
                                lockErrorMessage ?: "",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFFEF4444),
                                fontWeight = FontWeight.SemiBold,
                                textAlign = TextAlign.Center,
                            )
                        }

                        Spacer(Modifier.height(28.dp))

                        Button(
                            onClick = {
                                lockErrorMessage = null
                                BiometricLockHelper.showBiometricPrompt(
                                    activity = activity,
                                    onSuccess = {
                                        isAppUnlocked = true
                                        lockErrorMessage = null
                                    },
                                    onError = { error ->
                                        lockErrorMessage = error
                                    },
                                )
                            },
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Saffron600,
                                contentColor = Color.White,
                            ),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(Icons.Filled.Lock, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Unlock SaaS ERP Attendance", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        } else {
            Scaffold(
                containerColor = Color.Transparent,
                topBar = {
                    if (currentRoute == Routes.CHECK_IN || currentRoute == Routes.HISTORY || currentRoute == Routes.ADMIN_ROSTER) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .statusBarsPadding()
                                .padding(horizontal = 20.dp, vertical = 12.dp),
                        ) {
                            Image(
                                painter = painterResource(R.drawable.dsps_logo),
                                contentDescription = "SaaS ERP logo",
                                modifier = Modifier.size(36.dp),
                            )
                            Text(
                                "Divya Sanatan Public Organization",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onBackground,
                                modifier = Modifier.padding(start = 10.dp).weight(1f),
                                maxLines = 1,
                            )
                            Box(modifier = Modifier.coachTarget("profile")) {
                            ProfileMenu(
                                authRepository = authRepository,
                                language = appLanguage,
                                onOpenProfile = {
                                    navController.navigate(Routes.PROFILE)
                                },
                                onOpenTour = {
                                    navController.navigate(Routes.CHECK_IN) {
                                        popUpTo(navController.graph.startDestinationId) { saveState = true }
                                        launchSingleTop = true
                                    }
                                    coachExtended = null
                                    showCoachTour = true
                                },
                                onOpenLanguage = { showLanguageDialog = true },
                                onLoggedOut = {
                                    authRepository.logout()
                                    navController.navigate(Routes.LOGIN) {
                                        popUpTo(0) { inclusive = true }
                                    }
                                },
                            )
                            }
                        }
                    }
                },
                bottomBar = {
                    if (currentRoute == Routes.CHECK_IN || currentRoute == Routes.HISTORY || currentRoute == Routes.ADMIN_ROSTER) {
                        NavigationBar(
                            // Fully opaque (was 0.92/0.95 alpha): same strip/seam
                            // risk as the profile save bar over the backdrop.
                            containerColor = if (isDark) DarkFloatingBar else LightCreamCard,
                            tonalElevation = 8.dp,
                            modifier = Modifier
                                .padding(horizontal = 20.dp, vertical = 12.dp)
                                .shadow(
                                    elevation = 16.dp,
                                    shape = RoundedCornerShape(32.dp),
                                    ambientColor = Saffron600.copy(alpha = 0.25f),
                                    spotColor = Saffron600.copy(alpha = 0.35f),
                                )
                                .clip(RoundedCornerShape(32.dp))
                                .border(
                                    1.dp,
                                    Brush.horizontalGradient(
                                        listOf(
                                            AmberGold.copy(alpha = 0.6f),
                                            Saffron500.copy(alpha = 0.4f),
                                            AmberGold.copy(alpha = 0.6f),
                                        )
                                    ),
                                    RoundedCornerShape(32.dp),
                                ),
                        ) {
                            NavigationBarItem(
                                modifier = Modifier.coachTarget("nav_checkin"),
                                selected = currentRoute == Routes.CHECK_IN,
                                onClick = {
                                    navController.navigate(Routes.CHECK_IN) {
                                        popUpTo(navController.graph.startDestinationId) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(Icons.Filled.CameraAlt, contentDescription = "Check In") },
                                label = { Text(s("Check In", "चेक इन"), fontWeight = if (currentRoute == Routes.CHECK_IN) FontWeight.Bold else FontWeight.Medium) },
                                colors = NavigationBarItemDefaults.colors(
                                    indicatorColor = Saffron500.copy(alpha = 0.22f),
                                    selectedIconColor = Saffron600,
                                    selectedTextColor = Saffron700,
                                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                ),
                            )
                            NavigationBarItem(
                                modifier = Modifier.coachTarget("nav_history"),
                                selected = currentRoute == Routes.HISTORY,
                                onClick = {
                                    navController.navigate(Routes.HISTORY) {
                                        popUpTo(navController.graph.startDestinationId) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(Icons.Filled.History, contentDescription = "History") },
                                label = { Text(s("History", "इतिहास"), fontWeight = if (currentRoute == Routes.HISTORY) FontWeight.Bold else FontWeight.Medium) },
                                colors = NavigationBarItemDefaults.colors(
                                    indicatorColor = Saffron500.copy(alpha = 0.22f),
                                    selectedIconColor = Saffron600,
                                    selectedTextColor = Saffron700,
                                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                ),
                            )
                            if (canViewRoster) {
                                NavigationBarItem(
                                    modifier = Modifier.coachTarget("nav_roster"),
                                    selected = currentRoute == Routes.ADMIN_ROSTER,
                                    onClick = {
                                        navController.navigate(Routes.ADMIN_ROSTER) {
                                            popUpTo(navController.graph.startDestinationId) { saveState = true }
                                            launchSingleTop = true
                                            restoreState = true
                                        }
                                    },
                                    icon = { Icon(Icons.Filled.Groups, contentDescription = "Roster") },
                                    label = { Text(s("Roster", "रोस्टर"), fontWeight = if (currentRoute == Routes.ADMIN_ROSTER) FontWeight.Bold else FontWeight.Medium) },
                                    colors = NavigationBarItemDefaults.colors(
                                        indicatorColor = Saffron500.copy(alpha = 0.22f),
                                        selectedIconColor = Saffron600,
                                        selectedTextColor = Saffron700,
                                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                                    ),
                                )
                            }
                        }
                    }
                }
            ) { padding ->
                val tabRoutes = remember(canViewRoster) {
                    buildList {
                        add(Routes.CHECK_IN)
                        add(Routes.HISTORY)
                        if (canViewRoster) add(Routes.ADMIN_ROSTER)
                    }
                }
                fun navigateToTab(route: String) {
                    navController.navigate(route) {
                        popUpTo(navController.graph.startDestinationId) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
                val density = LocalDensity.current
                val swipeThresholdPx = with(density) { 56.dp.toPx() }

                // rememberUpdatedState, not a plain closure capture: the
                // pointerInput block below is keyed on Unit (never
                // cancelled/relaunched while attached) specifically so a
                // second swipe fired right after navigate() — before
                // Compose has recomposed with the NEW currentRoute — reads
                // the CURRENT tab, not the one this gesture handler
                // started on. Reading a stale `currentRoute` from a
                // closure captured at launch time was exactly what caused
                // the swipe-right loop (History <-> Roster, never
                // reaching Check In): a quick second swipe was still
                // handled by the outgoing coroutine, computed from the
                // tab it had already left.
                val currentRouteState = rememberUpdatedState(currentRoute)
                val tabRoutesState = rememberUpdatedState(tabRoutes)
                var lastSwipeNavAtMs by remember { mutableStateOf(0L) }

                NavHost(
                    navController = navController,
                    startDestination = startDestination,
                    modifier = Modifier
                        .padding(padding)
                        .then(
                            if (currentRoute in tabRoutes) {
                                Modifier.pointerInput(Unit) {
                                    var dragAccumX = 0f
                                    detectHorizontalDragGestures(
                                        onDragStart = { dragAccumX = 0f },
                                        onHorizontalDrag = { _, dragAmount -> dragAccumX += dragAmount },
                                        onDragEnd = {
                                            val route = currentRouteState.value
                                            val routes = tabRoutesState.value
                                            val idx = routes.indexOf(route)
                                            val now = System.currentTimeMillis()
                                            // Ignore a swipe that lands before the previous one's
                                            // navigation has actually taken effect — avoids acting
                                            // on a route that's about to change out from under it.
                                            if (idx >= 0 && now - lastSwipeNavAtMs > 400) {
                                                // Swipe left (finger moves left, negative delta) -> next tab.
                                                // Swipe right (positive delta) -> previous tab.
                                                if (dragAccumX <= -swipeThresholdPx && idx < routes.lastIndex) {
                                                    lastSwipeNavAtMs = now
                                                    navigateToTab(routes[idx + 1])
                                                } else if (dragAccumX >= swipeThresholdPx && idx > 0) {
                                                    lastSwipeNavAtMs = now
                                                    navigateToTab(routes[idx - 1])
                                                }
                                            }
                                        },
                                    )
                                }
                            } else {
                                Modifier
                            }
                        ),
                ) {
                    composable(Routes.LOGIN) {
                        LoginScreen(onLoggedIn = {
                            tourAfterLogin = true
                            val destination = when {
                                authRepository.mustChangePassword -> Routes.SET_PASSWORD
                                else -> Routes.CHECK_IN
                            }
                            navController.navigate(destination) {
                                popUpTo(Routes.LOGIN) { inclusive = true }
                            }
                        })
                    }
                    composable(Routes.SET_PASSWORD) {
                        SetPasswordScreen(onDone = {
                            navController.navigate(Routes.CHECK_IN) {
                                popUpTo(Routes.SET_PASSWORD) { inclusive = true }
                            }
                        })
                    }
                    composable(Routes.CHECK_IN) { CheckInScreen(onExitApp = { showExitDialog = true }) }
                    composable(Routes.HISTORY) {
                        HistoryScreen(onMarkOutColleague = { colleague ->
                            // Location + camera live on the check-in screen — hand the request over and go there.
                            com.saaserp.attendance.ui.checkin.ColleagueRequests.markOut.value = colleague
                            navController.navigate(Routes.CHECK_IN) {
                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true
                            }
                        })
                    }
                    composable(Routes.ADMIN_ROSTER) { com.saaserp.attendance.ui.admin.AdminRosterScreen() }
                    composable(Routes.PROFILE) {
                        ProfileScreen(
                            onNavigateBack = {
                                navController.popBackStack()
                            },
                            onLoggedOut = {
                                authRepository.logout()
                                navController.navigate(Routes.LOGIN) {
                                    popUpTo(0) { inclusive = true }
                                }
                            },
                        )
                    }
                }
            }
        }

        if (showCoachTour && isAppUnlocked) {
            val finishTour = {
                authRepository.setTourSeen(true)
                showCoachTour = false
                coachExtended = null
                if (currentRoute != Routes.CHECK_IN) {
                    navController.navigate(Routes.CHECK_IN) {
                        popUpTo(navController.graph.startDestinationId) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            }
            val extended = coachExtended
            if (extended == null) {
                // Choose how deep the tour goes.
                com.saaserp.attendance.ui.tour.TourChooserDialog(
                    canViewRoster = canViewRoster,
                    onQuick = { coachExtended = false },
                    onFull = { coachExtended = true },
                    onSkip = finishTour,
                )
            } else {
                val steps = remember(canViewRoster, extended) { coachSteps(canViewRoster, extended) }
                CoachMarkOverlay(
                    steps = steps,
                    registry = coachRegistry,
                    onStepShown = { step ->
                        val route = step.route
                        if (route != null && route != currentRoute) {
                            navController.navigate(route) {
                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true
                                restoreState = route != Routes.PROFILE
                            }
                        }
                    },
                    onFinish = finishTour,
                    onAction = { action ->
                        if (action == CoachAction.CHANGE_LANGUAGE) showLanguageDialog = true
                    },
                )
            }
        }

        // App Exit Confirmation Dialog
        if (showExitDialog) {
            AlertDialog(
                onDismissRequest = { showExitDialog = false },
                icon = {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = null,
                        tint = Saffron600,
                        modifier = Modifier.size(32.dp),
                    )
                },
                title = {
                    Text(
                        "Exit SaaS ERP Attendance?",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                },
                text = {
                    Text(
                        "Are you sure you want to close the app?",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                },
                confirmButton = {
                    Button(
                        onClick = {
                            showExitDialog = false
                            activity.finish()
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFEF4444),
                            contentColor = Color.White,
                        ),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Exit App", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    OutlinedButton(
                        onClick = { showExitDialog = false },
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Cancel", fontWeight = FontWeight.SemiBold)
                    }
                },
                containerColor = if (isDark) DarkDialogSurface else LightDialogCream,
                shape = RoundedCornerShape(24.dp),
            )
        }

        if (showLanguageDialog) {
            com.saaserp.attendance.ui.components.LanguagePickerDialog(
                current = appLanguage,
                onSelect = { authRepository.setAppLanguage(it) },
                onDismiss = { showLanguageDialog = false },
            )
        }
    }
    }
}

/** Top-right avatar (initial-letter) button — opens profile actions, app tour & log out. */
@Composable
private fun ProfileMenu(
    authRepository: AuthRepository,
    language: com.saaserp.attendance.util.AppLanguage,
    onOpenProfile: () -> Unit,
    onOpenTour: () -> Unit,
    onOpenLanguage: () -> Unit,
    onLoggedOut: () -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val name = authRepository.employeeName ?: "Employee"
    val email = authRepository.employeeEmail ?: ""

    // A plain property read here would never recompose once the app-launch
    // profile-photo fetch resolves — collecting the StateFlow is what
    // makes the avatar actually appear without needing to visit Profile.
    val rawPhotoUrl by authRepository.employeePhotoUrlFlow.collectAsState()
    val photoUrl = com.saaserp.attendance.util.UrlResolver.resolve(rawPhotoUrl)

    Box {
        IconButton(onClick = { expanded = true }) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .border(
                        1.5.dp,
                        Brush.linearGradient(
                            listOf(
                                Saffron500,
                                AmberGold,
                            )
                        ),
                        CircleShape,
                    )
                    .background(MaterialTheme.colorScheme.primary),
                contentAlignment = Alignment.Center,
            ) {
                if (!photoUrl.isNullOrBlank()) {
                    coil.compose.SubcomposeAsyncImage(
                        model = coil.request.ImageRequest.Builder(androidx.compose.ui.platform.LocalContext.current)
                            .data(com.saaserp.attendance.util.UrlResolver.toCoilModel(photoUrl))
                            .crossfade(true)
                            .build(),
                        contentDescription = "Profile Photo",
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                        error = {
                            Box(
                                modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.primary),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    name.trim().firstOrNull()?.uppercase() ?: "T",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        },
                    )
                } else {
                    Text(
                        name.trim().firstOrNull()?.uppercase() ?: "T",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onPrimary,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier
                .width(280.dp)
                .background(MaterialTheme.colorScheme.surface),
        ) {
            // Identity header — saffron/gold gradient card, bigger avatar,
            // name + email — replaces the two plain text lines a generic
            // Material dropdown starts with.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(
                        Brush.linearGradient(listOf(Saffron600.copy(alpha = 0.16f), AmberGold.copy(alpha = 0.10f)))
                    )
                    .padding(14.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .border(1.5.dp, Brush.linearGradient(listOf(Saffron500, AmberGold)), CircleShape)
                            .background(MaterialTheme.colorScheme.primary),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (!photoUrl.isNullOrBlank()) {
                            coil.compose.SubcomposeAsyncImage(
                                model = coil.request.ImageRequest.Builder(androidx.compose.ui.platform.LocalContext.current)
                                    .data(com.saaserp.attendance.util.UrlResolver.toCoilModel(photoUrl))
                                    .crossfade(true)
                                    .build(),
                                contentDescription = "Profile Photo",
                                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                                error = {
                                    Box(
                                        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.primary),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            name.trim().firstOrNull()?.uppercase() ?: "T",
                                            style = MaterialTheme.typography.titleMedium,
                                            color = MaterialTheme.colorScheme.onPrimary,
                                            fontWeight = FontWeight.Bold,
                                            textAlign = TextAlign.Center,
                                        )
                                    }
                                },
                            )
                        } else {
                            Text(
                                name.trim().firstOrNull()?.uppercase() ?: "T",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onPrimary,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text(
                            name,
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onBackground,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        if (email.isNotBlank()) {
                            Spacer(Modifier.height(2.dp))
                            Text(
                                email,
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(6.dp))

            ProfileMenuAction(
                icon = Icons.Filled.Person,
                iconTint = Saffron600,
                label = s("My Profile / Edit", "मेरी प्रोफ़ाइल / संपादित करें"),
                onClick = { expanded = false; onOpenProfile() },
            )
            ProfileMenuAction(
                icon = Icons.Filled.Explore,
                iconTint = Saffron600,
                label = s("App Tour", "ऐप टूर"),
                onClick = { expanded = false; onOpenTour() },
            )
            ProfileMenuAction(
                icon = Icons.Filled.Language,
                iconTint = Saffron600,
                label = s("Language", "भाषा"),
                trailingLabel = if (language == com.saaserp.attendance.util.AppLanguage.HI) "हिन्दी" else "English",
                onClick = { expanded = false; onOpenLanguage() },
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

            ProfileMenuAction(
                icon = Icons.AutoMirrored.Filled.Logout,
                iconTint = StatusRejectedRed,
                label = s("Log Out", "लॉग आउट"),
                labelColor = StatusRejectedRed,
                onClick = { expanded = false; onLoggedOut() },
            )

            Spacer(Modifier.height(4.dp))
        }
    }
}

@Composable
private fun ProfileMenuAction(
    icon: ImageVector,
    iconTint: Color,
    label: String,
    onClick: () -> Unit,
    labelColor: Color = MaterialTheme.colorScheme.onBackground,
    trailingLabel: String? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(iconTint.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(12.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = labelColor, modifier = Modifier.weight(1f))
        trailingLabel?.let {
            Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
