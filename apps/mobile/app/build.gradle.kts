import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
    id("org.jetbrains.kotlin.plugin.compose")
}

// local.properties is gitignored — mirrors the Next.js repo's .env.local
// pattern. Copy local.properties.example, fill in real values.
val localProperties = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) load(FileInputStream(f))
}

fun localProp(key: String, default: String = ""): String =
    (localProperties.getProperty(key) ?: System.getenv(key) ?: default)

// ── Dev/Production switch (see ATTENDANCE_PLAN.md, gradle.properties) ──
// Fails the build for a release variant unless explicitly "production" —
// this must never silently fall back to a dev-permissive build.
//
// Precedence, highest first: local.properties (per-machine override, like
// .env.local) > a Gradle project property (either -PattendanceMode=... on
// the command line, or the checked-in gradle.properties default) > "dev".
// BUG FIXED HERE: this used to check project.findProperty() first, but
// gradle.properties' checked-in `attendanceMode=dev` is ALSO exposed as a
// project property — so it always won before local.properties was ever
// consulted, making the per-machine override silently do nothing.
val attendanceMode: String = localProperties.getProperty("attendanceMode")
    ?: (project.findProperty("attendanceMode") as String?)
    ?: "dev"

android {
    namespace = "com.saaserp.attendance"
    compileSdk = 34

    // Must be configured before defaultConfig below — AGP's DSL applies
    // buildFeatures flags as it evaluates the script top-to-bottom, and
    // defaultConfig's buildConfigField(...) calls need buildConfig=true
    // to already be set, not set later in the same file.
    buildFeatures {
        compose = true
        buildConfig = true
    }

    defaultConfig {
        applicationId = "com.saaserp.attendance"
        minSdk = 26
        targetSdk = 34
        versionCode = 4
        versionName = "1.2.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "ATTENDANCE_MODE", "\"$attendanceMode\"")
        buildConfigField("String", "API_BASE_URL", "\"${localProp("API_BASE_URL", "http://10.0.2.2:3000/")}\"")
        buildConfigField("String", "SUPABASE_URL", "\"${localProp("SUPABASE_URL")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${localProp("SUPABASE_ANON_KEY")}\"")
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // ── Core / Compose ──────────────────────────────────────────────
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("io.coil-kt:coil-compose:2.6.0")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // ── Coroutines ──────────────────────────────────────────────────
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // ── Local storage: Room, encrypted via SQLCipher ────────────────
    implementation("androidx.room:room-runtime:2.7.2")
    implementation("androidx.room:room-ktx:2.7.2")
    ksp("androidx.room:room-compiler:2.7.2")
    implementation("net.zetetic:android-database-sqlcipher:4.5.4")
    implementation("androidx.sqlite:sqlite:2.4.0")

    // ── Secure key storage (Keystore-backed) & Biometrics ────────────────────────
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.biometric:biometric:1.2.0-alpha05")

    // ── Networking ──────────────────────────────────────────────────
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // ── Background sync ─────────────────────────────────────────────
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // ── Camera ──────────────────────────────────────────────────────
    implementation("androidx.camera:camera-core:1.3.4")
    implementation("androidx.camera:camera-camera2:1.3.4")
    implementation("androidx.camera:camera-lifecycle:1.3.4")
    implementation("androidx.camera:camera-view:1.3.4")

    // Free, on-device, no API key/Google Cloud project — used only for a
    // live blink challenge (basic liveness signal against a photo-of-a-
    // photo spoof). Never blocks check-in on its own if unavailable.
    implementation("com.google.mlkit:face-detection:16.1.7")

    // ── Location ────────────────────────────────────────────────────
    implementation("com.google.android.gms:play-services-location:21.3.0")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}

// Hard stop: a *release* build with attendanceMode left at "dev" is a
// misconfiguration, not a valid production artifact — fail loudly instead
// of shipping it silently. Deferred to taskGraph.whenReady (not inside the
// `release {}` block above) because AGP configures every build type on
// every sync/debug build too — throwing at config time broke plain
// `./gradlew :app:compileDebugKotlin` and Android Studio sync whenever
// attendanceMode was "dev", even though no release task was requested.
gradle.taskGraph.whenReady {
    val buildingRelease = allTasks.any { it.path.contains(":app:") && it.name.contains("Release") }
    if (buildingRelease && attendanceMode != "production") {
        throw GradleException(
            "Release build requires attendanceMode=production (got \"$attendanceMode\"). " +
                "Pass -PattendanceMode=production or set it in local.properties."
        )
    }
}
