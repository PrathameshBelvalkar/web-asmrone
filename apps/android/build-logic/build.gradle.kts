plugins {
    `kotlin-dsl`
}

dependencies {
    // compileOnly: the real plugins are loaded once by the root build.gradle.kts, so every module
    // (JVM and Android) shares the same Kotlin Gradle plugin.
    compileOnly(libs.kotlin.gradle.plugin)
}

gradlePlugin {
    plugins {
        register("jvmLibrary") {
            id = "echo.jvm.library"
            implementationClass = "EchoJvmLibraryPlugin"
        }
    }
}
