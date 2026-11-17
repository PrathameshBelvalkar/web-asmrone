package app.echo.core

/** The app's three sections. The source switcher groups sources by these (docs/ANDROID.md §9.1). */
public enum class Section { ASMR, MANGA, JAV }

/**
 * Every site Echo reads from. [id] is the same ID the TypeScript backend uses
 * (`source-router.ts` for the ASMR sources), and the name of the fixture folder in
 * `web/backend-express/tests/fixtures/` when the source has one.
 */
public enum class SourceId(public val id: String, public val section: Section, public val hasFixtures: Boolean) {
    ASMRONE("asmrone", Section.ASMR, hasFixtures = false),
    HASMR("hasmr", Section.ASMR, hasFixtures = true),
    JASMR("jasmr", Section.ASMR, hasFixtures = true),
    JNET("jnet", Section.ASMR, hasFixtures = true),
    THREEHENTAI("threehentai", Section.MANGA, hasFixtures = true),
    JAVDATABASE("javdatabase", Section.JAV, hasFixtures = true),

    /** Streams only: reached through javdatabase's Watch button, never picked in the switcher. */
    JAVGURU("javguru", Section.JAV, hasFixtures = true),
    ;

    public companion object {
        public fun fromId(id: String): SourceId? = entries.firstOrNull { it.id == id }
    }
}
