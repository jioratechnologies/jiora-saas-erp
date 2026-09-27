package com.saaserp.attendance.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface AttendanceDao {

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(record: AttendanceEntity)

    @Update
    suspend fun update(record: AttendanceEntity)

    @Delete
    suspend fun delete(record: AttendanceEntity)

    @Query("DELETE FROM attendance_records WHERE employeeId = :employeeId AND attendanceDate = :date")
    suspend fun deleteForDate(employeeId: String, date: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(records: List<AttendanceEntity>)

    /**
     * Removes locally-cached SYNCED rows that a fresh server history fetch,
     * scoped to the same (employeeId, fromDate, toDate, status) filter, no
     * longer returned — e.g. a record deleted server-side after it synced.
     * Never touches PENDING_SYNC rows: those are offline captures the
     * server hasn't seen yet, so their absence from a server response
     * means nothing.
     */
    @Query(
        "DELETE FROM attendance_records WHERE employeeId = :employeeId AND syncStatus = 'SYNCED' " +
            "AND (:fromDate IS NULL OR attendanceDate >= :fromDate) AND (:toDate IS NULL OR attendanceDate <= :toDate) " +
            "AND (:status IS NULL OR verificationStatus = :status) AND offlineAttendanceId NOT IN (:keepIds)"
    )
    suspend fun deleteSyncedOrphans(
        employeeId: String,
        fromDate: String?,
        toDate: String?,
        status: String?,
        keepIds: List<String>,
    )

    @Query("SELECT * FROM attendance_records WHERE employeeId = :employeeId AND (:fromDate IS NULL OR attendanceDate >= :fromDate) AND (:toDate IS NULL OR attendanceDate <= :toDate) AND (:status IS NULL OR verificationStatus = :status) ORDER BY attendanceDate DESC, capturedAtIso DESC")
    fun observeFiltered(employeeId: String, fromDate: String? = null, toDate: String? = null, status: String? = null): Flow<List<AttendanceEntity>>

    @Query("SELECT * FROM attendance_records WHERE employeeId = :employeeId ORDER BY capturedAtIso DESC")
    fun observeForEmployee(employeeId: String): Flow<List<AttendanceEntity>>

    @Query("SELECT * FROM attendance_records WHERE syncStatus = 'PENDING_SYNC' ORDER BY createdAtIso ASC")
    suspend fun pendingSync(): List<AttendanceEntity>

    @Query("SELECT * FROM attendance_records WHERE offlineAttendanceId = :id LIMIT 1")
    suspend fun findById(id: String): AttendanceEntity?

    @Query("SELECT * FROM attendance_records WHERE employeeId = :employeeId AND attendanceDate = :date LIMIT 1")
    suspend fun findForDate(employeeId: String, date: String): AttendanceEntity?

    /** Every IN/OUT event locally known for this employee+day, oldest first — a day is a sequence now, not one row (see migration 020). */
    @Query("SELECT * FROM attendance_records WHERE employeeId = :employeeId AND attendanceDate = :date ORDER BY capturedAtIso ASC")
    suspend fun findEventsForDate(employeeId: String, date: String): List<AttendanceEntity>
}
