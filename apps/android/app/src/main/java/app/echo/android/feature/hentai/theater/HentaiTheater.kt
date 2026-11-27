package app.echo.android.feature.hentai.theater

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import app.echo.android.R
import app.echo.android.feature.shared.theater.TheaterMedia
import app.echo.android.feature.shared.theater.TheaterRoute
import app.echo.android.feature.shared.theater.TheaterViewModel
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.HentaiTitle
import app.echo.data.model.Section
import app.echo.data.repository.Load
import kotlinx.coroutines.flow.first

/** Stream hosts the Source button offers (H.11). */
private val Hosts = listOf("hentaibros.net", "hanime.tv")

/**
 * Figma H.11 Theater (28:6140): like 3.7, with ✕, "EPISODE 1 · SUB EN" and a Source button for the stream host
 * instead of quality. Resumes the episode where H.9 left it, and saves to the Hentai watch history.
 */
@Composable
fun HentaiTheaterRoute(id: String, episode: Int, shell: ShellActions) {
    val res = LocalContext.current.resources
    val vm = echoViewModel(key = "hentai-theater-$id-$episode") { c ->
        var title: HentaiTitle? = null
        TheaterViewModel(
            load = {
                title = (c.hentai.title(id).first { it !is Load.Loading } as? Load.Content)?.value
                title?.let { t ->
                    val ep = t.episodes.firstOrNull { it.number == episode } ?: t.episodes.firstOrNull()
                    val saved = c.library.history(Section.HENTAI).first()
                        .firstOrNull { it.id == id && it.episode == episode && !it.finished }?.positionMs
                    TheaterMedia(
                        overline = res.getString(R.string.hentai_theater_overline, episode, t.subtitles ?: "—").uppercase(),
                        title = t.title,
                        durationMs = ep?.durationMs ?: 0,
                        startMs = saved ?: 0,
                    )
                }
            },
            save = { position, duration, finished ->
                title?.let { c.library.saveEpisodeProgress(it, episode, position, duration, finished) }
            },
            host = Hosts.first(),
        )
    }
    TheaterRoute(vm, code = "H.11", onBack = shell::back, showQuality = false, closeIcon = true, hosts = Hosts)
}
