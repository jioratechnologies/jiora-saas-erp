package com.saaserp.attendance.ui.login

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saaserp.attendance.R
import com.saaserp.attendance.ui.components.GlassSurface
import com.saaserp.attendance.ui.theme.AmberGold
import com.saaserp.attendance.ui.theme.Saffron500
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.ui.theme.Saffron700
import com.saaserp.attendance.util.s

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    viewModel: LoginViewModel = viewModel(),
    onLoggedIn: () -> Unit,
) {
    val state by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current
    val scrollState = rememberScrollState()
    val passwordFocusRequester = remember { FocusRequester() }

    // Android 13+ needs a runtime grant for the "request approved/rejected" notification.
    val notificationPermissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { }

    var passwordVisible by remember { mutableStateOf(false) }
    var showContactSheet by remember { mutableStateOf(false) }
    var showLanguageDialog by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val appContext = LocalContext.current.applicationContext
    val authRepositoryForLanguage = remember { com.saaserp.attendance.di.ServiceLocator.authRepository(appContext) }
    val currentLanguage by authRepositoryForLanguage.appLanguageFlow.collectAsState()

    LaunchedEffect(state.loggedIn) {
        if (state.loggedIn) onLoggedIn()
    }

    @OptIn(ExperimentalLayoutApi::class)
    val isImeVisible = WindowInsets.isImeVisible
    val bottomInsets = if (isImeVisible) WindowInsets.ime else WindowInsets.navigationBars

    // Full screen layout: scrollable brand + form on top, developer credit
    // pinned as a fixed footer so it always sits flush above the
    // keyboard (ime) / gesture bar without dead space.
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .windowInsetsPadding(bottomInsets),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(scrollState)
                    .padding(horizontal = 24.dp)
                    .padding(top = 20.dp, bottom = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
            // ── Language toggle — pick before signing in, changeable later from the profile menu ──
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.End,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50.dp))
                        .border(1.dp, Saffron500.copy(alpha = 0.35f), RoundedCornerShape(50.dp))
                        .clickable { showLanguageDialog = true }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                ) {
                    Icon(Icons.Filled.Language, contentDescription = null, tint = Saffron600, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        currentLanguage.displayName,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = Saffron600,
                    )
                }
            }

            // ── Top Brand Header with Full Transparent SaaS ERP Logo ──
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
            ) {
                // Full Transparent SaaS ERP Official Logo
                Image(
                    painter = painterResource(R.drawable.dsps_logo),
                    contentDescription = "SaaS ERP Official Logo",
                    modifier = Modifier
                        .size(105.dp)
                        .padding(bottom = 6.dp),
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Divya Sanatan Public Organization",
                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground,
                    textAlign = TextAlign.Center,
                )

                Spacer(modifier = Modifier.height(6.dp))

                // Modern Pill Badge
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50.dp))
                        .background(Saffron500.copy(alpha = 0.15f))
                        .border(1.dp, Saffron500.copy(alpha = 0.35f), RoundedCornerShape(50.dp))
                        .padding(horizontal = 12.dp, vertical = 4.dp),
                ) {
                    Icon(
                        Icons.Filled.AutoAwesome,
                        contentDescription = null,
                        tint = Saffron600,
                        modifier = Modifier.size(13.dp),
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = s("STAFF ATTENDANCE PORTAL", "स्टाफ उपस्थिति पोर्टल"),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 1.sp,
                        ),
                        color = Saffron700,
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = s("Sign in to verify staff identity & mark daily attendance", "स्टाफ पहचान सत्यापित करने और दैनिक उपस्थिति दर्ज करने के लिए साइन इन करें"),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // ── Interactive Frosted Glass Login Card ──
            GlassSurface(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = 24.dp,
                elevation = 28.dp,
            ) {
                Text(
                    text = s("Staff Sign In", "स्टाफ साइन इन"),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(bottom = 16.dp),
                )

                // ── Email or Phone Input Field ──
                OutlinedTextField(
                    value = state.email,
                    onValueChange = viewModel::onEmailChange,
                    label = { Text(s("Staff Email or Phone", "स्टाफ ईमेल या फ़ोन")) },
                    placeholder = {
                        Text(
                            "e.g. staff@dspsupaul.com or 98765 43210",
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                        )
                    },
                    leadingIcon = {
                        Icon(
                            Icons.Filled.Email,
                            contentDescription = "Email icon",
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    },
                    trailingIcon = {
                        if (state.email.isNotEmpty()) {
                            IconButton(onClick = { viewModel.onEmailChange("") }) {
                                Icon(
                                    Icons.Filled.Clear,
                                    contentDescription = "Clear email",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Next,
                        autoCorrect = false,
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { passwordFocusRequester.requestFocus() }
                    ),
                    shape = RoundedCornerShape(16.dp),
                    colors = modernGlassTextFieldColors(),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )

                Spacer(modifier = Modifier.height(14.dp))

                // ── Password Input Field with Visibility Toggle ──
                OutlinedTextField(
                    value = state.password,
                    onValueChange = viewModel::onPasswordChange,
                    label = { Text("Password") },
                    placeholder = { Text(s("Enter your account password", "अपना पासवर्ड दर्ज करें"), style = MaterialTheme.typography.bodySmall) },
                    leadingIcon = {
                        Icon(
                            Icons.Filled.Lock,
                            contentDescription = "Password icon",
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    },
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                                contentDescription = if (passwordVisible) "Hide password" else "Show password",
                                tint = if (passwordVisible) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done,
                        autoCorrect = false,
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            focusManager.clearFocus()
                            viewModel.login()
                        }
                    ),
                    shape = RoundedCornerShape(16.dp),
                    colors = modernGlassTextFieldColors(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .focusRequester(passwordFocusRequester),
                    singleLine = true,
                )

                // ── Animated Error Message ──
                AnimatedVisibility(
                    visible = state.error != null,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically(),
                ) {
                    state.error?.let { err ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 12.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.error.copy(alpha = 0.12f))
                                .border(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                        ) {
                            Icon(
                                Icons.Filled.ErrorOutline,
                                contentDescription = "Error",
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = err,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                            )
                        }
                    }
                }

                // Remember-me + Forgot password row. Credentials persist in the
                // encrypted store when checked, so logout lands back here
                // prefilled for one-tap sign-in.
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable { viewModel.onRememberMeChange(!state.rememberMe) },
                    ) {
                        Checkbox(
                            checked = state.rememberMe,
                            onCheckedChange = viewModel::onRememberMeChange,
                        )
                        Text(
                            text = s("Remember me", "मुझे याद रखें"),
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        text = s("Forgot password?", "पासवर्ड भूल गए?"),
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = Saffron600,
                        modifier = Modifier.clickable { viewModel.openForgotPassword() },
                    )
                }

                // ── Password reset request status (stored on this device, checked with the server) ──
                state.resetRequest?.let { request ->
                    val pending = request.status == "pending"
                    val approved = request.status == "approved"
                    val tint = when {
                        approved -> androidx.compose.ui.graphics.Color(0xFF059669)
                        pending -> Saffron600
                        else -> MaterialTheme.colorScheme.error
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(tint.copy(alpha = 0.10f))
                            .border(1.dp, tint.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Filled.Lock, contentDescription = null, tint = tint, modifier = Modifier.size(22.dp))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                when {
                                    approved -> s("Password reset approved", "पासवर्ड रीसेट स्वीकृत")
                                    pending -> s("Password reset request pending", "पासवर्ड रीसेट अनुरोध लंबित")
                                    else -> s("Password reset request rejected", "पासवर्ड रीसेट अनुरोध अस्वीकृत")
                                },
                                style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                when {
                                    approved -> s("Get your temporary password from the organization admin, then sign in and set a new one.", "स्कूल एडमिन से अस्थायी पासवर्ड लें, फिर साइन इन करके नया पासवर्ड सेट करें।")
                                    pending -> s("Waiting for the organization admin for ${request.identifier}.", "${request.identifier} के लिए स्कूल एडमिन की प्रतीक्षा है।")
                                    else -> request.rejectReason ?: s("Contact the organization admin if you still need help.", "मदद के लिए स्कूल एडमिन से संपर्क करें।")
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        if (pending) {
                            if (state.resetRefreshing) {
                                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = tint)
                            } else {
                                Text(
                                    s("Check", "जाँचें"),
                                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                    color = tint,
                                    modifier = Modifier.clickable { viewModel.refreshResetRequest() }.padding(6.dp),
                                )
                            }
                        } else {
                            Text(
                                s("Dismiss", "हटाएँ"),
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                color = tint,
                                modifier = Modifier.clickable { viewModel.dismissResetRequest() }.padding(6.dp),
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // ── Sign In Button ──
                Button(
                    onClick = {
                        focusManager.clearFocus()
                        viewModel.login()
                    },
                    enabled = !state.isLoading,
                    shape = RoundedCornerShape(16.dp),
                    // Explicit disabled colors: the button keeps its solid brand
                    // fill while "Authenticating…". M3's default disabled grey
                    // composites a two-tone block (grey shell + lighter inner
                    // bar) on-device — the same seam class as the card fills.
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                        disabledContainerColor = MaterialTheme.colorScheme.primary,
                        disabledContentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .shadow(8.dp, RoundedCornerShape(16.dp), ambientColor = Saffron600.copy(alpha = 0.3f)),
                ) {
                    if (state.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.5.dp,
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = s("Authenticating…", "प्रमाणित किया जा रहा है…"),
                            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                        )
                    } else {
                        Text(
                            text = s("Sign In to Portal", "पोर्टल में साइन इन करें"),
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                            ),
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
            } // end scrollable brand + form

            // ── Pinned Footer: Interactive Developer Attribution ──
            // Fixed above the keyboard / nav bar (outer imePadding), so the
            // strip the keyboard would otherwise leave empty shows the credit.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(top = 2.dp, bottom = if (isImeVisible) 2.dp else 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Surface(
                    shape = RoundedCornerShape(50.dp),
                    color = Color.White.copy(alpha = 0.15f),
                    border = BorderStroke(
                        1.dp,
                        Brush.horizontalGradient(
                            listOf(
                                AmberGold.copy(alpha = 0.5f),
                                Saffron600.copy(alpha = 0.35f),
                                AmberGold.copy(alpha = 0.5f),
                            )
                        )
                    ),
                    modifier = Modifier
                        .clip(RoundedCornerShape(50.dp))
                        .clickable { showContactSheet = true },
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                    ) {
                        Image(
                            painter = painterResource(R.drawable.gaurav_image),
                            contentDescription = "Gaurav Bhindwar",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .size(22.dp)
                                .clip(CircleShape)
                                .border(1.dp, AmberGold, CircleShape),
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Developed & Maintained by ",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = "Gaurav Bhindwar",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.ExtraBold),
                            color = Saffron700,
                        )
                    }
                }
            }
        }

        // ── Forgot Password Dialog ──
        if (state.showForgotPassword) {
            androidx.compose.material3.AlertDialog(
                onDismissRequest = { viewModel.dismissForgotPassword() },
                icon = {
                    Icon(Icons.Filled.Lock, contentDescription = null, tint = Saffron600)
                },
                title = { Text(if (state.forgotSent) "Request Sent" else "Forgot Password?") },
                text = {
                    if (state.forgotSent) {
                        Text(
                            "Your request has been sent to the organization admin. You'll get a notification here as soon as it is approved or rejected.",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    } else {
                        Column {
                            Text(
                                "Enter your staff email or phone. Your organization admin will review the request and issue a new temporary password.",
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(bottom = 12.dp),
                            )
                            OutlinedTextField(
                                value = state.forgotIdentifier,
                                onValueChange = viewModel::onForgotIdentifierChange,
                                label = { Text("Email or Phone") },
                                singleLine = true,
                                isError = state.forgotError != null,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            state.forgotError?.let {
                                Text(
                                    it,
                                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.padding(top = 8.dp),
                                )
                            }
                        }
                    }
                },
                confirmButton = {
                    if (state.forgotSent) {
                        Button(onClick = { viewModel.dismissForgotPassword() }) {
                            Text("Done")
                        }
                    } else {
                        Button(
                            onClick = {
                                if (android.os.Build.VERSION.SDK_INT >= 33) {
                                    notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                                }
                                viewModel.submitForgotPassword()
                            },
                            enabled = state.forgotIdentifier.isNotBlank() && !state.forgotSubmitting,
                            colors = ButtonDefaults.buttonColors(
                                disabledContainerColor = MaterialTheme.colorScheme.primary,
                                disabledContentColor = MaterialTheme.colorScheme.onPrimary,
                            ),
                        ) {
                            if (state.forgotSubmitting) {
                                // White spinner + label: the default spinner color
                                // is primary, i.e. invisible on this orange button
                                // (it rendered as a blank pill while sending).
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    strokeWidth = 2.dp,
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Sending…")
                            } else {
                                Text("Submit Request")
                            }
                        }
                    }
                },
                dismissButton = {
                    if (!state.forgotSent) {
                        OutlinedButton(onClick = { viewModel.dismissForgotPassword() }) {
                            Text("Cancel")
                        }
                    }
                },
            )
        }

        // ── Developer Contact Bottom Sheet ──
        if (showContactSheet) {
            ModalBottomSheet(
                onDismissRequest = { showContactSheet = false },
                sheetState = sheetState,
                containerColor = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
            ) {
                DeveloperContactContent(
                    onDismiss = { showContactSheet = false },
                )
            }
        }

        if (showLanguageDialog) {
            com.saaserp.attendance.ui.components.LanguagePickerDialog(
                current = currentLanguage,
                onSelect = { authRepositoryForLanguage.setAppLanguage(it) },
                onDismiss = { showLanguageDialog = false },
            )
        }
    }
}

/**
 * Rich interactive developer contact dialog / bottom sheet content
 * Displays developer profile with actual photo, website, email, WhatsApp, and phone with direct intents & copy triggers.
 */
@Composable
private fun DeveloperContactContent(onDismiss: () -> Unit) {
    val context = LocalContext.current

    val developerWebsite = "https://gauravbhindwar.dev"
    val developerEmail = "gaurav.12bhindwar@gmail.com"
    val developerPhone = "+919006045930"
    val developerPhoneDisplay = "+91 9006045930"
    val whatsappUrl = "https://wa.me/919006045930"

    fun copyToClipboard(label: String, text: String) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(label, text))
        Toast.makeText(context, "Copied $label to clipboard", Toast.LENGTH_SHORT).show()
    }

    fun openUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "Could not open browser", Toast.LENGTH_SHORT).show()
        }
    }

    fun sendEmail(email: String) {
        try {
            val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$email")).apply {
                putExtra(Intent.EXTRA_SUBJECT, "Inquiry / Support - SaaS ERP Attendance App")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            copyToClipboard("Email", email)
        }
    }

    fun dialPhone(phone: String) {
        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            copyToClipboard("Phone number", phone)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .padding(bottom = 32.dp),
    ) {
        // Header with Actual Photo & Title
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Image(
                painter = painterResource(R.drawable.gaurav_image),
                contentDescription = "Gaurav Bhindwar",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .border(
                        2.dp,
                        Brush.linearGradient(listOf(AmberGold, Saffron600)),
                        CircleShape
                    ),
            )

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Gaurav Bhindwar",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = "Software Engineer & AI Researcher",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            IconButton(onClick = onDismiss) {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = "Close",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "For technical inquiries, app support, updates, or feature requests, feel free to reach out directly:",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            lineHeight = 18.sp,
        )

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
        Spacer(modifier = Modifier.height(16.dp))

        // ── Contact Item: Website ──
        ContactItemRow(
            icon = Icons.Filled.Language,
            iconTint = AmberGold,
            title = "Personal Website & Portfolio",
            value = developerWebsite,
            primaryActionLabel = "Visit",
            onPrimaryAction = { openUrl(developerWebsite) },
            onCopy = { copyToClipboard("Website", developerWebsite) },
        )

        Spacer(modifier = Modifier.height(12.dp))

        // ── Contact Item: Email ──
        ContactItemRow(
            icon = Icons.Filled.Email,
            iconTint = Saffron600,
            title = "Email Address",
            value = developerEmail,
            primaryActionLabel = "Mail",
            onPrimaryAction = { sendEmail(developerEmail) },
            onCopy = { copyToClipboard("Email", developerEmail) },
        )

        Spacer(modifier = Modifier.height(12.dp))

        // ── Contact Item: WhatsApp (official brand glyph, not generic chat) ──
        ContactItemRow(
            iconRes = R.drawable.ic_whatsapp,
            iconTint = Color(0xFF25D366),
            title = "WhatsApp Direct Chat",
            value = "Direct Chat ($developerPhoneDisplay)",
            primaryActionLabel = "Chat",
            onPrimaryAction = { openUrl(whatsappUrl) },
            onCopy = { copyToClipboard("WhatsApp", whatsappUrl) },
        )

        Spacer(modifier = Modifier.height(12.dp))

        // ── Contact Item: Phone / Dial ──
        ContactItemRow(
            icon = Icons.Filled.Phone,
            iconTint = Color(0xFF3B82F6),
            title = "Phone / Call",
            value = developerPhoneDisplay,
            primaryActionLabel = "Call",
            onPrimaryAction = { dialPhone(developerPhone) },
            onCopy = { copyToClipboard("Phone", developerPhoneDisplay) },
        )

        Spacer(modifier = Modifier.height(20.dp))

        Button(
            onClick = onDismiss,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant,
                contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Done")
        }
    }
}

@Composable
private fun ContactItemRow(
    iconTint: Color,
    title: String,
    value: String,
    primaryActionLabel: String,
    onPrimaryAction: () -> Unit,
    onCopy: () -> Unit,
    icon: ImageVector? = null,
    iconRes: Int? = null,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
        border = BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)
        ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(if (iconRes != null) Color.Transparent else iconTint.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                if (iconRes != null) {
                    Icon(
                        painter = painterResource(iconRes),
                        contentDescription = null,
                        tint = Color.Unspecified,
                        modifier = Modifier.size(28.dp),
                    )
                } else if (icon != null) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = iconTint,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = value,
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                )
            }

            Spacer(modifier = Modifier.width(6.dp))

            IconButton(
                onClick = onCopy,
                modifier = Modifier.size(32.dp),
            ) {
                Icon(
                    Icons.Filled.ContentCopy,
                    contentDescription = "Copy",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
            }

            OutlinedButton(
                onClick = onPrimaryAction,
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(
                    horizontal = 10.dp,
                    vertical = 4.dp
                ),
                modifier = Modifier.height(32.dp),
            ) {
                Text(
                    text = primaryActionLabel,
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                )
            }
        }
    }
}

/**
 * Text fields sit INSIDE the frosted-glass login card, so their containers
 * are transparent: the card's own gradient is the single translucent layer
 * (see the single-layer rule in GlassSurface.kt / Color.kt). The previous
 * White@0.38/0.55 fills composited a second layer over the glass and drew a
 * visible rectangular seam around every field. Focus is still signalled by
 * the border/label switching to the theme primary color.
 */
@Composable
private fun modernGlassTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = Color.Transparent,
    unfocusedContainerColor = Color.Transparent,
    disabledContainerColor = Color.Transparent,
    errorContainerColor = Color.Transparent,
    focusedBorderColor = MaterialTheme.colorScheme.primary,
    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
    focusedLabelColor = MaterialTheme.colorScheme.primary,
    unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
    cursorColor = MaterialTheme.colorScheme.primary,
)
