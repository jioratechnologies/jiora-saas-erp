package com.saaserp.attendance.camera

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.os.Build
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

/** Thin wrapper around CameraX — binds a preview to the given [PreviewView] and exposes a suspend capture() call. */
class CameraCapture(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
) {
    private val processingExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
    private var imageCapture: ImageCapture? = null
    private var provider: ProcessCameraProvider? = null
    private var previewView: PreviewView? = null

    // Front camera is the default and the one that actually matters for
    // face verification — flipping to the back camera is a convenience the
    // employee has to deliberately reach for each time, never remembered
    // across screens, so an attendance capture never accidentally ends up
    // pointed the wrong way without the person noticing.
    private var cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
    val isFrontCamera: Boolean get() = cameraSelector == CameraSelector.DEFAULT_FRONT_CAMERA

    /**
     * Always constructed, but only ever receives frames if the 3-use-case
     * bind below succeeds — some LEGACY-tier Camera2 devices can't run
     * Preview+ImageCapture+ImageAnalysis concurrently and fall back to just
     * the first two, in which case [LivenessDetector.blinkDetected] simply
     * never flips true.
     */
    val livenessDetector = LivenessDetector()

    /** Releases camera hardware — call on screen dispose, else session (and OS camera indicator) stays alive after leaving this screen. */
    fun unbind() {
        provider?.unbindAll()
        processingExecutor.shutdown()
        imageCapture = null
        livenessDetector.close()
    }

    suspend fun bind(previewView: PreviewView) = suspendCoroutine<Unit> { cont ->
        this.previewView = previewView
        val providerFuture = ProcessCameraProvider.getInstance(context)
        providerFuture.addListener({
            try {
            val provider = providerFuture.get()
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }
            val capture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                // A face-verification selfie doesn't need full sensor
                // resolution (often several MB) — this alone was making
                // the upload step take 10+ seconds over WiFi/LTE. A modest
                // capped resolution + quality cuts file size drastically
                // with no meaningful loss for this use case.
                .setTargetResolution(Size(960, 720))
                .setJpegQuality(60)
                .build()
            // Liveness (blink) detection only makes sense pointed at a face —
            // skip it entirely on the back camera rather than wasting a 3rd
            // concurrent stream analyzing a wall or a whiteboard.
            // Also skipped on low-RAM phones (<= 3 GB, e.g. Redmi 8A): a 3rd
            // concurrent stream + ML Kit model there can OOM/native-crash the
            // whole process, which a try/catch cannot intercept.
            val analysis = if (cameraSelector == CameraSelector.DEFAULT_FRONT_CAMERA && !isLowMemoryDevice()) {
                ImageAnalysis.Builder()
                    .setTargetResolution(Size(480, 360)) // liveness only needs eye probabilities, not a sharp frame
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { it.setAnalyzer(androidx.core.content.ContextCompat.getMainExecutor(context), LivenessDetector.analyzerFor(livenessDetector)) }
            } else {
                null
            }

            try {
                provider.unbindAll()
                try {
                    if (analysis != null) {
                        // Preferred: Preview + ImageCapture + live liveness analysis.
                        provider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, capture, analysis)
                    } else {
                        provider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, capture)
                    }
                } catch (e: Exception) {
                    // Some devices can't run 3 concurrent streams (Camera2
                    // LEGACY hardware level) — fall back to the 2-use-case
                    // setup that's been live in production. Liveness simply
                    // stays unavailable (livenessVerified = null server-side)
                    // rather than ever blocking a real check-in over this.
                    provider.unbindAll()
                    provider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, capture)
                }
                this.provider = provider
                imageCapture = capture
                cont.resume(Unit)
            } catch (e: Exception) {
                cont.resumeWithException(e)
            }
            } catch (e: Throwable) {
                cont.resumeWithException(e)
            }
        }, androidx.core.content.ContextCompat.getMainExecutor(context))
    }

    private fun isLowMemoryDevice(): Boolean = try {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        val info = android.app.ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        am.isLowRamDevice || info.totalMem <= 3L * 1024 * 1024 * 1024
    } catch (_: Exception) {
        false
    }

    /** Toggles front/back and re-binds against the same preview surface — a no-op if [bind] hasn't been called yet. */
    suspend fun flipCamera() {
        val view = previewView ?: return
        cameraSelector = if (cameraSelector == CameraSelector.DEFAULT_FRONT_CAMERA) {
            CameraSelector.DEFAULT_BACK_CAMERA
        } else {
            CameraSelector.DEFAULT_FRONT_CAMERA
        }
        livenessDetector.reset()
        bind(view)
    }

    /** Captures a JPEG to app-private storage and returns its absolute path. */
    suspend fun capture(): String = suspendCoroutine { cont ->
        val capture = imageCapture ?: run {
            cont.resumeWithException(IllegalStateException("Camera not bound yet"))
            return@suspendCoroutine
        }

        val dir = File(context.filesDir, "attendance_photos").apply { mkdirs() }
        val fileName = "checkin_" + SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(java.util.Date()) + ".jpg"
        val outputFile = File(dir, fileName)
        val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()

        capture.takePicture(
            outputOptions,
            // Background thread: decode/rotate/encode (and face-orientation check) must not block the UI.
            processingExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    val finalFile = mirrorAndCompressToWebp(outputFile)
                    cont.resume(finalFile.absolutePath)
                }
                override fun onError(exception: ImageCaptureException) {
                    cont.resumeWithException(exception)
                }
            }
        )
    }

    /**
     * The front-camera live preview is mirrored, but the saved sensor frame is
     * not — so the "Verifying…" still used to appear horizontally flipped vs
     * what the user had framed. Mirroring already means decoding + re-encoding
     * the bitmap, so this also switches the output to WebP — a check-in
     * selfie is looked at once for verification and never needs editing, so
     * there's no reason to keep it in an editable/lossless-friendly format;
     * WebP at the same quality setting runs noticeably smaller than the JPEG
     * CameraX hands back, which matters on the slow mobile links this photo
     * often uploads over. The original JPEG is deleted once the WebP is
     * written — no point keeping both on a phone's limited storage.
     * Failures are non-fatal and keep the original JPEG capture rather than
     * breaking check-in.
     */
    private fun mirrorAndCompressToWebp(file: File): File {
        try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, bounds)
            var sample = 1
            while (bounds.outWidth / sample > MAX_DECODE_PX) sample *= 2
            val src = BitmapFactory.decodeFile(
                file.absolutePath,
                BitmapFactory.Options().apply { inSampleSize = sample },
            ) ?: return file
            // CameraX writes the sensor frame + an EXIF orientation tag
            // instead of rotating pixels. Decoding to a Bitmap and
            // re-encoding as WebP drops that tag, so photos ended up
            // sideways/upside-down — bake the rotation into the pixels.
            val exifRotation = when (
                android.media.ExifInterface(file.absolutePath)
                    .getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, android.media.ExifInterface.ORIENTATION_NORMAL)
            ) {
                android.media.ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                android.media.ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                android.media.ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
            val matrix = Matrix().apply {
                if (exifRotation != 0f) postRotate(exifRotation)
                if (isFrontCamera) postScale(-1f, 1f) // preview is mirrored on the front camera only
            }
            // Attendance selfies only need to identify a face — downscale so the
            // long side is at most MAX_PHOTO_PX. Folded into the same matrix as
            // the rotate/mirror, so it costs no extra pass.
            val longSide = maxOf(src.width, src.height)
            if (longSide > MAX_PHOTO_PX) {
                val scale = MAX_PHOTO_PX.toFloat() / longSide
                matrix.postScale(scale, scale)
            }
            val rotated = Bitmap.createBitmap(src, 0, 0, src.width, src.height, matrix, true)
            if (rotated !== src) src.recycle()
            // Pixels-based safety net for devices whose orientation metadata lies.
            // Skipped on low-RAM phones, where loading the ML Kit model is a crash risk.
            val mirrored = if (isLowMemoryDevice()) rotated else FaceOrientation.uprighted(rotated)
            if (mirrored !== rotated) rotated.recycle()
            val webpFormat = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Bitmap.CompressFormat.WEBP_LOSSY
            } else {
                @Suppress("DEPRECATION")
                Bitmap.CompressFormat.WEBP
            }
            val webpFile = File(file.parentFile, file.nameWithoutExtension + ".webp")
            java.io.FileOutputStream(webpFile).use { out ->
                mirrored.compress(webpFormat, WEBP_QUALITY, out)
            }
            mirrored.recycle()
            file.delete()
            return webpFile
        } catch (_: Throwable) {
            return file
        }
    }

    private companion object {
        /** Long-side cap for the stored/uploaded selfie — smaller = less storage and faster upload. */
        const val MAX_PHOTO_PX = 720
        /** Only bounds the initial JPEG decode (memory); the real resize happens against MAX_PHOTO_PX. */
        const val MAX_DECODE_PX = 1600
        const val WEBP_QUALITY = 50
    }
}
