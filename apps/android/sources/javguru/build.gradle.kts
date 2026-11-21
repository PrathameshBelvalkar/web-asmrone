// :source-javguru. Port of web/backend-express/src/extension/javguru.
plugins {
    id("echo.jvm.library")
    alias(libs.plugins.kotlin.serialization)
}

dependencies {
    api(project(":core"))

    testImplementation(testFixtures(project(":core")))
    testImplementation(libs.okhttp.mockwebserver)
}
