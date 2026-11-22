package app.echo.android.feature.asmr.home

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Source

/** 1.1 Home: the only file that knows navigation (design.md §5.5). */
@Composable
fun AsmrHomeRoute(shell: ShellActions, source: Source, contentPadding: PaddingValues) {
    val vm = echoViewModel { AsmrHomeViewModel(it.asmr, it.library, it.player) }
    val state by vm.state.collectAsStateWithLifecycle()
    val trendingTitle = stringResource(R.string.asmr_home_trending)
    AsmrHomeScreen(
        state = state,
        source = source.name,
        sectionIcon = shell.sectionIcon(source.section),
        profileInitial = shell.profileInitial,
        contentPadding = contentPadding,
        onSearch = { shell.open(Route.AsmrSearch) },
        onSwitchSource = shell::openSourceSwitcher,
        onProfile = shell::openProfile,
        onEvent = { event ->
            when (event) {
                is AsmrHomeEvent.OpenTab -> shell.open(Route.AsmrFeed(event.tab))
                is AsmrHomeEvent.OpenWork -> shell.open(Route.Work(event.id))
                AsmrHomeEvent.OpenFeed -> shell.open(Route.AsmrFeed(1))
                is AsmrHomeEvent.PlayTrending -> (state as? AsmrHomeUiState.Content)?.let {
                    shell.play(it.trending, event.index, trendingTitle)
                }
                AsmrHomeEvent.Retry -> vm.retry()
            }
        },
    )
}
