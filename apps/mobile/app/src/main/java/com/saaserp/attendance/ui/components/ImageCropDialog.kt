package com.saaserp.attendance.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTransformGestures
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Crop
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.saaserp.attendance.ui.theme.AmberGold
import com.saaserp.attendance.ui.theme.Saffron500
import com.saaserp.attendance.ui.theme.Saffron600
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min

@Composable
fun ImageCropDialog(
    imageUri: Uri,
    onDismiss: () -> Unit,
    onCropSuccess: (croppedFilePath: String) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var originalBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isProcessingCrop by remember { mutableStateOf(false) }

    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }
    var rotation by remember { mutableFloatStateOf(0f) }

    LaunchedEffect(imageUri) {
        withContext(Dispatchers.IO) {
            val bitmap = decodeSampledBitmapFromUri(context, imageUri, 1200, 1200)
            withContext(Dispatchers.Main) {
                originalBitmap = bitmap
                isLoading = false
            }
        }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.92f))
                .padding(20.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xFF1E1510))
                    .border(1.5.dp, Saffron500.copy(alpha = 0.4f), RoundedCornerShape(24.dp))
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Dialog Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Filled.Crop,
                            contentDescription = null,
                            tint = Saffron500,
                            modifier = Modifier.size(22.dp),
                        )
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(
                                "Adjust & Crop Photo",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                            Text(
                                "Pinch to zoom, drag to center your face",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.LightGray,
                            )
                        }
                    }

                    IconButton(
                        onClick = { rotation = (rotation + 90f) % 360f },
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.1f)),
                    ) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Rotate", tint = Saffron500)
                    }
                }

                Spacer(Modifier.height(18.dp))

                // Cropper Viewport Container (300x300 dp)
                val cropBoxSizeDp = 280.dp
                Box(
                    modifier = Modifier
                        .size(cropBoxSizeDp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.Black)
                        .clipToBounds()
                        .pointerInput(Unit) {
                            detectTransformGestures { _, pan, zoom, _ ->
                                scale = (scale * zoom).coerceIn(0.6f, 4.0f)
                                offsetX += pan.x
                                offsetY += pan.y
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    if (isLoading || originalBitmap == null) {
                        CircularProgressIndicator(color = Saffron500)
                    } else {
                        // The transformed image
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .graphicsLayer {
                                    scaleX = scale
                                    scaleY = scale
                                    translationX = offsetX
                                    translationY = offsetY
                                    rotationZ = rotation
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            androidx.compose.foundation.Image(
                                bitmap = originalBitmap!!.asImageBitmap(),
                                contentDescription = "Cropping Preview",
                                modifier = Modifier.fillMaxSize(),
                            )
                        }

                        // Circular Framing Overlay
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val canvasWidth = size.width
                            val canvasHeight = size.height
                            val circleRadius = min(canvasWidth, canvasHeight) * 0.44f
                            val center = Offset(canvasWidth / 2f, canvasHeight / 2f)

                            // Scrim path with cutout
                            val scrimPath = Path().apply {
                                fillType = PathFillType.EvenOdd
                                addRect(Rect(0f, 0f, canvasWidth, canvasHeight))
                                addOval(Rect(center, circleRadius))
                            }
                            drawPath(scrimPath, Color.Black.copy(alpha = 0.55f))

                            // Glowing Amber border ring
                            drawCircle(
                                color = Saffron500,
                                radius = circleRadius,
                                center = center,
                                style = Stroke(width = 3.dp.toPx()),
                            )
                        }
                    }
                }

                Spacer(Modifier.height(20.dp))

                // Action Buttons (Cancel / Crop & Save)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.LightGray),
                        modifier = Modifier.weight(1f),
                    ) {
                        Icon(Icons.Filled.Close, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Cancel", fontWeight = FontWeight.SemiBold)
                    }

                    Spacer(Modifier.width(12.dp))

                    Button(
                        onClick = {
                            val bmp = originalBitmap ?: return@Button
                            isProcessingCrop = true
                            scope.launch(Dispatchers.IO) {
                                try {
                                    val croppedFile = cropAndSaveBitmap(
                                        context = context,
                                        bitmap = bmp,
                                        rotation = rotation,
                                        scale = scale,
                                        offsetX = offsetX,
                                        offsetY = offsetY,
                                    )
                                    withContext(Dispatchers.Main) {
                                        isProcessingCrop = false
                                        if (croppedFile != null) {
                                            onCropSuccess(croppedFile.absolutePath)
                                        }
                                    }
                                } catch (_: Exception) {
                                    withContext(Dispatchers.Main) {
                                        isProcessingCrop = false
                                    }
                                }
                            }
                        },
                        enabled = !isLoading && !isProcessingCrop && originalBitmap != null,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Saffron600,
                            contentColor = Color.White,
                        ),
                        modifier = Modifier.weight(1.3f),
                    ) {
                        if (isProcessingCrop) {
                            CircularProgressIndicator(
                                color = Color.White,
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Crop & Use", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

private fun decodeSampledBitmapFromUri(context: Context, uri: Uri, reqWidth: Int, reqHeight: Int): Bitmap? {
    return try {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, options)
        }

        var inSampleSize = 1
        val (height: Int, width: Int) = options.outHeight to options.outWidth
        if (height > reqHeight || width > reqWidth) {
            val halfHeight: Int = height / 2
            val halfWidth: Int = width / 2
            while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                inSampleSize *= 2
            }
        }

        val decodeOptions = BitmapFactory.Options().apply {
            inSampleSize = max(1, inSampleSize)
        }
        context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, decodeOptions)
        }
    } catch (e: Exception) {
        null
    }
}

private fun cropAndSaveBitmap(
    context: Context,
    bitmap: Bitmap,
    rotation: Float,
    scale: Float,
    offsetX: Float,
    offsetY: Float,
): File? {
    return try {
        // Rotate bitmap if needed
        val matrix = Matrix()
        if (rotation != 0f) {
            matrix.postRotate(rotation)
        }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)

        // Center crop to a square with size
        val size = min(rotated.width, rotated.height)
        val x = ((rotated.width - size) / 2f).toInt().coerceAtLeast(0)
        val y = ((rotated.height - size) / 2f).toInt().coerceAtLeast(0)

        val cropped = Bitmap.createBitmap(rotated, x, y, size, size)

        // Scale to standard high-res square (512x512)
        val targetSize = min(size, 640)
        val scaled = Bitmap.createScaledBitmap(cropped, targetSize, targetSize, true)

        val file = File(context.cacheDir, "cropped_portrait_${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { out ->
            scaled.compress(Bitmap.CompressFormat.JPEG, 92, out)
        }
        file
    } catch (e: Exception) {
        null
    }
}
