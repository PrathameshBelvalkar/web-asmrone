package app.echo.android.navigation

import app.echo.data.model.Profile
import app.echo.data.model.Section
import app.echo.data.model.Source
import app.echo.data.model.Sources

/** The three navigation bar tabs. */
enum class Tab { HOME, SEARCH, LIBRARY }

/**
 * The navigation bar follows the section (design.md §10.2): Home · Search · Library open different screens for
 * ASMR, Manga, JAV and Hentai.
 */
object SectionNav {
    fun root(section: Section, tab: Tab): Route = when (section) {
        Section.ASMR -> when (tab) {
            Tab.HOME -> Route.AsmrHome
            Tab.SEARCH -> Route.AsmrSearch
            Tab.LIBRARY -> Route.Library
        }
        Section.MANGA -> when (tab) {
            Tab.HOME -> Route.MangaBrowse
            Tab.SEARCH -> Route.MangaSearch
            Tab.LIBRARY -> Route.Library
        }
        Section.JAV -> when (tab) {
            Tab.HOME -> Route.News
            Tab.SEARCH -> Route.JavSearch
            Tab.LIBRARY -> Route.JavLibrary
        }
        Section.HENTAI -> when (tab) {
            Tab.HOME -> Route.HentaiHome
            Tab.SEARCH -> Route.HentaiSearch
            Tab.LIBRARY -> Route.HentaiLibrary
        }
    }

    /** Which tab a top-level route belongs to, if it is one of [section]'s tab roots. */
    fun tabOf(section: Section, route: Route): Tab? = Tab.entries.firstOrNull { root(section, it) == route }

    /**
     * The source to show: the stored one if the profile still allows it, otherwise the first visible source
     * (e.g. after turning adult sources off).
     */
    fun activeSource(lastSourceId: String, profile: Profile): Source {
        val visible = profile.visibleSources()
        return visible.firstOrNull { it.id == lastSourceId } ?: visible.firstOrNull() ?: Sources.asmrOne
    }

    /** Start destination (§10.3): onboarding until it's done, then the active section's Home. */
    fun start(profile: Profile, lastSourceId: String): Route =
        if (!profile.onboardingDone) Route.Splash else root(activeSource(lastSourceId, profile).section, Tab.HOME)
}
