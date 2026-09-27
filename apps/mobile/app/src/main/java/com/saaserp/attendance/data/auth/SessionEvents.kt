package com.saaserp.attendance.data.auth

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

/**
 * App-wide "the session is definitively dead" signal — emitted by a
 * repository when a request comes back 401 even after the OkHttp
 * Authenticator already tried a silent token refresh (see
 * NetworkModule.AuthAuthenticator). MainActivity collects this once and
 * runs the same logout + navigate-to-login it uses for a manual sign-out,
 * so an expired session surfaces as "please log in again" instead of a
 * repository just returning an error string a screen has to know to
 * interpret specially.
 */
object SessionEvents {
    private val _expired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val expired: SharedFlow<Unit> = _expired

    fun notifyExpired() {
        _expired.tryEmit(Unit)
    }
}
