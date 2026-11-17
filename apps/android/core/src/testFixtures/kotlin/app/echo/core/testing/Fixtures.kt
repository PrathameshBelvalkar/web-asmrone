package app.echo.core.testing

import java.io.File

/**
 * The recorded pages shared with the TypeScript backend (`web/backend-express/tests/fixtures`).
 * The path comes from the `echo.fixtures` system property, which the `echo.jvm.library` plugin sets.
 *
 * ```kotlin
 * val html = Fixtures.read("javguru", "post-dldss-575.html")
 * ```
 */
public object Fixtures {
    public val root: File by lazy {
        val path = System.getProperty("echo.fixtures")
            ?: error("echo.fixtures is not set. Run tests through Gradle (the echo.jvm.library plugin sets it).")
        File(path).also { check(it.isDirectory) { "Fixture folder not found: $it" } }
    }

    public fun file(source: String, name: String): File =
        File(File(root, source), name).also { check(it.isFile) { "Fixture not found: $it" } }

    public fun read(source: String, name: String): String = file(source, name).readText()
}
