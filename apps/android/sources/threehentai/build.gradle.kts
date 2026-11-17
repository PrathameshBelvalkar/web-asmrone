// :source-threehentai. Port of web/backend-express/src/extension/threehentai (docs/ANDROID.md §4.2).
plugins {
    id("echo.jvm.library")
    alias(libs.plugins.kotlin.serialization)
}

dependencies {
    api(project(":core"))

    testImplementation(testFixtures(project(":core")))
    testImplementation(libs.okhttp.mockwebserver)
}
