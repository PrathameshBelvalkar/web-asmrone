package app.echo.data.fake

import app.echo.data.model.Track
import app.echo.data.repository.PlayerController
import app.echo.data.repository.PlaySource
import app.echo.data.repository.PlayerState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * A player that plays nothing: a state machine with a position that ticks every [tickMs] while playing, moves on
 * at the end of a track, and stops when the sleep timer fires. Lets the player UI behave like the real thing.
 */
class FakePlayerController(
    private val scope: CoroutineScope,
    private val tickMs: Long = 250,
    private val now: () -> Long = System::currentTimeMillis,
) : PlayerController {

    private val _state = MutableStateFlow(PlayerState())
    override val state: StateFlow<PlayerState> = _state
    private var ticker: Job? = null

    override fun play(queue: List<Track>, startIndex: Int, playingFrom: String, source: PlaySource) {
        if (queue.isEmpty()) return stop()
        _state.update {
            it.copy(
                queue = queue, index = startIndex.coerceIn(0, queue.lastIndex), positionMs = 0, isPlaying = true,
                playingFrom = playingFrom, playSource = source,
            )
        }
        startTicking()
    }

    override fun playPause() {
        val s = _state.value
        if (s.current == null) return
        _state.value = s.copy(isPlaying = !s.isPlaying)
        if (!s.isPlaying) startTicking() else ticker?.cancel()
    }

    override fun seekTo(positionMs: Long) = _state.update { it.copy(positionMs = positionMs.coerceIn(0, it.durationMs)) }

    override fun next() = _state.update { s ->
        when {
            s.index < s.queue.lastIndex -> s.copy(index = s.index + 1, positionMs = 0)
            s.repeat && s.queue.isNotEmpty() -> s.copy(index = 0, positionMs = 0)
            else -> s.copy(isPlaying = false, positionMs = s.durationMs)
        }
    }

    /** Like every player: restart the track if more than 3 s in, otherwise go to the previous one. */
    override fun previous() = _state.update { s ->
        if (s.positionMs > RESTART_THRESHOLD_MS || s.index <= 0) s.copy(positionMs = 0) else s.copy(index = s.index - 1, positionMs = 0)
    }

    override fun skipTo(index: Int) = _state.update { s ->
        if (index in s.queue.indices) s.copy(index = index, positionMs = 0) else s
    }

    override fun move(from: Int, to: Int) = _state.update { s ->
        if (from !in s.queue.indices || to !in s.queue.indices) return@update s
        val q = s.queue.toMutableList().apply { add(to, removeAt(from)) }
        val current = s.current
        s.copy(queue = q, index = q.indexOf(current))
    }

    override fun remove(index: Int) = _state.update { s ->
        if (index !in s.queue.indices) return@update s
        val q = s.queue.toMutableList().apply { removeAt(index) }
        when {
            q.isEmpty() -> PlayerState()
            index < s.index -> s.copy(queue = q, index = s.index - 1)
            index == s.index -> s.copy(queue = q, index = s.index.coerceAtMost(q.lastIndex), positionMs = 0)
            else -> s.copy(queue = q)
        }
    }

    override fun setSpeed(speed: Float) = _state.update { it.copy(speed = speed.coerceIn(0.5f, 3f)) }
    override fun toggleShuffle() = _state.update { it.copy(shuffle = !it.shuffle) }
    override fun toggleRepeat() = _state.update { it.copy(repeat = !it.repeat) }
    override fun setSleepTimer(minutes: Int?) =
        _state.update { it.copy(sleepAt = minutes?.let { m -> now() + m * 60_000L }, sleepAtEndOfTrack = false) }
    override fun sleepAtEndOfTrack() = _state.update { it.copy(sleepAt = null, sleepAtEndOfTrack = true) }
    override fun clearUpNext() = _state.update { s -> s.current?.let { s.copy(queue = listOf(it), index = 0) } ?: s }

    override fun stop() {
        ticker?.cancel()
        _state.value = PlayerState()
    }

    private fun startTicking() {
        ticker?.cancel()
        ticker = scope.launch {
            while (isActive) {
                delay(tickMs)
                val s = _state.value
                if (!s.isPlaying) break
                if (s.sleepAt != null && now() >= s.sleepAt) {
                    _state.value = s.copy(isPlaying = false, sleepAt = null)
                    break
                }
                val pos = s.positionMs + (tickMs * s.speed).toLong()
                when {
                    pos < s.durationMs -> _state.value = s.copy(positionMs = pos)
                    s.sleepAtEndOfTrack -> { _state.value = s.copy(isPlaying = false, positionMs = s.durationMs, sleepAtEndOfTrack = false); break }
                    else -> next()
                }
            }
        }
    }

    private companion object {
        const val RESTART_THRESHOLD_MS = 3_000L
    }
}
