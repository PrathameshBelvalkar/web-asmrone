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

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.material.kolor)
    implementation(libs.androidx.palette.ktx)
}
