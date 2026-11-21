// :services. AsmrService, MangaService, JavService, JavStreamService and SourceRouter.
plugins {
    id("echo.jvm.library")
    alias(libs.plugins.kotlin.serialization)
}

dependencies {
    api(project(":core"))
    listOf("asmrone", "hasmr", "jasmr", "jnet", "threehentai", "javdatabase", "javguru").forEach {
        api(project(":source-$it"))
    }

    testImplementation(testFixtures(project(":core")))
    testImplementation(libs.okhttp.mockwebserver)
}
