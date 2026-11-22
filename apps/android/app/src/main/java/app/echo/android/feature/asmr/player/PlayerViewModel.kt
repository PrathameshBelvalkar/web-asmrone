package app.echo.android.feature.asmr.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.echo.data.model.Lyric
import app.echo.data.model.Playlist
import app.echo.data.repository.AsmrRepository
import app.echo.data.repository.PlayerController
import app.echo.data.repository.PlayerState
import app.echo.data.repository.PlaylistRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Everything the player sheet shows (1.8–1.11). */
data class PlayerUiState(
    val player: PlayerState = PlayerState(),
    val liked: Boolean = false,
    val lyrics: List<Lyric> = emptyList(),
    val playlists: List<Playlist> = emptyList(),
) {
    /** The lyric line playing now (1.10), or -1 before the first. */
    val lyricIndex: Int get() = lyrics.indexOfLast { it.timeMs <= player.positionMs }
}

@OptIn(ExperimentalCoroutinesApi::class)
class PlayerViewModel(
    val controller: PlayerController,
    private val playlists: PlaylistRepository,
    asmr: AsmrRepository,
) : ViewModel() {
    private val currentId = controller.state.map { it.current?.id }.distinctUntilChanged()

    val state: StateFlow<PlayerUiState> = combine(
        controller.state,
        currentId.flatMapLatest { id -> if (id == null) flowOf(false) else playlists.isLiked(id) },
        currentId.flatMapLatest { id -> if (id == null) flowOf(emptyList()) else asmr.lyrics(id) },
        playlists.playlists,
    ) { p, liked, lyrics, lists -> PlayerUiState(p, liked, lyrics, lists) }
        .stateIn(viewModelScope, SharingStarted.Eagerly, PlayerUiState())

    fun toggleLike() = viewModelScope.launch {
        val s = state.value
        s.player.current?.let { playlists.setLiked(it, !s.liked) }
    }

    fun addCurrentTo(playlistId: Long) = viewModelScope.launch {
        state.value.player.current?.let { playlists.add(playlistId, it) }
    }

    /** 1.11 SLEEP TIMER: Off, minutes, or end of track. */
    fun setSleep(choice: SleepChoice) = when (choice) {
        SleepChoice.OFF -> controller.setSleepTimer(null)
        SleepChoice.END_OF_TRACK -> controller.sleepAtEndOfTrack()
        else -> controller.setSleepTimer(choice.minutes)
    }
}

enum class SleepChoice(val minutes: Int?) { OFF(null), MIN_15(15), MIN_30(30), HOUR_1(60), END_OF_TRACK(null) }

/** 1.11 PLAYBACK SPEED. */
val PlaybackSpeeds = listOf(0.75f, 1f, 1.25f, 1.5f)
