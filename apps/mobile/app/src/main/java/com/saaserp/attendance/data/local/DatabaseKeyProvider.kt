package com.saaserp.attendance.data.local

import android.content.Context
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.SecureRandom

/**
 * Generates (once) and retrieves the passphrase used to encrypt the local
 * Room/SQLCipher database. The passphrase itself is a random 256-bit value
 * generated on-device; IT IS NEVER STORED IN PLAINTEXT — it's encrypted at
 * rest using an AES key that lives only in the Android Keystore (hardware-
 * backed on supported devices) and can't be extracted from the device.
 *
 * This protects the offline attendance queue (photos' paths, GPS, employee
 * identity, self-reported security signals) if the device is lost, rooted,
 * or its storage is imaged — see ATTENDANCE_PLAN.md, "SECURITY REQUIREMENT."
 */
object DatabaseKeyProvider {

    private const val PREFS_NAME = "dsps_attendance_secure_prefs"
    private const val PREF_KEY_DB_PASSPHRASE = "db_passphrase_b64"

    fun getOrCreatePassphrase(context: Context): CharArray {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        val prefs = EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )

        val existing = prefs.getString(PREF_KEY_DB_PASSPHRASE, null)
        if (existing != null) {
            return existing.toCharArray()
        }

        val randomBytes = ByteArray(32)
        SecureRandom().nextBytes(randomBytes)
        val passphrase = Base64.encodeToString(randomBytes, Base64.NO_WRAP)

        prefs.edit().putString(PREF_KEY_DB_PASSPHRASE, passphrase).apply()
        return passphrase.toCharArray()
    }
}
