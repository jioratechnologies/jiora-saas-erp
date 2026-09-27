package com.saaserp.attendance.ui.checkin

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.saaserp.attendance.data.remote.ColleagueDto
import com.saaserp.attendance.ui.theme.Saffron500
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.util.UrlResolver
import com.saaserp.attendance.util.s

/** Bottom sheet to pick whom to mark In/Out for: live search with match highlighting, result count and photo cards. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ColleaguePickerSheet(
    mode: String,
    colleagues: List<ColleagueDto>,
    isLoading: Boolean,
    onSelect: (ColleagueDto) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val filtered = remember(colleagues, query) {
        val q = query.trim()
        if (q.isEmpty()) colleagues
        else colleagues.filter { it.fullName.contains(q, true) || it.email?.contains(q, true) == true }
    }
    val isIn = mode != "OUT"
    val focusManager = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val borderColor by animateColorAsState(if (focused) Saffron600 else Saffron500.copy(alpha = 0.3f), label = "searchBorder")
    val iconColor by animateColorAsState(if (focused) Saffron600 else MaterialTheme.colorScheme.onSurfaceVariant, label = "searchIcon")

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 24.dp)) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(44.dp).clip(CircleShape).background(Saffron500.copy(alpha = 0.16f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(if (isIn) Icons.Filled.Login else Icons.Filled.Logout, contentDescription = null, tint = Saffron600)
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        if (isIn) s("Mark In for…", "इनके लिए मार्क इन…") else s("Mark Out for…", "इनके लिए मार्क आउट…"),
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    )
                    Text(
                        if (isIn) s("Staff who aren't checked in", "जो स्टाफ चेक-इन नहीं हैं")
                        else s("Staff checked in, pending check-out", "चेक-इन हैं, चेक-आउट बाकी"),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            // Search pill
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(28.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    .border(if (focused) 2.dp else 1.dp, borderColor, RoundedCornerShape(28.dp))
                    .padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Search, contentDescription = null, tint = iconColor, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(10.dp))
                Box(Modifier.weight(1f).padding(vertical = 10.dp)) {
                    if (query.isEmpty()) {
                        Text(
                            s("Search name or email", "नाम या ईमेल खोजें"),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                        )
                    }
                    BasicTextField(
                        value = query,
                        onValueChange = { query = it },
                        singleLine = true,
                        interactionSource = interaction,
                        textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
                        cursorBrush = SolidColor(Saffron600),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = { keyboard?.hide(); focusManager.clearFocus() }),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                AnimatedVisibility(visible = query.isNotEmpty(), enter = fadeIn() + scaleIn(), exit = fadeOut() + scaleOut()) {
                    IconButton(onClick = { query = "" }, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Filled.Close, contentDescription = s("Clear", "साफ़ करें"), modifier = Modifier.size(18.dp))
                    }
                }
            }

            // Result count
            if (!isLoading && colleagues.isNotEmpty()) {
                Text(
                    if (query.isBlank()) s("${colleagues.size} staff", "${colleagues.size} स्टाफ")
                    else s("${filtered.size} of ${colleagues.size} match", "${colleagues.size} में से ${filtered.size} मिले"),
                    style = MaterialTheme.typography.labelMedium,
                    color = Saffron600,
                    modifier = Modifier.padding(top = 10.dp, bottom = 4.dp),
                )
            } else {
                Spacer(Modifier.height(8.dp))
            }

            when {
                isLoading -> Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(Modifier.size(30.dp), color = Saffron600)
                }
                filtered.isEmpty() -> Column(
                    Modifier.fillMaxWidth().padding(vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Filled.PersonSearch, contentDescription = null, tint = Saffron500.copy(alpha = 0.6f), modifier = Modifier.size(44.dp))
                    Spacer(Modifier.height(8.dp))
                    Text(
                        if (colleagues.isEmpty()) {
                            if (isIn) s("Everyone is already checked in.", "सभी पहले से चेक-इन हैं।")
                            else s("Nobody is pending check-out.", "किसी का चेक-आउट बाकी नहीं है।")
                        } else s("No one matches \"$query\".", "\"$query\" से कोई मेल नहीं खाता।"),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                else -> LazyColumn(
                    modifier = Modifier.heightIn(max = 440.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(filtered, key = { it.id }) { colleague ->
                        ColleagueCard(colleague, query) { onSelect(colleague) }
                    }
                }
            }
        }
    }
}

@Composable
private fun ColleagueCard(colleague: ColleagueDto, query: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(46.dp).clip(CircleShape).background(Saffron500.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center,
        ) {
            val photo = UrlResolver.resolve(colleague.photoUrl)
            if (!photo.isNullOrBlank()) {
                coil.compose.AsyncImage(
                    model = UrlResolver.toCoilModel(photo),
                    contentDescription = colleague.fullName,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Text(colleague.fullName.trim().take(1).uppercase(), fontWeight = FontWeight.Bold, color = Saffron600)
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(highlight(colleague.fullName, query), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold))
            colleague.email?.let {
                Text(highlight(it, query), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
            }
        }
        Icon(
            Icons.AutoMirrored.Filled.ArrowForwardIos,
            contentDescription = null,
            tint = Saffron600.copy(alpha = 0.6f),
            modifier = Modifier.size(13.dp),
        )
    }
}

/** Bolds and tints the part of [text] matching [query]. */
private fun highlight(text: String, query: String) = buildAnnotatedString {
    val q = query.trim()
    val i = if (q.isEmpty()) -1 else text.indexOf(q, ignoreCase = true)
    if (i < 0) {
        append(text)
    } else {
        append(text.substring(0, i))
        withStyle(SpanStyle(fontWeight = FontWeight.ExtraBold, color = Saffron600)) { append(text.substring(i, i + q.length)) }
        append(text.substring(i + q.length))
    }
}
