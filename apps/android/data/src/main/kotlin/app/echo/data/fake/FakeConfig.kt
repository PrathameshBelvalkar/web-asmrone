package app.echo.data.fake

import app.echo.data.repository.ErrorKind
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** What every fake call returns instead of content (S.11 debug menu, design.md §9.4). */
sealed interface ForcedState {
    data object None : ForcedState
    data object Loading : ForcedState
    data object Empty : ForcedState
    data class Error(val kind: ErrorKind) : ForcedState
}

/** Shared settings of the fake repositories: latency and a forced state, changeable at runtime. */
class FakeConfig(latencyMs: Long = 300, forced: ForcedState = ForcedState.None) {
    private val _latencyMs = MutableStateFlow(latencyMs)
    private val _forced = MutableStateFlow(forced)
    val latencyMs: StateFlow<Long> = _latencyMs
    val forced: StateFlow<ForcedState> = _forced

    fun setLatency(ms: Long) { _latencyMs.value = ms }
    fun force(state: ForcedState) { _forced.value = state }
}
