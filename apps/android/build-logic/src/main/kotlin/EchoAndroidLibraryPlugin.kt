import com.android.build.api.dsl.LibraryExtension
import org.gradle.api.JavaVersion
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.getByType
import org.jetbrains.kotlin.gradle.dsl.KotlinBaseExtension

/**
 * An Android library module (`:designsystem`, `:data`).
 *
 * - SDK levels from the version catalog, Java/Kotlin 17 (AGP's built-in Kotlin).
 * - Lint fails the build on errors, like `:app`.
 * - JVM unit tests on JUnit 4 (Robolectric runs on JUnit 4) with Android resources available.
 *
 * Add `echo.android.compose` for Compose and `echo.android.screenshots` for Roborazzi.
 */
class EchoAndroidLibraryPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("com.android.library")

        val libs = extensions.getByType<VersionCatalogsExtension>().named("libs")
        fun version(name: String) = libs.findVersion(name).get().requiredVersion
        val jdk = version("jvmTarget").toInt()

        extensions.configure<LibraryExtension> {
            compileSdk = version("compileSdk").toInt()
            defaultConfig {
                minSdk = version("minSdk").toInt()
                testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
                consumerProguardFiles("consumer-rules.pro")
            }
            compileOptions {
                sourceCompatibility = JavaVersion.toVersion(jdk)
                targetCompatibility = JavaVersion.toVersion(jdk)
            }
            testOptions {
                unitTests.isIncludeAndroidResources = true
            }
            lint {
                warningsAsErrors = false
                abortOnError = true
            }
        }

        (extensions.getByName("kotlin") as KotlinBaseExtension).jvmToolchain(jdk)

        dependencies {
            add("testImplementation", libs.findLibrary("junit4").get())
            add("testImplementation", libs.findLibrary("kotlinx-coroutines-test").get())
        }
    }
}
