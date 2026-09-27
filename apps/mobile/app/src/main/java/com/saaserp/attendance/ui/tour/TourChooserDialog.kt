package com.saaserp.attendance.ui.tour

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.saaserp.attendance.R
import com.saaserp.attendance.ui.components.ChoiceCard
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.util.s

/** Shown before the spotlight tour: pick a one-minute overview or the in-depth guide. */
@Composable
fun TourChooserDialog(
    canViewRoster: Boolean,
    onQuick: () -> Unit,
    onFull: () -> Unit,
    onSkip: () -> Unit,
) {
    Dialog(onDismissRequest = onSkip) {
        Surface(shape = RoundedCornerShape(28.dp), color = MaterialTheme.colorScheme.surface) {
            Column(
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Image(painter = painterResource(R.drawable.dsps_logo), contentDescription = null, modifier = Modifier.size(56.dp))
                Spacer(Modifier.height(12.dp))
                Text(
                    s("Welcome to SaaS ERP Attendance", "SaaS ERP उपस्थिति में आपका स्वागत है"),
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    textAlign = TextAlign.Center,
                )
                Text(
                    s("Take a quick look around. How much would you like to see?", "ऐप का परिचय लें। आप कितना देखना चाहेंगे?"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp),
                )
                Spacer(Modifier.height(18.dp))
                Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    ChoiceCard(
                        icon = Icons.Filled.Bolt,
                        title = s("Quick tour", "क्विक टूर"),
                        description = s("About 1 minute: profile & language, check-in, history.", "लगभग 1 मिनट: प्रोफ़ाइल व भाषा, चेक-इन, इतिहास।"),
                        onClick = onQuick,
                    )
                    ChoiceCard(
                        icon = Icons.Filled.AutoStories,
                        title = s("Full guide", "पूरी गाइड"),
                        description = s(
                            "Every feature in depth: profile & security, mark in/out, marking for colleagues, history details${if (canViewRoster) ", roster & export" else ""}.",
                            "हर फ़ीचर विस्तार से: प्रोफ़ाइल व सुरक्षा, मार्क इन/आउट, सहकर्मी के लिए दर्ज करना, इतिहास का विवरण${if (canViewRoster) ", रोस्टर व एक्सपोर्ट" else ""}।",
                        ),
                        badge = s("RECOMMENDED", "अनुशंसित"),
                        highlighted = true,
                        onClick = onFull,
                    )
                }
                Spacer(Modifier.height(6.dp))
                TextButton(onClick = onSkip) {
                    Text(s("Skip for now", "अभी छोड़ें"), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(
                    s("You can replay this anytime from your profile menu.", "इसे कभी भी प्रोफ़ाइल मेन्यू से दोबारा देख सकते हैं।"),
                    style = MaterialTheme.typography.labelSmall,
                    color = Saffron600,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}
