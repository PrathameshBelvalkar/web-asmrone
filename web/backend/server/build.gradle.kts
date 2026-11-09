plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
    id("io.ktor.plugin")
    application
}

kotlin {
    jvmToolchain(17)
}

application {
    mainClass.set("echo.web.MainKt")
}

dependencies {
    implementation(project(":asmrone"))
    implementation("dev.brahmkshatriya.echo:common:1.0")
    implementation("com.squareup.okhttp3:okhttp:5.1.0")
    implementation("io.ktor:ktor-server-netty")
    implementation("io.ktor:ktor-server-content-negotiation")
    implementation("io.ktor:ktor-serialization-kotlinx-json")
    implementation("io.ktor:ktor-server-status-pages")
    implementation("io.ktor:ktor-server-partial-content")
    implementation("io.ktor:ktor-server-default-headers")
    implementation("io.ktor:ktor-server-call-logging")
    implementation("io.ktor:ktor-server-cors")
    implementation("ch.qos.logback:logback-classic:1.5.19")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
    testImplementation(kotlin("test"))
    testImplementation("io.ktor:ktor-server-test-host")
}

tasks.test {
    useJUnitPlatform()
}
