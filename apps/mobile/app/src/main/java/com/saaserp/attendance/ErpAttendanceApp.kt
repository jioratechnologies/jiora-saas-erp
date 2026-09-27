package com.saaserp.attendance

import android.app.Application
import com.saaserp.attendance.di.ServiceLocator
import com.saaserp.attendance.sync.CheckoutReminderWorker
import com.saaserp.attendance.sync.SyncScheduler
import com.saaserp.attendance.util.NetworkMonitor

class ErpAttendanceApp : Application() {
    override fun onCreate() {
        super.onCreate()

        SyncScheduler.schedulePeriodic(this)
        CheckoutReminderWorker.schedule(this)
        // A password-reset request made before the app was closed still needs its outcome announced.
        if (ServiceLocator.authRepository(this).currentResetRequest()?.status == "pending") {
            com.saaserp.attendance.sync.ResetRequestWorker.schedule(this)
        }

        // Warm the repository singleton now (cheap) so the very first
        // connectivity callback below doesn't pay Room/Retrofit init cost.
        ServiceLocator.attendanceRepository(this)

        NetworkMonitor.registerConnectivityCallback(this) {
            SyncScheduler.triggerImmediateSync(this)
        }
    }
}
