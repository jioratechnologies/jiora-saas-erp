package com.saaserp.attendance.ui.checkin

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Login
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.saaserp.attendance.ui.components.ChoiceCard
import com.saaserp.attendance.ui.theme.Saffron500
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.util.s

/** First step of "Mark for a Colleague": are you marking them IN or OUT? */
@Composable
fun ColleagueModeDialog(onMarkIn: () -> Unit, onMarkOut: () -> Unit, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(28.dp), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.padding(20.dp)) {
                Row(verticalAlignment = Alignment.Top) {
                    Box(
                        Modifier.size(48.dp).clip(CircleShape).background(Saffron500.copy(alpha = 0.16f)),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Filled.People, contentDescription = null, tint = Saffron600) }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            s("Mark for a Colleague", "सहकर्मी के लिए दर्ज करें"),
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        )
                        Text(
                            s("What would you like to record?", "आप क्या दर्ज करना चाहते हैं?"),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Filled.Close, contentDescription = s("Close", "बंद करें"), modifier = Modifier.size(18.dp))
                    }
                }
                Spacer(Modifier.height(18.dp))
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    ChoiceCard(
                        icon = Icons.Filled.Login,
                        title = s("Mark In", "मार्क इन"),
                        description = s("For staff who haven't checked in yet", "उन स्टाफ के लिए जो अभी चेक-इन नहीं हैं"),
                        accent = Color(0xFF059669),
                        onClick = onMarkIn,
                    )
                    ChoiceCard(
                        icon = Icons.Filled.Logout,
                        title = s("Mark Out", "मार्क आउट"),
                        description = s("For staff who are checked in and leaving", "उन स्टाफ के लिए जो चेक-इन हैं और जा रहे हैं"),
                        accent = Saffron600,
                        onClick = onMarkOut,
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    s("You'll pick the person next, then confirm location and take their photo.", "आगे व्यक्ति चुनें, फिर लोकेशन की पुष्टि करें और उनकी फ़ोटो लें।"),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 10.dp),
                )
            }
        }
    }
}
