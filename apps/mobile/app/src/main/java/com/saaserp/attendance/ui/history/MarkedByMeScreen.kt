package com.saaserp.attendance.ui.history

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.window.Dialog
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import com.saaserp.attendance.data.remote.ColleagueDto
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.saaserp.attendance.data.remote.RemoteAttendanceItemDto
import com.saaserp.attendance.di.ServiceLocator
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.util.UrlResolver
import com.saaserp.attendance.util.s
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class MarkedByMeUiState(
    val isLoading: Boolean = true,
    val records: List<RemoteAttendanceItemDto> = emptyList(),
    val error: Boolean = false,
)

class MarkedByMeViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = ServiceLocator.attendanceRepository(application)
    private val _state = MutableStateFlow(MarkedByMeUiState())
    val state: StateFlow<MarkedByMeUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _state.value = _state.value.copy(isLoading = true, error = false)
        viewModelScope.launch {
            val records = repository.fetchMarkedByMe()
            _state.value = if (records != null) {
                MarkedByMeUiState(isLoading = false, records = records)
            } else {
                _state.value.copy(isLoading = false, error = true)
            }
        }
    }
}

private val IST = ZoneId.of("Asia/Kolkata")
private val TIME_FORMAT = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH).withZone(IST)

/**
 * Today's worklist of colleagues the signed-in user marked attendance for.
 * One card per colleague; tap the photo for their full details. While a
 * colleague is still checked in, a Mark Out button is offered; once they are
 * out, the check-out time is shown instead.
 */
@Composable
fun MarkedByMeScreen(viewModel: MarkedByMeViewModel = viewModel(), onMarkOut: (ColleagueDto) -> Unit = {}) {
    val state by viewModel.state.collectAsState()
    // Re-fetch every time this tab is shown (e.g. coming back after marking someone out).
    LaunchedEffect(Unit) { viewModel.refresh() }
    var detail by remember { mutableStateOf<List<RemoteAttendanceItemDto>?>(null) }

    when {
        state.isLoading && state.records.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Saffron600)
        }
        state.error && state.records.isEmpty() -> Column(
            Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(s("Couldn't load this list.", "यह सूची लोड नहीं हो सकी।"), color = MaterialTheme.colorScheme.onSurfaceVariant)
            TextButton(onClick = viewModel::refresh) { Text(s("Retry", "पुनः प्रयास")) }
        }
        state.records.isEmpty() -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text(
                s("You haven't marked anyone else's attendance today.", "आज आपने किसी और की उपस्थिति दर्ज नहीं की है।"),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        else -> {
            val byColleague = state.records.groupBy { it.employeeId ?: "" }.values.toList()
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
            ) {
                item(key = "header") {
                    Text(
                        s("Marked by you today", "आज आपके द्वारा दर्ज"),
                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                        color = Saffron600,
                    )
                }
                items(byColleague, key = { it.first().employeeId ?: it.first().hashCode().toString() }) { punches ->
                    ColleagueCard(punches, onOpenDetail = { detail = punches }, onMarkOut = onMarkOut)
                }
            }
        }
    }

    detail?.let { ColleagueDetailDialog(it, onDismiss = { detail = null }) }
}

private fun formatTime(iso: String?): String =
    iso?.let { runCatching { TIME_FORMAT.format(Instant.parse(it)) }.getOrNull() } ?: ""

@Composable
private fun Avatar(punch: RemoteAttendanceItemDto, size: androidx.compose.ui.unit.Dp, modifier: Modifier = Modifier) {
    val name = punch.employeeName ?: "?"
    Box(
        modifier = modifier.size(size).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant),
        contentAlignment = Alignment.Center,
    ) {
        val photo = UrlResolver.resolve(punch.employeePhotoUrl)
        if (!photo.isNullOrBlank()) {
            coil.compose.AsyncImage(
                model = UrlResolver.toCoilModel(photo),
                contentDescription = name,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Text(name.trim().take(1).uppercase(), fontWeight = FontWeight.Bold, color = Saffron600)
        }
    }
}

@Composable
private fun ColleagueCard(
    punches: List<RemoteAttendanceItemDto>,
    onOpenDetail: () -> Unit,
    onMarkOut: (ColleagueDto) -> Unit,
) {
    val first = punches.first()
    val name = first.employeeName ?: s("Colleague", "सहकर्मी")
    val stillIn = first.employeeLastEventType == "IN"
    val sorted = punches.sortedBy { it.capturedAt }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(first, 52.dp, Modifier.clickable(onClick = onOpenDetail))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f).clickable(onClick = onOpenDetail)) {
                Text(name, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold), color = MaterialTheme.colorScheme.onSurface)
                first.employeeRole?.let {
                    Text(it.replace('_', ' ').replaceFirstChar { c -> c.uppercase() }, style = MaterialTheme.typography.labelSmall, color = Saffron600)
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        sorted.forEach { p ->
            Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (p.eventType == "OUT") s("Out", "आउट") else s("In", "इन"),
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    color = if (p.eventType == "OUT") MaterialTheme.colorScheme.onSurfaceVariant else Color(0xFF059669),
                    modifier = Modifier.width(34.dp),
                )
                Text(formatTime(p.capturedAt), style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                Text(
                    when (p.verificationStatus) {
                        "VERIFIED" -> s("Verified", "सत्यापित")
                        "FLAGGED" -> s("Flagged", "चिह्नित")
                        "REJECTED" -> s("Rejected", "अस्वीकृत")
                        else -> s("Pending", "लंबित")
                    },
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = when (p.verificationStatus) {
                        "VERIFIED" -> Color(0xFF059669)
                        "REJECTED" -> MaterialTheme.colorScheme.error
                        else -> Saffron600
                    },
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        if (stillIn) {
            Button(
                onClick = { onMarkOut(ColleagueDto(id = first.employeeId ?: return@Button, fullName = name, email = first.employeeEmail, photoUrl = first.employeePhotoUrl)) },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Saffron600, contentColor = Color.White),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Filled.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(s("Mark Out", "मार्क आउट"), fontWeight = FontWeight.Bold)
            }
        } else if (first.employeeLastOutAt != null) {
            Text(
                s("Marked out at ${formatTime(first.employeeLastOutAt)}", "${formatTime(first.employeeLastOutAt)} पर मार्क आउट हुआ"),
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                color = Color(0xFF059669),
            )
        }
    }
}

/** Full details for one colleague: large photo, contact info and every punch made for them today, with GPS on a map. */
@Composable
private fun ColleagueDetailDialog(punches: List<RemoteAttendanceItemDto>, onDismiss: () -> Unit) {
    val first = punches.first()
    val context = LocalContext.current
    var mapFor by remember { mutableStateOf<RemoteAttendanceItemDto?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        androidx.compose.material3.Surface(shape = RoundedCornerShape(28.dp), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Avatar(first, 110.dp)
                Spacer(Modifier.height(12.dp))
                Text(first.employeeName ?: "", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))
                first.employeeRole?.let {
                    Text(it.replace('_', ' ').uppercase(), style = MaterialTheme.typography.labelMedium, color = Saffron600)
                }
                first.employeeEmail?.let {
                    Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
                }
                first.employeePhone?.takeIf { it.isNotBlank() }?.let { phone ->
                    OutlinedButton(
                        onClick = {
                            try {
                                context.startActivity(android.content.Intent(android.content.Intent.ACTION_DIAL, android.net.Uri.parse("tel:$phone")))
                            } catch (_: Exception) {
                            }
                        },
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        Icon(Icons.Filled.Call, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(phone)
                    }
                }

                Spacer(Modifier.height(16.dp))
                Text(
                    s("Marked by you today", "आज आपके द्वारा दर्ज"),
                    style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                    modifier = Modifier.fillMaxWidth(),
                )
                punches.sortedBy { it.capturedAt }.forEach { p ->
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
                            .padding(12.dp),
                    ) {
                        Text(
                            "${if (p.eventType == "OUT") s("Marked Out", "मार्क आउट") else s("Marked In", "मार्क इन")} · ${formatTime(p.capturedAt)}",
                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                        )
                        Text(
                            "${p.verificationStatus ?: ""}${p.rejectionReason?.let { " — $it" } ?: ""}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        val lat = p.gpsLat
                        val lng = p.gpsLng
                        if (lat != null && lng != null && (lat != 0.0 || lng != 0.0)) {
                            Row(
                                Modifier.padding(top = 6.dp).clip(RoundedCornerShape(8.dp)).clickable { mapFor = p }.padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(Icons.Filled.LocationOn, contentDescription = null, tint = Saffron600, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text(
                                    "GPS: ${String.format(java.util.Locale.US, "%.5f, %.5f", lat, lng)}" + (p.gpsAccuracyM?.let { " (±${it.toInt()}m)" } ?: ""),
                                    style = MaterialTheme.typography.labelSmall.copy(textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline),
                                    color = Saffron600,
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))
                Button(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text(s("Close", "बंद करें")) }
            }
        }
    }

    mapFor?.let {
        com.saaserp.attendance.ui.admin.LocationMapDialog(
            lat = it.gpsLat ?: 0.0,
            lng = it.gpsLng ?: 0.0,
            accuracyM = it.gpsAccuracyM,
            distanceFromCampusM = null,
            onDismiss = { mapFor = null },
        )
    }
}
