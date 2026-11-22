package app.echo.android.shell

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.echo.android.AppContainer
import app.echo.android.navigation.Route
import app.echo.android.navigation.SectionNav
import app.echo.data.fake.FakeCatalog
import app.echo.data.model.Profile
import app.echo.data.model.Source
import app.echo.data.repository.PlayerState
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Everything the shell draws around the screens. */
data class ShellState(
    val source: Source,
    val profile: Profile,
    val visibleSources: List<Source>,
    val player: PlayerState,
)

/** Active section / source, the profile, and the player, for the app scaffold (design.md §5.4 `ShellViewModel`). */
class ShellViewModel(private val container: AppContainer) : ViewModel() {

    val state: StateFlow<ShellState?> = combine(
        container.settings.settings,
        container.profile.profile,
        container.player.state,
    ) { settings, profile, player ->
        ShellState(
            source = SectionNav.activeSource(settings.lastSourceId, profile),
            profile = profile,
            visibleSources = profile.visibleSources(),
            player = player,
        )
    }.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    /** The first screen, decided once from stored data (onboarding or the last section's Home). */
    suspend fun startRoute(): Route {
        val settings = container.settings.settings.first()
        val profile = container.profile.profile.first()
        return SectionNav.start(profile, settings.lastSourceId)
    }

    fun selectSource(source: Source) = viewModelScope.launch { container.settings.setLastSource(source.id) }

    fun finishOnboarding() = viewModelScope.launch { container.profile.update { copy(onboardingDone = true) } }

    /** Placeholders' "Play": queue the sample work so the mini player and full player can be checked. */
    fun playSample() {
        val work = FakeCatalog.works.first()
        container.player.play(work.tracks, startIndex = 1, playingFrom = work.title)
    }

    val player get() = container.player

    /** S.12 controls, until Phase 10 builds the Profile screen. */
    fun updateProfile(change: Profile.() -> Profile) = viewModelScope.launch { container.profile.update(change) }

    /** S.8 controls, until Phase 10 builds the Look and feel screen. */
    val theme = container.settings.theme
    fun updateTheme(change: app.echo.data.model.ThemeSettings.() -> app.echo.data.model.ThemeSettings) =
        viewModelScope.launch { container.settings.updateTheme(change) }
}
