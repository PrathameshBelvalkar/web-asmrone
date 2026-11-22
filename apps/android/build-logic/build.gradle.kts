plugins {
    `kotlin-dsl`
}

dependencies {
    // compileOnly: the real plugins are loaded once by the root build.gradle.kts, so every module
    // (JVM and Android) shares the same Kotlin, Android and Roborazzi Gradle plugins.
    compileOnly(libs.kotlin.gradle.plugin)
    compileOnly(libs.android.gradle.plugin)
    compileOnly(libs.compose.compiler.gradle.plugin)
    compileOnly(libs.roborazzi.gradle.plugin)
}

gradlePlugin {
    plugins {
        register("jvmLibrary") {
            id = "echo.jvm.library"
            implementationClass = "EchoJvmLibraryPlugin"
        }
        register("androidLibrary") {
            id = "echo.android.library"
            implementationClass = "EchoAndroidLibraryPlugin"
        }
        register("androidCompose") {
            id = "echo.android.compose"
            implementationClass = "EchoAndroidComposePlugin"
        }
        register("androidScreenshots") {
            id = "echo.android.screenshots"
            implementationClass = "EchoScreenshotTestPlugin"
        }
    }
}
