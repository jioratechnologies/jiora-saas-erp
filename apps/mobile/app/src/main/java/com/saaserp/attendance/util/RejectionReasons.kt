package com.saaserp.attendance.util

/**
 * Translates the server's REJECTED/FLAGGED reason strings (see
 * decideVerificationStatus / validateNextEventType in
 * src/lib/attendance/validation.ts) into plain language for a non-technical
 * staff member. The server keeps the precise, technical wording — the web
 * admin panel needs that detail to investigate — this only reshapes what
 * the phone screen shows.
 */
private val KNOWN_PATTERNS: List<Pair<Regex, (MatchResult) -> String>> = listOf(
    Regex("Outside campus geofence \\((\\d+)m away\\)") to { m ->
        "You're too far from the organization (about ${m.groupValues[1]}m away). Move closer to campus and try again."
    },
    Regex("already checked in", RegexOption.IGNORE_CASE) to { _ ->
        "Already checked in for today — check out first if you need to leave."
    },
    Regex("haven't checked in yet", RegexOption.IGNORE_CASE) to { _ ->
        "No check-in found for today yet — check in before checking out."
    },
    Regex("Timestamp failed sanity check|captured_at is (in the future|implausibly old)", RegexOption.IGNORE_CASE) to { _ ->
        "Your phone's date & time look incorrect. Please fix them in your phone's settings and try again."
    },
    Regex("Play Integrity verification failed", RegexOption.IGNORE_CASE) to { _ ->
        "Your device could not be verified as genuine. Please contact your organization admin."
    },
    Regex("mock-location signal", RegexOption.IGNORE_CASE) to { _ ->
        "Your phone reported a fake/simulated location. Turn off any location-faking app or developer setting and try again."
    },
    Regex("root/tamper risk signal", RegexOption.IGNORE_CASE) to { _ ->
        "Your phone reported a security risk (rooted/tampered device). Please contact your organization admin."
    },
    Regex("Selected staff member is not eligible", RegexOption.IGNORE_CASE) to { _ ->
        "This staff member isn't set up for attendance marking. Please contact your organization admin."
    },
    Regex("Selected staff member not found", RegexOption.IGNORE_CASE) to { _ ->
        "Could not find that staff member. Please try again."
    },
    Regex("Left before organization closing time", RegexOption.IGNORE_CASE) to { m -> m.value },
)

/** One rejection/flag reason from the server, reworded for a non-technical reader. */
fun humanizeReason(raw: String): String {
    for ((pattern, transform) in KNOWN_PATTERNS) {
        val match = pattern.find(raw)
        if (match != null) return transform(match)
    }
    return raw
}

/** A whole reasons list, each entry humanized — de-duplicated since two technical phrases can map to the same plain sentence. */
fun humanizeReasons(reasons: List<String>): List<String> =
    reasons.map(::humanizeReason).distinct()
