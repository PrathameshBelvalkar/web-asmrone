// Models, repository interfaces, the fake catalogue, Room and DataStore. No UI.
// docs/android/design/design.md §5.3, §9
plugins {
    id("echo.android.library")
    alias(libs.plugins.ksp)
}

android {
    namespace = "app.echo.data"
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
    arg("room.generateKotlin", "true")
}

dependencies {
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    testImplementation(libs.turbine)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
}
