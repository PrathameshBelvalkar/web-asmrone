import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.getByType
import io.github.takahirom.roborazzi.RoborazziExtension
import org.gradle.api.tasks.testing.Test
import org.gradle.jvm.toolchain.JavaLanguageVersion
import org.gradle.jvm.toolchain.JavaToolchainService
import org.gradle.kotlin.dsl.withType

/**
 * Roborazzi screenshot tests on the JVM (Robolectric), docs/android/design/design.md §12.2.
 *
 * Baselines live in `src/test/screenshots/` and are committed.
 * - `./gradlew recordRoborazziDebug`  records them (after a person has checked the screen against Figma)
 * - `./gradlew verifyRoborazziDebug`  fails on any pixel change
 * - `./gradlew test`                   runs the tests without comparing
 *
 * Tests run on a Java 21 JVM (Robolectric needs it for SDK 37); the toolchain is downloaded if missing.
 */
class EchoScreenshotTestPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("io.github.takahirom.roborazzi")

        extensions.configure<RoborazziExtension> {
            outputDir.set(layout.projectDirectory.dir("src/test/screenshots"))
        }

        val libs = extensions.getByType<VersionCatalogsExtension>().named("libs")
        fun lib(name: String) = libs.findLibrary(name).get()

        // Robolectric runs SDK 37 only on Java 21. Code is still compiled for 17.
        val testJdk = libs.findVersion("testJvm").get().requiredVersion.toInt()
        val toolchains = extensions.getByType<JavaToolchainService>()
        tasks.withType<Test>().configureEach {
            javaLauncher.set(toolchains.launcherFor { languageVersion.set(JavaLanguageVersion.of(testJdk)) })
        }

        dependencies {
            add("testImplementation", lib("junit4"))
            add("testImplementation", lib("robolectric"))
            add("testImplementation", lib("roborazzi"))
            add("testImplementation", lib("roborazzi-compose"))
            add("testImplementation", lib("roborazzi-junit-rule"))
            // Preview-driven tests: every @Preview in the module becomes a screenshot test (see the module's
            // roborazzi { generateComposePreviewRobolectricTests { … } } block).
            add("testImplementation", lib("roborazzi-preview-scanner-support"))
            add("testImplementation", lib("composable-preview-scanner"))
            add("testImplementation", lib("compose-ui-test-junit4"))
            // Roborazzi captures through Espresso. Older Espresso calls InputManager.getInstance(), gone in SDK 37.
            add("testImplementation", lib("androidx-test-espresso-core"))
            add("debugImplementation", lib("compose-ui-test-manifest"))
        }
    }
}
