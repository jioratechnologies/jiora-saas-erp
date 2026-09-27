# Add project specific ProGuard rules here.

# SQLCipher's native lib does JNI field/method lookup by exact name (e.g.
# mNativeHandle on SQLiteDatabase) — R8 renaming any of it without this rule
# crashes app startup with NoSuchFieldError as soon as the DB opens.
-keep class net.sqlcipher.** { *; }
-keep class net.sqlcipher.database.* { *; }
-dontwarn net.sqlcipher.**

# ML Kit Face Detection loads its native model via reflection — same class
# of R8-renaming crash as SQLCipher above if left unprotected.
-keep class com.google.mlkit.vision.face.** { *; }
-keep class com.google.mlkit.vision.common.** { *; }
-dontwarn com.google.mlkit.**

-keepattributes *Annotation*
-keepclassmembers class kotlinx.serialization.internal.SerializationConstructorMarker { *; }
-keep,includedescriptorclasses class com.dsps.attendance.**$$serializer { *; }
-keepclassmembers class com.dsps.attendance.** { *** Companion; }
-keepclasseswithmembers class com.dsps.attendance.** { kotlinx.serialization.KSerializer serializer(...); }
