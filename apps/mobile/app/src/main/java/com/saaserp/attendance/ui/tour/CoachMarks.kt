package com.saaserp.attendance.ui.tour

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import kotlinx.coroutines.delay
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.saaserp.attendance.ui.theme.AmberGold
import com.saaserp.attendance.ui.theme.Saffron500
import com.saaserp.attendance.ui.theme.Saffron600
import com.saaserp.attendance.util.s

/** One stop of the guided tour: which real on-screen component to ring, which tab it lives on, and what to say about it. */
data class CoachStep(
    val targetId: String,
    /** Route to navigate to before showing this step, or null to stay put. */
    val route: String?,
    val icon: ImageVector,
    val titleEn: String,
    val titleHi: String,
    val descEn: String,
    val descHi: String,
    /** Optional button on the card that performs a real action mid-tour (e.g. open the language picker). */
    val action: CoachAction? = null,
)

enum class CoachAction(val labelEn: String, val labelHi: String) {
    CHANGE_LANGUAGE("Change language now", "अभी भाषा बदलें"),
}

/** Screen-space bounds of every component currently tagged with [coachTarget]. */
class CoachMarkRegistry {
    val bounds = mutableStateMapOf<String, Rect>()

    /** The target of the step currently shown — the matching component scrolls itself into view. */
    var current by mutableStateOf<String?>(null)
}

val LocalCoachMarks = compositionLocalOf<CoachMarkRegistry?> { null }

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
/** Tags a component so the tour overlay can ring it. No-op outside a [LocalCoachMarks] provider. */
fun Modifier.coachTarget(id: String): Modifier = composed {
    val registry = LocalCoachMarks.current
    if (registry == null) {
        this
    } else {
        DisposableEffect(id) { onDispose { registry.bounds.remove(id) } }
        val requester = remember { BringIntoViewRequester() }
        // Targets inside a scrolling screen (Profile) may start off-screen — scroll them into view when their step is shown.
        LaunchedEffect(registry.current) {
            if (registry.current == id) {
                delay(450) // let the screen finish navigating/laying out first
                try {
                    requester.bringIntoView()
                } catch (_: Exception) {
                }
            }
        }
        this.bringIntoViewRequester(requester).onGloballyPositioned { registry.bounds[id] = it.boundsInRoot() }
    }
}

/**
 * Full-screen spotlight tour drawn over the live app: dims everything,
 * cuts a pulsing ring around the real component for the current step, and
 * shows a description card. Steps can switch tab via [onStepShown].
 */
@Composable
fun CoachMarkOverlay(
    steps: List<CoachStep>,
    registry: CoachMarkRegistry,
    onStepShown: (CoachStep) -> Unit,
    onFinish: () -> Unit,
    onAction: (CoachAction) -> Unit = {},
) {
    var index by remember { mutableIntStateOf(0) }
    val step = steps[index]
    val isLast = index == steps.lastIndex

    LaunchedEffect(index) {
        registry.current = step.targetId
        onStepShown(step)
    }
    DisposableEffect(Unit) { onDispose { registry.current = null } }

    val target = registry.bounds[step.targetId]
    val pad = with(LocalDensity.current) { 8.dp.toPx() }
    val ring = target?.inflate(pad)

    // While the next step's target isn't on screen yet (screen still navigating/scrolling), keep the
    // ring where it was — fading out — instead of animating toward (0,0), the top-left corner.
    // The moment the new target appears it snaps into place (invisible, since the ring was faded out)
    // and fades in; between two visible targets the ring glides.
    var lastRing by remember { mutableStateOf<Rect?>(null) }
    var hadRing by remember { mutableStateOf(false) }
    val shown = ring ?: lastRing
    val spec = if (hadRing) tween<Float>(450, easing = FastOutSlowInEasing) else snap<Float>()
    val left by animateFloatAsState(shown?.left ?: 0f, spec, label = "ringL")
    val top by animateFloatAsState(shown?.top ?: 0f, spec, label = "ringT")
    val right by animateFloatAsState(shown?.right ?: 0f, spec, label = "ringR")
    val bottom by animateFloatAsState(shown?.bottom ?: 0f, spec, label = "ringB")
    val ringAlpha by animateFloatAsState(if (ring != null) 1f else 0f, tween(250), label = "ringA")
    SideEffect {
        if (ring != null) lastRing = ring
        hadRing = ring != null
    }

    val pulse by rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1400, easing = FastOutSlowInEasing), RepeatMode.Restart),
        label = "pulseValue",
    )

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            // Swallow taps so the app underneath can't be used mid-tour.
            .pointerInput(Unit) { detectTapGestures { } },
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen },
        ) {
            drawRect(Color.Black.copy(alpha = 0.78f))
            if (ringAlpha > 0f) {
                val w = right - left
                val h = bottom - top
                val corner = CornerRadius(minOf(w, h) / 2f)
                drawRoundRect(
                    color = Color.Black,
                    topLeft = Offset(left, top),
                    size = Size(w, h),
                    cornerRadius = corner,
                    blendMode = BlendMode.Clear,
                )
                drawRoundRect(
                    color = Saffron500.copy(alpha = ringAlpha),
                    topLeft = Offset(left, top),
                    size = Size(w, h),
                    cornerRadius = corner,
                    style = Stroke(width = 3.dp.toPx()),
                )
                // Expanding echo ring.
                val grow = pulse * 14.dp.toPx()
                drawRoundRect(
                    color = AmberGold.copy(alpha = (1f - pulse) * 0.7f * ringAlpha),
                    topLeft = Offset(left - grow, top - grow),
                    size = Size(w + grow * 2, h + grow * 2),
                    cornerRadius = CornerRadius(minOf(w, h) / 2f + grow),
                    style = Stroke(width = 2.dp.toPx()),
                )
            }
        }

        val screenH = constraints.maxHeight.toFloat()
        val density = LocalDensity.current
        val gap = 20.dp
        // Card goes on whichever side of the ring has more room.
        val anchor = shown // hold the card at the previous spot while the next target loads, rather than flashing to center
        val cardBelow = anchor == null || (anchor.center.y < screenH / 2f)
        val cardModifier = if (anchor == null) {
            Modifier.align(Alignment.Center)
        } else if (cardBelow) {
            Modifier.align(Alignment.TopCenter).padding(top = with(density) { anchor.bottom.toDp() } + gap)
        } else {
            Modifier.align(Alignment.BottomCenter).padding(bottom = with(density) { (screenH - anchor.top).toDp() } + gap)
        }

        Column(
            modifier = cardModifier
                .padding(horizontal = 20.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(MaterialTheme.colorScheme.surface)
                .border(1.dp, Saffron500.copy(alpha = 0.45f), RoundedCornerShape(24.dp))
                .padding(18.dp),
        ) {
            AnimatedContent(
                targetState = index,
                transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(120)) },
                label = "coachText",
            ) { i ->
                val current = steps[i]
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(38.dp).clip(CircleShape).background(Saffron500.copy(alpha = 0.16f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(current.icon, contentDescription = null, tint = Saffron600, modifier = Modifier.size(20.dp))
                        }
                        Spacer(Modifier.width(12.dp))
                        Text(
                            s(current.titleEn, current.titleHi),
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        s(current.descEn, current.descHi),
                        style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            step.action?.let { action ->
                Spacer(Modifier.height(10.dp))
                androidx.compose.material3.OutlinedButton(
                    onClick = { onAction(action) },
                    shape = RoundedCornerShape(12.dp),
                ) { Text(s(action.labelEn, action.labelHi), color = Saffron600, fontWeight = FontWeight.SemiBold) }
            }

            Spacer(Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (steps.size > 8) {
                    // Long tours: a counter instead of a row of dots that wouldn't fit.
                    Text(
                        "${index + 1} / ${steps.size}",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                        color = Saffron600,
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    // Progress dots — current step stretches into a pill.
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.weight(1f)) {
                    steps.indices.forEach { i ->
                        val dotWidth: Dp by androidx.compose.animation.core.animateDpAsState(if (i == index) 18.dp else 6.dp, label = "dot")
                        Box(
                            Modifier
                                .height(6.dp)
                                .width(dotWidth)
                                .clip(CircleShape)
                                .background(if (i == index) Saffron600 else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.18f)),
                        )
                    }
                }
                }
                if (!isLast) {
                    TextButton(onClick = onFinish) { Text(s("Skip", "छोड़ें"), color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
                if (index > 0) {
                    TextButton(onClick = { index-- }) { Text(s("Back", "पीछे")) }
                }
                Button(
                    onClick = { if (isLast) onFinish() else index++ },
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Saffron600, contentColor = Color.White),
                ) {
                    Text(if (isLast) s("Done", "पूर्ण") else s("Next", "आगे"), fontWeight = FontWeight.Bold)
                    Spacer(Modifier.width(6.dp))
                    Icon(
                        if (isLast) Icons.Filled.Check else Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}
