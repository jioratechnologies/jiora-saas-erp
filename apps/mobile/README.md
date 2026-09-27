# SaaS ERP Attendance (Android)

Employee-facing attendance app implementing the online/offline verification
model in `../ATTENDANCE_PLAN.md` — **read that file first**, it's the
source of truth for why this app is built the way it is.

## Status

Freshly scaffolded, **not yet built or run** — this was written in a
text-only environment with no Android SDK/emulator, so treat it as a
first draft to open in Android Studio, not a working artifact yet. See
"Known gaps to fix on first build" below before you file a bug for
something obviously wrong — some of these are already known.

## Stack

Kotlin, Jetpack Compose, Room (encrypted via SQLCipher), Retrofit +
kotlinx.serialization, WorkManager, CameraX, Play Services Location. No
Hilt/Dagger — dependencies are wired manually in `di/ServiceLocator.kt` to
keep the build graph simple to reason about without a compiler in the loop
verifying it.

## Setup

1. Open the `android/` folder as a project in Android Studio (Koala or
   newer recommended for AGP 8.5 / Kotlin 1.9 compatibility).
2. Copy `local.properties.example` → `local.properties` and fill in:
   - `SUPABASE_ANON_KEY` — same value as the website's
     `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `../.env.local`.
   - `API_BASE_URL` — `http://10.0.2.2:3000/` for the emulator talking to
     `npm run dev` on your host machine; your real domain for a physical
     device or release build.
3. Let Gradle sync. First sync will download the Android Gradle Plugin,
   Kotlin, Compose, Room/KSP, SQLCipher, CameraX, WorkManager, Play
   Services Location, Retrofit/OkHttp — expect it to take a while.
4. Run on an emulator with Google Play services (required for
   `play-services-location`) with `npm run dev` already running on the
   host so `10.0.2.2:3000` resolves.

## Design system — "liquid glass" M3

`ui/theme/` and `ui/components/` implement a SaaS ERP-branded Material 3 theme
(saffron/maroon color roles matching the website's Tailwind tokens, larger
"M3 Expressive"-style corner radii, tuned type scale) plus a glassmorphic
surface treatment:

- `ui/components/GlassBackdrop.kt` — three large, heavily-blurred colour
  fields drifting slowly behind the content (`Modifier.blur`, stable core
  Compose API, no extra dependency). This is what makes translucent
  surfaces on top actually read as "glass" instead of just looking murky.
- `ui/components/GlassSurface.kt` — the frosted-card primitive used
  everywhere (login form, check-in camera frame, result banner, history
  rows): translucent gradient fill + a diagonal edge-highlight border +
  soft shadow.

**Important honesty note**: this is NOT true backdrop blur — a
`GlassSurface` does not sample and blur whatever is specifically behind
*its own bounds* the way iOS's Liquid Glass or a real frosted-glass
compositor does. Doing that properly in Compose needs either a
RenderEffect/GraphicsLayer compositing pipeline or a dedicated library
(the well-known one is [Haze by Chris Banes](https://github.com/chrisbanes/haze),
`dev.chrisbanes.haze:haze`). I deliberately didn't pin Haze as a
dependency here: its API has changed across versions
(`Modifier.haze`/`hazeChild` in older releases vs.
`hazeSource`/`hazeEffect` in newer ones) and I have no compiler in this
environment to verify which version/API is actually correct right now —
shipping that blind risked a dependency that simply doesn't compile. If
you want true see-through backdrop blur, add Haze in Android Studio
(where you can verify the current API against its docs) and swap
`GlassSurface`'s fill for a `hazeEffect` sourced from `GlassBackdrop`.

## Known gaps to fix on first build

These are the things most likely to need a small fix once a real compiler
looks at this code — flagged here so you're not surprised:

- **SQLCipher artifact coordinates/version** (`net.zetetic:android-database-sqlcipher:4.5.4`
  in `app/build.gradle.kts`) — double-check against Maven Central for the
  current latest, this ecosystem's versioning moves.
- **Compose compiler / Kotlin version pairing** (`kotlinCompilerExtensionVersion = "1.5.14"`
  paired with Kotlin `1.9.24`) — verify against the
  [Compose-Kotlin compatibility map](https://developer.android.com/jetpack/androidx/releases/compose-kotlin)
  at build time; a mismatch here is a very common first-build error.
- **`android:networkSecurityConfig`** only allow-lists cleartext HTTP for
  `10.0.2.2` (the emulator's loopback alias). A physical device pointed at
  a `http://` LAN IP for `API_BASE_URL` will need its own entry added to
  `res/xml/network_security_config.xml`, or (better) just serve the
  Next.js dev server over HTTPS.
- **Supabase Storage bucket for photos doesn't exist yet** (`PhotoUploader.kt`,
  bucket name `attendance-photos`) — see ATTENDANCE_PLAN.md decision D5.
  Uploads will 404 until an admin creates it with the right RLS policy;
  the app is written to degrade gracefully (`photo_url = null`) rather
  than block check-in when that happens, but it's not exercised yet.
- **Launcher icon** is a plain vector placeholder (saffron square + a
  simple mark), not real branded artwork — swap
  `res/drawable/ic_launcher_foreground.xml` for the real SaaS ERP mark
  whenever there's design time for it.
- No automated tests yet (unit or instrumented). The critical logic worth
  testing first: `AttendanceRepository.checkIn()`'s online/offline branch
  and the local one-per-day guard, since those are exactly the invariants
  ATTENDANCE_PLAN.md exists to protect.
- **Material icon names** (`Icons.Filled.Organization`, `.CameraAlt`, `.History`,
  `.CheckCircle`, `.Warning`, `.Error`, `.HourglassTop`, `.Email`, `.Lock`)
  are all standard, long-established icons in
  `androidx.compose.material:material-icons-extended` (already added to
  `app/build.gradle.kts`) and I'm confident they exist, but I can't run
  the compiler to confirm the exact identifiers on the BOM version pinned
  here — if one fails to resolve, Android Studio's autocomplete will
  suggest the closest real name immediately.
- **`OutlinedTextFieldDefaults.colors(...)` parameter names**
  (`focusedContainerColor` etc., used in `LoginScreen.kt`) are the current
  M3 API as of the Compose BOM pinned in `app/build.gradle.kts` — this
  specific API shape changed across M3 versions, so if it's a compile
  error, check `OutlinedTextFieldDefaults` for the current parameter names
  in your resolved version first before assuming something else is wrong.

## Architecture map

```
ui/            Compose screens + ViewModels (login, check-in, history)
data/local/    Room entities/DAO + SQLCipher-encrypted AppDatabase
data/remote/   Retrofit interface + DTOs for the Next.js attendance API
data/auth/     Direct Supabase Auth REST calls + Keystore-backed token storage
data/repository/  AttendanceRepository — the online/offline decision logic
location/      GPS capture + mock-location / root heuristics (untrusted signals)
camera/        CameraX capture wrapper
sync/          WorkManager job that reconciles PENDING_SYNC records
di/            Manual dependency wiring (ServiceLocator, NetworkModule)
```

## The one rule that must never regress

An OFFLINE capture is written to Room as `PENDING_VERIFICATION` /
`PENDING_SYNC` and **the app never sets it to VERIFIED itself** — only a
successful response from `/api/attendance/sync` can do that
(`AttendanceRepository.syncPendingRecords`). If you're adding a feature
and find yourself tempted to set `verificationStatus = "VERIFIED"` outside
of that one function, stop and re-read ATTENDANCE_PLAN.md section 1.
