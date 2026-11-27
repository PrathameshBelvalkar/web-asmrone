plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.serialization)
    id("echo.android.compose")
    id("echo.android.screenshots")
}

android {
    namespace = "app.echo.android"
    compileSdk = libs.versions.compileSdk.get().toInt()
    compileSdkMinor = libs.versions.compileSdkMinor.get().toInt()

    defaultConfig {
        applicationId = "app.echo.android" // placeholder
        minSdk = libs.versions.minSdk.get().toInt()
        targetSdk = libs.versions.targetSdk.get().toInt()
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Signing: M8 (keystore from local.properties, never committed).
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
        // §12.3 device tests: no window animations, so waits are about the app, not the transitions.
        animationsDisabled = true
    }

    lint {
        warningsAsErrors = false
        abortOnError = true
    }
}

// Every screen @Preview under feature/ is a Roborazzi screenshot test (design.md §12.2).
roborazzi {
    generateComposePreviewRobolectricTests {
        enable = true
        packages = listOf("app.echo.android.feature")
        includePrivatePreviews = true
    }
}

kotlin {
    jvmToolchain(libs.versions.jvmTarget.get().toInt())
}

dependencies {
    implementation(project(":designsystem"))
    implementation(libs.coil.compose)
    implementation(project(":data"))
    implementation(project(":services"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.reorderable)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.timber)
    // Compose, Material 3 and tooling come from echo.android.compose; Roborazzi from echo.android.screenshots.

    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(libs.compose.ui.test.junit4)
    // ComponentActivity for tests that host a screen on its own (BackNavigationTest).
    debugImplementation(libs.compose.ui.test.manifest)
}
