// Models, repository interfaces, fake catalogue, Room and DataStore. No UI.
// docs/android/design/design.md §5.3 (filled in Phase 3)
plugins {
    id("echo.android.library")
}

android {
    namespace = "app.echo.data"
}

dependencies {
    implementation(libs.kotlinx.coroutines.android)
}
