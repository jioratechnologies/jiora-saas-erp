package com.saaserp.attendance.camera

import android.graphics.Bitmap
import android.graphics.Matrix
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.util.concurrent.TimeUnit

/**
 * Last line of defence against sideways / upside-down selfies. Camera
 * orientation metadata is unreliable across OEMs (and lost entirely once
 * the photo is re-encoded), so this looks at the actual pixels: ML Kit only
 * finds upright faces, so whichever of 0/90/180/270 degrees produces a face
 * is the rotation that makes the person stand straight.
 *
 * Blocking — call from a background thread only. Any failure (model
 * missing, timeout, no face found) returns the bitmap untouched.
 */
object FaceOrientation {
    private const val ANALYSIS_WIDTH = 480

    fun uprighted(bitmap: Bitmap): Bitmap {
        val detector = try {
            FaceDetection.getClient(
                FaceDetectorOptions.Builder()
                    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                    .build()
            )
        } catch (_: Throwable) {
            return bitmap
        }

        var small: Bitmap? = null
        try {
            val scale = ANALYSIS_WIDTH.toFloat() / maxOf(bitmap.width, bitmap.height).coerceAtLeast(1)
            small = if (scale < 1f) {
                Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt().coerceAtLeast(1), (bitmap.height * scale).toInt().coerceAtLeast(1), true)
            } else {
                bitmap
            }

            var bestRotation = -1
            var bestArea = 0
            // Already upright is by far the common case — stop at the first hit there.
            for (rotation in intArrayOf(0, 90, 270, 180)) {
                val faces = Tasks.await(detector.process(InputImage.fromBitmap(small, rotation)), 4, TimeUnit.SECONDS)
                val area = faces.maxOfOrNull { it.boundingBox.width() * it.boundingBox.height() } ?: 0
                if (rotation == 0 && area > 0) return bitmap
                if (area > bestArea) {
                    bestArea = area
                    bestRotation = rotation
                }
            }
            if (bestRotation <= 0) return bitmap
            return Bitmap.createBitmap(
                bitmap, 0, 0, bitmap.width, bitmap.height,
                Matrix().apply { postRotate(bestRotation.toFloat()) }, true,
            )
        } catch (_: Throwable) {
            return bitmap
        } finally {
            if (small != null && small !== bitmap) small.recycle()
            try {
                detector.close()
            } catch (_: Throwable) {
            }
        }
    }
}
