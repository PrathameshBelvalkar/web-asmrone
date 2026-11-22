package app.echo.data.repository

import app.echo.data.model.Track
import kotlinx.coroutines.flow.StateFlow

/** Where the queue came from: the 1.8 overline ("PLAYING FROM WORK"). */
enum class PlaySource { WORK, PLAYLIST, ARTIST, SEARCH, TRENDING, LIKED }

/** What is playing (mini player, 1.8–1.11). */
data class PlayerState(
    val queue: List<Track> = emptyList(),
    val index: Int = -1,
    val isPlaying: Boolean = false,
    val positionMs: Long = 0,
    val speed: Float = 1f,
    val shuffle: Boolean = false,
    val repeat: Boolean = false,
    /** "Playing from work · Whispered bedtime story". */
    val playingFrom: String = "",
    val playSource: PlaySource = PlaySource.WORK,
    /** Sleep timer end, epoch millis, or null. */
    val sleepAt: Long? = null,
    val sleepAtEndOfTrack: Boolean = false,
) {
    val current: Track? get() = queue.getOrNull(index)
    val durationMs: Long get() = current?.durationMs ?: 0
    val progress: Float get() = if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
    val hasNext: Boolean get() = index < queue.lastIndex || repeat
}

/** Playback, independent of how it is done (fake now, Media3 later). */
interface PlayerController {
    val state: StateFlow<PlayerState>

    fun play(queue: List<Track>, startIndex: Int = 0, playingFrom: String = "", source: PlaySource = PlaySource.WORK)
    fun playPause()
    fun seekTo(positionMs: Long)
    fun seekToFraction(fraction: Float) = seekTo((state.value.durationMs * fraction).toLong())
    fun next()
    fun previous()
    fun skipTo(index: Int)
    fun move(from: Int, to: Int)
    fun remove(index: Int)
    fun setSpeed(speed: Float)
    fun toggleShuffle()
    fun toggleRepeat()
    /** Minutes from now, or null to cancel. */
    fun setSleepTimer(minutes: Int?)
    /** Stop when the current track ends (1.11 "End of track"). */
    fun sleepAtEndOfTrack()
    /** Empty the queue but keep the current track (1.9 Clear). */
    fun clearUpNext()
    fun stop()
}
