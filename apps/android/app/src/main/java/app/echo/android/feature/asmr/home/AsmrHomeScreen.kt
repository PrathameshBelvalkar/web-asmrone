package app.echo.android.feature.asmr.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.PreviewParameter
import app.echo.android.R
import app.echo.android.ui.ErrorState
import app.echo.android.ui.LoadingState
import app.echo.android.ui.formatTimeLeft
import app.echo.android.ui.formatDuration
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.ContinueItem
import app.echo.data.model.Section
import app.echo.designsystem.component.echo.ContinueCard
import app.echo.designsystem.component.echo.ShelfHeader
import app.echo.designsystem.component.echo.TrackRow
import app.echo.designsystem.component.m3e.CoverCarousel
import app.echo.designsystem.component.m3e.CoverRow
import app.echo.designsystem.component.m3e.EchoSearchAppBar
import app.echo.designsystem.component.m3e.HeroCarouselItem
import app.echo.designsystem.component.m3e.SectionTabs
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.tokens.EchoSpacing

/**
 * Figma 1.1 Home (35:2): search app bar, For you · Popular · New · Recommended tabs (the others open 1.4), the
 * multi-browse carousel, Continue listening, and Trending tracks.
 */
@Composable
fun AsmrHomeScreen(
    state: AsmrHomeUiState,
    source: String,
    sectionIcon: Int,
    profileInitial: String,
    contentPadding: PaddingValues,
    onSearch: () -> Unit,
    onSwitchSource: () -> Unit,
    onProfile: () -> Unit,
    onEvent: (AsmrHomeEvent) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxSize().testTag("screen:1.1")) {
        EchoSearchAppBar(
            source = source, sectionIcon = sectionIcon, profileInitial = profileInitial,
            onSearch = onSearch, onSwitchSource = onSwitchSource, onProfile = onProfile,
        )
        SectionTabs(
            tabs = listOf(
                stringResource(R.string.asmr_tab_for_you), stringResource(R.string.asmr_tab_popular),
                stringResource(R.string.asmr_tab_new), stringResource(R.string.asmr_tab_recommended),
            ),
            selected = 0,
            onSelect = { if (it != 0) onEvent(AsmrHomeEvent.OpenTab(it)) },
        )
        when (state) {
            AsmrHomeUiState.Loading -> LoadingState(Modifier.padding(contentPadding))
            is AsmrHomeUiState.Error -> Column(Modifier.fillMaxSize().padding(contentPadding)) {
                ErrorState(state.kind, onRetry = { onEvent(AsmrHomeEvent.Retry) }, Modifier.padding(top = EchoSpacing.xxxl))
            }
            is AsmrHomeUiState.Content -> HomeContent(state, contentPadding, onEvent)
        }
    }
}

@Composable
private fun HomeContent(state: AsmrHomeUiState.Content, contentPadding: PaddingValues, onEvent: (AsmrHomeEvent) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(top = EchoSpacing.m, bottom = contentPadding.calculateBottomPadding() + EchoSpacing.l)) {
        if (state.featured.isNotEmpty()) {
            item(key = "featured") {
                CoverCarousel(state.featured.size) { i ->
                    val work = state.featured[i]
                    HeroCarouselItem(work.title, work.coverUrl, onClick = { onEvent(AsmrHomeEvent.OpenWork(work.id)) })
                }
            }
        }
        if (state.continueListening.isNotEmpty()) {
            item(key = "continue-header") {
                ShelfHeader(stringResource(R.string.asmr_home_continue), onClick = { onEvent(AsmrHomeEvent.OpenFeed) })
            }
            item(key = "continue") {
                CoverRow(state.continueListening.size) { i ->
                    val item: ContinueItem = state.continueListening[i]
                    ContinueCard(
                        title = item.title, meta = formatTimeLeft(item), progress = item.progress, image = item.coverUrl,
                        onClick = { onEvent(AsmrHomeEvent.OpenWork(item.id)) },
                    )
                }
            }
        }
        if (state.trending.isNotEmpty()) {
            item(key = "trending-header") {
                ShelfHeader(stringResource(R.string.asmr_home_trending), onClick = { onEvent(AsmrHomeEvent.OpenFeed) })
            }
            item(key = "trending") {
                SegmentedList {
                    state.trending.forEachIndexed { i, track ->
                        item {
                            TrackRow(
                                title = track.title, artist = track.artist, duration = formatDuration(track.durationMs),
                                cover = track.coverUrl, playing = track.id == state.playingTrackId,
                                onClick = { onEvent(AsmrHomeEvent.PlayTrending(i)) }, onMore = {},
                            )
                        }
                    }
                }
            }
        }
    }
}

internal fun previewHomeState() = AsmrHomeUiState.Content(
    featured = FakeCatalog.works.drop(3).take(4),
    continueListening = listOf(
        ContinueItem(Section.ASMR, "w1", "Whispered bedtime story", positionMs = 18 * 60_000, durationMs = 60 * 60_000, updatedAt = 3, finished = false),
        ContinueItem(Section.ASMR, "w2", "Rain on a tin roof", positionMs = 20 * 60_000, durationMs = 90 * 60_000, updatedAt = 2, finished = false),
        ContinueItem(Section.ASMR, "w3", "Soft tapping", positionMs = 30 * 60_000, durationMs = 38 * 60_000, updatedAt = 1, finished = false),
    ),
    trending = FakeCatalog.works.mapIndexed { i, w -> w.tracks[(i * 2) % w.tracks.size] }.take(4),
    playingTrackId = null,
)

@EchoScreenPreviews
@Composable
private fun AsmrHomeScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface {
        AsmrHomeScreen(
            state = previewHomeState(), source = "asmr.one", sectionIcon = EchoIcons.MusicNote, profileInitial = "P",
            contentPadding = PaddingValues(), onSearch = {}, onSwitchSource = {}, onProfile = {}, onEvent = {},
        )
    }
}
