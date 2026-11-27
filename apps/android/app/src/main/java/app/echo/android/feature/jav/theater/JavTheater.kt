package app.echo.android.feature.jav.theater

import androidx.compose.runtime.Composable
import app.echo.android.feature.shared.theater.TheaterMedia
import app.echo.android.feature.shared.theater.TheaterRoute
import app.echo.android.feature.shared.theater.TheaterViewModel
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Movie
import app.echo.data.model.Section
import app.echo.data.repository.Load
import kotlinx.coroutines.flow.first

/**
 * Figma 3.7 Theater (28:4026): plays from where 3.12 left off (or the start), with the quality menu, and saves the
 * position to the JAV watch history.
 */
@Composable
fun JavTheaterRoute(id: String, fromStart: Boolean, shell: ShellActions) {
    val vm = echoViewModel(key = "theater-$id-$fromStart") { c ->
        var movie: Movie? = null
        TheaterViewModel(
            load = {
                movie = (c.jav.movie(id).first { it !is Load.Loading } as? Load.Content)?.value
                movie?.let { m ->
                    val saved = c.library.history(Section.JAV).first().firstOrNull { it.id == id && !it.finished }?.positionMs
                    TheaterMedia(m.code, m.title, m.durationMin * 60_000L, if (fromStart) 0 else saved ?: 0)
                }
            },
            save = { position, duration, finished -> movie?.let { c.library.saveWatchProgress(it, position, duration, finished) } },
        )
    }
    TheaterRoute(vm, code = "3.7", onBack = shell::back)
}
