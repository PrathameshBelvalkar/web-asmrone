package app.echo.data.fake

/** One Echo release (S.11, S.13, S.14). */
data class AppRelease(val version: String, val sizeMb: Float, val date: String, val notes: List<String> = emptyList())

/**
 * The update feed until the GitHub releases check exists (design.md S.13 "Design phase: FakeUpdateRepository"):
 * the installed version and the one offered, with the Figma release notes.
 */
object FakeUpdates {
    val installed = AppRelease("0.1.6", 18.1f, "Nov 16")
    val available: AppRelease? = AppRelease(
        "0.1.7", 18.4f, "Nov 20",
        listOf(
            "Lyrics: karaoke highlight and EN / JP toggle",
            "Manga reader: two-page spreads in landscape",
            "Faster search suggestions",
        ),
    )
    /** Newest first, the installed one included. */
    val history = listOf(installed, AppRelease("0.1.5", 17.9f, "Nov 9"), AppRelease("0.1.4", 17.6f, "Nov 2"))
}
