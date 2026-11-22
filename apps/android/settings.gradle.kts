pluginManagement {
    includeBuild("build-logic")
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    // Downloads the JDK 17 toolchain when the machine doesn't have one (see docs/DEVELOPMENT.md).
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Only for com.github.rebelonion:translator (asmr.one translation, M4).
        maven("https://jitpack.io") {
            content { includeGroup("com.github.rebelonion") }
        }
    }
}

rootProject.name = "echo-android"

// Backend: pure Kotlin/JVM, no Android code.
include(":core")
include(":services")

// One module per site. Gradle path :source-<id>, folder sources/<id>.
listOf("asmrone", "hasmr", "jasmr", "jnet", "threehentai", "javdatabase", "javguru").forEach { id ->
    include(":source-$id")
    project(":source-$id").projectDir = file("sources/$id")
}

// The Android app and its UI layers (docs/android/design/design.md §5.1).
include(":designsystem")
include(":data")
include(":app")
