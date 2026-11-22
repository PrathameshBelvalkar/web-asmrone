package app.echo.android.feature.asmr.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.echo.data.model.Section
import app.echo.data.repository.AsmrRepository
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.Load
import app.echo.data.repository.PlayerController
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** 1.1 Home: the For you feed, Continue listening (Room) and Trending tracks. */
@OptIn(ExperimentalCoroutinesApi::class)
class AsmrHomeViewModel(
    asmr: AsmrRepository,
    library: LibraryRepository,
    player: PlayerController,
) : ViewModel() {
    private val reload = MutableStateFlow(0)

    val state: StateFlow<AsmrHomeUiState> = combine(
        reload.flatMapLatest { asmr.home(tab = 0) },
        library.continueIn(Section.ASMR),
        player.state.map { it.current?.id }.distinctUntilChanged(),
    ) { home, continueListening, playing ->
        when (home) {
            Load.Loading -> AsmrHomeUiState.Loading
            is Load.Error -> AsmrHomeUiState.Error(home.kind)
            Load.Empty -> AsmrHomeUiState.Content(emptyList(), continueListening, emptyList(), playing)
            is Load.Content -> AsmrHomeUiState.Content(home.value.featured, continueListening, home.value.trending, playing)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AsmrHomeUiState.Loading)

    fun retry() { reload.value++ }
}
