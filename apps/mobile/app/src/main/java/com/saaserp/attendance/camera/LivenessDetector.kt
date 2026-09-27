package com.saaserp.attendance.camera

import android.annotation.SuppressLint
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Free, on-device blink-challenge liveness check — the only anti-spoofing
 * "not a photo of a photo" signal that doesn't need a paid SDK (FaceTec,
 * AWS/Azure Face Liveness, ...). ML Kit's Face Detection gives an
 * eye-open-probability per frame; a real live person's eyes go from open
 * to closed to open again within about a second when they blink, which a
 * printed photo or a photo of another phone's screen cannot do on demand.
 *
 * Deliberately permissive: this is a signal fed into the server's existing
 * flag-for-review pipeline (see decideVerificationStatus in
 * src/lib/attendance/validation.ts), never a hard gate here — any
 * exception (model not downloaded yet, unsupported device, detector
 * crash) is swallowed and simply leaves [blinkDetected] at false, so a
 * broken detector degrades to "no liveness signal" instead of blocking a
 * real check-in.
 */
class LivenessDetector {
    private val _blinkDetected = MutableStateFlow(false)
    val blinkDetected: StateFlow<Boolean> = _blinkDetected

    /** True once the detector has successfully processed at least one frame with a face — lets the UI distinguish "still looking for a face" from "no face detector available at all." */
    private val _detectorAvailable = MutableStateFlow(true)
    val detectorAvailable: StateFlow<Boolean> = _detectorAvailable

    private val detector = try {
        FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL) // needed for eye-open probability
                .build()
        )
    } catch (e: Exception) {
        _detectorAvailable.value = false
        null
    }

    // Simple open -> closed -> open state machine across frames, bounded to
    // a short window so a single dropped/blurry frame can't fake a "blink."
    private var sawEyesOpen = false
    private var sawEyesClosed = false
    private var sawEyesClosedAtMs = 0L
    private val blinkWindowMs = 2500L

    fun reset() {
        _blinkDetected.value = false
        sawEyesOpen = false
        sawEyesClosed = false
        sawEyesClosedAtMs = 0L
    }

    /** Feed CameraX ImageAnalysis frames here — must call [ImageProxy.close] on every path, CameraX stalls the pipeline otherwise. */
    @SuppressLint("UnsafeOptInUsageError")
    fun analyze(imageProxy: ImageProxy) {
        val faceDetector = detector
        if (faceDetector == null || _blinkDetected.value) {
            imageProxy.close()
            return
        }

        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        faceDetector.process(image)
            .addOnSuccessListener { faces ->
                val face = faces.firstOrNull()
                val leftOpen = face?.leftEyeOpenProbability
                val rightOpen = face?.rightEyeOpenProbability
                if (leftOpen != null && rightOpen != null) {
                    val now = System.currentTimeMillis()
                    val eyesOpen = leftOpen > 0.6f && rightOpen > 0.6f
                    val eyesClosed = leftOpen < 0.25f && rightOpen < 0.25f

                    if (!sawEyesOpen && eyesOpen) {
                        sawEyesOpen = true
                    } else if (sawEyesOpen && !sawEyesClosed && eyesClosed) {
                        sawEyesClosed = true
                        sawEyesClosedAtMs = now
                    } else if (sawEyesClosed && eyesOpen) {
                        if (now - sawEyesClosedAtMs <= blinkWindowMs) {
                            _blinkDetected.value = true
                        } else {
                            // Took too long — restart the window from this open state.
                            sawEyesClosed = false
                            sawEyesOpen = true
                        }
                    } else if (sawEyesClosed && now - sawEyesClosedAtMs > blinkWindowMs) {
                        // Stayed closed too long (or lost the face) — restart.
                        sawEyesOpen = eyesOpen
                        sawEyesClosed = false
                    }
                }
            }
            .addOnFailureListener {
                // Non-fatal — next frame tries again. Never surfaces to the user.
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }

    fun close() {
        try {
            detector?.close()
        } catch (_: Exception) {
        }
    }

    companion object {
        /** Analyzer bridge — CameraX owns the executor/threading, this just forwards frames. */
        fun analyzerFor(detector: LivenessDetector) = ImageAnalysis.Analyzer { proxy -> detector.analyze(proxy) }
    }
}
