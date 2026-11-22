package app.echo.android.navigation

import app.echo.data.model.Profile
import app.echo.data.model.Section
import app.echo.data.model.Sources
import org.junit.Assert.assertEquals
import org.junit.Test

/** design.md §10.2 table and §10.3 start destination, §12.1 › Rules. */
class SectionNavTest {
    @Test
    fun `navigation bar follows the section`() {
        val expected = mapOf(
            Section.ASMR to listOf("1.1", "1.2", "0.2"),
            Section.MANGA to listOf("2.1", "2.2", "0.2"),
            Section.JAV to listOf("3.1", "3.11", "3.12"),
            Section.HENTAI to listOf("H.1", "H.6", "H.9"),
        )
        expected.forEach { (section, codes) ->
            assertEquals(section.name, codes, Tab.entries.map { ScreenSpecs.of(SectionNav.root(section, it)).code })
        }
    }

    @Test
    fun `onboarding first, then the last section's Home`() {
        assertEquals(Route.Splash, SectionNav.start(Profile(), Sources.asmrOne.id))
        val adult = Profile(onboardingDone = true, age = 30, showAdultSources = true)
        assertEquals(Route.MangaBrowse, SectionNav.start(adult, Sources.threeHentai.id))
        assertEquals(Route.News, SectionNav.start(adult, Sources.javDatabase.id))
        assertEquals(Route.HentaiHome, SectionNav.start(adult, Sources.hanime.id))
    }

    @Test
    fun `a source the profile no longer allows falls back to the first visible one`() {
        val minor = Profile(onboardingDone = true, age = 16)
        assertEquals(Sources.asmrOne, SectionNav.activeSource(Sources.javDatabase.id, minor))
        assertEquals(Route.AsmrHome, SectionNav.start(minor, Sources.javDatabase.id))
    }

    @Test
    fun `tab roots are recognised per section`() {
        assertEquals(Tab.LIBRARY, SectionNav.tabOf(Section.JAV, Route.JavLibrary))
        assertEquals(null, SectionNav.tabOf(Section.ASMR, Route.JavLibrary))
    }
}
