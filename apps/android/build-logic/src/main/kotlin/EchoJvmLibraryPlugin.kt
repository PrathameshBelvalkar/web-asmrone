import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.withType
import org.jetbrains.kotlin.gradle.dsl.KotlinJvmProjectExtension

/**
 * A backend module: plain Kotlin/JVM, no Android code.
 *
 * - JDK 17 toolchain, so the bytecode and the JDK API match what Android runs.
 * - JUnit 5 with coroutines-test.
 * - Tests get `echo.fixtures`: the absolute path of the fixtures shared with the TypeScript backend
 *   (`web/backend-express/tests/fixtures`), set once in gradle.properties as `echoFixtures`.
 */
class EchoJvmLibraryPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("org.jetbrains.kotlin.jvm")

        val libs = extensions.getByType<VersionCatalogsExtension>().named("libs")
        val jdk = libs.findVersion("jvmTarget").get().requiredVersion.toInt()

        extensions.configure<KotlinJvmProjectExtension> {
            jvmToolchain(jdk)
            explicitApi()
        }

        dependencies {
            add("implementation", libs.findLibrary("kotlinx-coroutines-core").get())
            add("testImplementation", platform(libs.findLibrary("junit-bom").get()))
            add("testImplementation", libs.findLibrary("junit-jupiter").get())
            add("testImplementation", libs.findLibrary("kotlinx-coroutines-test").get())
            add("testImplementation", kotlin("test-junit5"))
            add("testRuntimeOnly", libs.findLibrary("junit-platform-launcher").get())
        }

        val fixtures = rootProject.layout.projectDirectory
            .dir(providers.gradleProperty("echoFixtures").get())
            .asFile

        tasks.withType<Test>().configureEach {
            useJUnitPlatform {
                // Live checks hit the real sites. Run them by hand: ./gradlew test -PliveTests
                if (!providers.gradleProperty("liveTests").isPresent) excludeTags("live")
            }
            systemProperty("echo.fixtures", fixtures.absolutePath)
            inputs.dir(fixtures).withPropertyName("echoFixtures").optional()
        }
    }

    private fun kotlin(module: String) = "org.jetbrains.kotlin:kotlin-$module"
}
