// :source-asmrone. Port of web/backend-express/src/extension/asmrone.
plugins {
    id("echo.jvm.library")
    alias(libs.plugins.kotlin.serialization)
}

dependencies {
    api(project(":core"))
    // M4: com.github.rebelonion:translator (libs.translator), as used by backend/asmrone.

    testImplementation(testFixtures(project(":core")))
    testImplementation(libs.okhttp.mockwebserver)
}
