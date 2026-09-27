package com.saaserp.attendance.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import net.sqlcipher.database.SQLiteDatabase
import net.sqlcipher.database.SupportFactory

@Database(entities = [AttendanceEntity::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {

    abstract fun attendanceDao(): AttendanceDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext).also { instance = it }
            }

        private fun build(context: Context): AppDatabase {
            SQLiteDatabase.loadLibs(context)
            val passphrase = DatabaseKeyProvider.getOrCreatePassphrase(context)
            val factory = SupportFactory(SQLiteDatabase.getBytes(passphrase))

            return Room.databaseBuilder(context, AppDatabase::class.java, "dsps_attendance.db")
                .openHelperFactory(factory)
                // v1 -> v2 added eventType/leaveType/livenessVerified for IN/OUT
                // attendance. Destructive fallback is fine here: this table is
                // just a local cache/queue, never the source of truth (the
                // server is), and any not-yet-synced offline record lost by an
                // app update is the same acceptable edge case v1 already had.
                .fallbackToDestructiveMigration()
                .build()
        }
    }
}
