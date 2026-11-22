package app.echo.android.feature.asmr.home

import app.echo.data.model.ContinueItem
import app.echo.data.model.Track
import app.echo.data.model.Work
import app.echo.data.repository.ErrorKind

/** 1.1 Home. */
sealed interface AsmrHomeUiState {
    data object Loading : AsmrHomeUiState
    data class Error(val kind: ErrorKind) : AsmrHomeUiState
    data class Content(
        val featured: List<Work>,
        val continueListening: List<ContinueItem>,
        val trending: List<Track>,
        /** The track the player is on, shown selected in Trending. */
        val playingTrackId: String?,
    ) : AsmrHomeUiState
}

sealed interface AsmrHomeEvent {
    data class OpenTab(val tab: Int) : AsmrHomeEvent
    data class OpenWork(val id: String) : AsmrHomeEvent
    data object OpenFeed : AsmrHomeEvent
    data class PlayTrending(val index: Int) : AsmrHomeEvent
    data object Retry : AsmrHomeEvent
}
