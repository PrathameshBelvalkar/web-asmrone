// Theme, tokens, icons, M3 Expressive wrappers and Echo components. No data, no navigation.
// docs/android/design/design.md §5.2
plugins {
    id("echo.android.library")
    id("echo.android.compose")
    id("echo.android.screenshots")
}

android {
    namespace = "app.echo.designsystem"
}

// Every @Preview in :designsystem is a Roborazzi screenshot test (design.md §8.1, §12.2).
// @EchoPreviews render Light, Dark and Pure black in one image.
roborazzi {
    generateComposePreviewRobolectricTests {
        enable = true
        packages = listOf("app.echo.designsystem")
        includePrivatePreviews = true
        robolectricConfig = mapOf("qualifiers" to "\"w412dp-h2400dp-xhdpi\"")
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.material.kolor)
    implementation(libs.androidx.palette.ktx)
    implementation(libs.coil.compose)
}
