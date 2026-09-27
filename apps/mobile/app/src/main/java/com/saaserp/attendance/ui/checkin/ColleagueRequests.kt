package com.saaserp.attendance.ui.checkin

import com.saaserp.attendance.data.remote.ColleagueDto
import kotlinx.coroutines.flow.MutableStateFlow

/** Hand-off from History ("Marked by Me" → Mark Out) to the check-in screen, which owns the location + camera flow. */
object ColleagueRequests {
    val markOut = MutableStateFlow<ColleagueDto?>(null)
}
