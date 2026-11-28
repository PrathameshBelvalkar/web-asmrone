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

/**
 * Figma H.11 Theater (28:6140): like 3.7, with ✕ and "EPISODE 1 · SUB EN". Streams come from hentaibros only, so
 * there's no host choice; the quality menu lists the stream's qualities. Resumes the episode where H.9 left it, and
 * saves to the Hentai watch history.
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
                        videoUrl = ep?.videoUrl,
                    )
                }
            },
            save = { position, duration, finished ->
                title?.let { c.library.saveEpisodeProgress(it, episode, position, duration, finished) }
            },
            newPlayer = c::newVideoPlayer,
        )
    }
    TheaterRoute(vm, code = "H.11", onBack = shell::back, closeIcon = true)
}
