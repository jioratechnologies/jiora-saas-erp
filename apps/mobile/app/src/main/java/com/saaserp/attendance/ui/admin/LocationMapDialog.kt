package com.saaserp.attendance.ui.admin

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.WebView
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.util.s
import java.util.Locale

/**
 * Where a punch was made: an OpenStreetMap map (Leaflet, no API key or
 * Play-services dependency) with a pin and a circle for the reported GPS
 * accuracy. Needs internet for the map tiles; the coordinates and the
 * "Open in Maps" button work regardless.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun LocationMapDialog(
    lat: Double,
    lng: Double,
    accuracyM: Float?,
    distanceFromCampusM: Double?,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val coords = String.format(Locale.US, "%.5f, %.5f", lat, lng)
    val html = remember(lat, lng, accuracyM) { mapHtml(lat, lng, accuracyM ?: 0f) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    s("Punch location", "उपस्थिति का स्थान"),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "📍 $coords" + (accuracyM?.let { " (±${it.toInt()}m)" } ?: ""),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
                distanceFromCampusM?.let {
                    Text(
                        "${it.toInt()}m ${s("from campus center", "परिसर केंद्र से दूरी")}",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }

                Spacer(Modifier.height(12.dp))
                AndroidView(
                    factory = { ctx ->
                        WebView(ctx).apply {
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            // The map is display-only: no file/content access needed.
                            settings.allowFileAccess = false
                            settings.allowContentAccess = false
                            setBackgroundColor(0xFFF1ECE6.toInt())
                            webViewClient = android.webkit.WebViewClient()
                            loadDataWithBaseURL("https://dsps.local/", html, "text/html", "UTF-8", null)
                        }
                    },
                    onRelease = { it.destroy() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp)
                        .clip(RoundedCornerShape(16.dp)),
                )

                Text(
                    s("Map blank? Check your internet, or use Open in Maps.", "मैप खाली है? इंटरनेट जाँचें या मैप्स में खोलें।"),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp),
                )
                Spacer(Modifier.height(10.dp))
                Row {
                    OutlinedButton(
                        onClick = {
                            try {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng")))
                            } catch (_: Exception) {
                            }
                        },
                        modifier = Modifier.weight(1f),
                    ) { Text(s("Open in Maps", "मैप्स में खोलें")) }
                    Spacer(Modifier.padding(4.dp))
                    Button(onClick = onDismiss, modifier = Modifier.weight(1f)) { Text(s("Close", "बंद करें")) }
                }
            }
        }
    }
}

private fun mapHtml(lat: Double, lng: Double, accuracyM: Float): String {
    val pos = String.format(Locale.US, "%.6f,%.6f", lat, lng)
    return """
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;background:#f1ece6}.n{font:14px sans-serif;padding:24px;text-align:center;color:#666}</style>
</head><body><div id="m"></div><script>
if (typeof L === 'undefined') {
  document.getElementById('m').innerHTML = '<div class="n">Map needs an internet connection.</div>';
} else {
  var p = [$pos];
  var map = L.map('m', {zoomControl: true}).setView(p, 17);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO'}).addTo(map);
  L.marker(p).addTo(map);
  var acc = $accuracyM;
  if (acc > 0) {
    var c = L.circle(p, {radius: acc, color: '#EA580C', fillColor: '#F97316', fillOpacity: 0.15, weight: 2}).addTo(map);
    map.fitBounds(c.getBounds(), {maxZoom: 18, padding: [24, 24]});
  }
}
</script></body></html>
""".trimIndent()
}
