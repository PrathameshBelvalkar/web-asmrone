package app.echo.data

import app.echo.data.model.Profile
import app.echo.data.model.Section
import app.echo.data.model.Sources
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** design.md §9.2 adult content rule. */
class ProfileRulesTest {
    @Test
    fun `under 18 hides JAV, Hentai and adult sources even with the switch on`() {
        val p = Profile(age = 16, showAdultSources = true)
        assertFalse(p.adultAllowed)
        assertEquals(listOf(Section.ASMR, Section.MANGA), p.visibleSections)
        val ids = p.visibleSources().map { it.id }
        assertEquals(listOf("asmrone", "jnet", "jasmr"), ids)
    }

    @Test
    fun `18 with the switch off still hides them`() {
        assertFalse(Profile(age = 18, showAdultSources = false).adultAllowed)
    }

    @Test
    fun `18 with the switch on shows everything`() {
        val p = Profile(age = 18, showAdultSources = true)
        assertTrue(p.adultAllowed)
        assertEquals(Section.entries, p.visibleSections)
        assertEquals(Sources.all, p.visibleSources())
    }

    @Test
    fun `no age yet counts as under 18`() {
        assertFalse(Profile(age = null, showAdultSources = true).adultAllowed)
    }

    @Test
    fun `disabled sections are hidden`() {
        val p = Profile(age = 30, showAdultSources = true, enabledSections = setOf(Section.ASMR))
        assertEquals(listOf(Section.ASMR), p.visibleSections)
    }
}
