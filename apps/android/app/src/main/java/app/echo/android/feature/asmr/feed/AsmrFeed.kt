package app.echo.android.feature.asmr.feed

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Surface
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.Dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.LoadContent
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.FeedPeriod
import app.echo.data.model.Work
import app.echo.data.repository.AsmrRepository
import app.echo.data.repository.Load
import app.echo.designsystem.component.echo.CoverCard
import app.echo.designsystem.component.m3e.ConnectedButtonGroup
import app.echo.designsystem.component.m3e.ConnectedOption
import app.echo.designsystem.component.m3e.CoverGrid
import app.echo.designsystem.component.m3e.EchoFlexibleAppBar
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

data class AsmrFeedUiState(val tab: Int, val period: FeedPeriod = FeedPeriod.WEEK, val works: Load<List<Work>> = Load.Loading, val total: Int = 0)

@OptIn(ExperimentalCoroutinesApi::class)
class AsmrFeedViewModel(private val tab: Int, asmr: AsmrRepository) : ViewModel() {
    private val period = MutableStateFlow(FeedPeriod.WEEK)
    private val reload = MutableStateFlow(0)

    val state: StateFlow<AsmrFeedUiState> = combine(period, reload) { p, _ -> p }
        .flatMapLatest { p -> asmr.feed(tab, p).map { works -> AsmrFeedUiState(tab, p, works, FakeCatalog.TOTAL_WORKS) } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AsmrFeedUiState(tab))

    fun setPeriod(p: FeedPeriod) { period.value = p }
    fun retry() { reload.value++ }
}

@Composable
fun AsmrFeedRoute(tab: Int, shell: ShellActions, sourceName: String, contentPadding: PaddingValues) {
    val vm = echoViewModel(key = "feed:$tab") { AsmrFeedViewModel(tab, it.asmr) }
    val state by vm.state.collectAsStateWithLifecycle()
    AsmrFeedScreen(
        state = state, sourceName = sourceName, contentPadding = contentPadding,
        onBack = shell::back, onSearch = { shell.open(Route.AsmrSearch) },
        onPeriod = vm::setPeriod, onWork = { shell.open(Route.Work(it)) }, onRetry = vm::retry,
    )
}

/** Figma 1.4 Feed (35:404): Popular / New / Recommended with a time range and a 2-column grid. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AsmrFeedScreen(
    state: AsmrFeedUiState,
    sourceName: String,
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onSearch: () -> Unit,
    onPeriod: (FeedPeriod) -> Unit,
    onWork: (String) -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    val title = stringResource(
        when (state.tab) {
            2 -> R.string.asmr_tab_new
            3 -> R.string.asmr_tab_recommended
            else -> R.string.asmr_tab_popular
        },
    )
    Column(modifier.fillMaxSize().nestedScroll(scroll.nestedScrollConnection).testTag("screen:1.4")) {
        EchoFlexibleAppBar(
            title = title,
            subtitle = stringResource(R.string.asmr_feed_subtitle, sourceName, state.total),
            onBack = onBack,
            scrollBehavior = scroll,
        ) { EchoIconButton(EchoIcons.Search, stringResource(R.string.nav_search), onSearch) }
        ConnectedButtonGroup(
            options = listOf(R.string.feed_today, R.string.feed_week, R.string.feed_month, R.string.feed_all).map { ConnectedOption(stringResource(it)) },
            selected = state.period.ordinal,
            onSelect = { onPeriod(FeedPeriod.entries[it]) },
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin, vertical = EchoSpacing.s),
        )
        LoadContent(state.works, onRetry, contentPadding = contentPadding) { works ->
            CoverGrid(
                columns = 2,
                contentPadding = PaddingValues(
                    start = EchoSpacing.screenMargin, end = EchoSpacing.screenMargin, top = EchoSpacing.m,
                    bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l,
                ),
            ) {
                items(works, key = { it.id }) { w -> CoverCard(w.title, w.circle, w.coverUrl, { onWork(w.id) }, width = Dp.Unspecified) }
            }
        }
    }
}

@EchoScreenPreviews
@Composable
private fun AsmrFeedScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        AsmrFeedScreen(
            AsmrFeedUiState(1, FeedPeriod.WEEK, Load.Content(FakeCatalog.works), FakeCatalog.TOTAL_WORKS), "asmr.one",
            PaddingValues(), {}, {}, {}, {}, {},
        )
    }
}
