package app.echo.android.feature.shared

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.ui.formatDuration
import app.echo.android.ui.formatTimeLeft
import app.echo.data.model.ContinueItem
import app.echo.data.model.Section

/** The section name on a cover badge: ASMR, MANGA, JAV, HENTAI (0.2 Continue). */
@Composable
fun sectionLabel(section: Section): String = stringResource(
    when (section) {
        Section.ASMR -> R.string.section_asmr
        Section.MANGA -> R.string.section_manga
        Section.JAV -> R.string.section_jav
        Section.HENTAI -> R.string.section_hentai
    },
)

/** Where a continue or history item opens: 1.5 Work, 2.5 Gallery, 3.6 Movie, H.7 Title. */
fun ContinueItem.openRoute(): Route = when (section) {
    Section.ASMR -> Route.Work(id)
    Section.MANGA -> Route.Gallery(id)
    Section.JAV -> Route.Movie(id)
    Section.HENTAI -> Route.HentaiTitle(id)
}

/** The progress line under a continue card: "42 min left", "p. 34 / 52", "Resume 42:07". */
@Composable
fun continueMeta(item: ContinueItem): String = when (item.section) {
    Section.ASMR -> formatTimeLeft(item)
    Section.MANGA -> stringResource(R.string.library_page, item.page, item.pageCount)
    Section.JAV, Section.HENTAI -> stringResource(R.string.library_resume, formatDuration(item.positionMs))
}
