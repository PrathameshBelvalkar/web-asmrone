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
import app.echo.data.fake.FakeUpdates
import app.echo.data.model.Section
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
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

/** P.1 chips: playlists, liked tracks and hours listened. */
data class ProfileStats(val playlists: Int = 0, val liked: Int = 0, val listenedHours: Int = 0)

/** The update sheet over the shell: S.14 offers the update, S.15 downloads it. */
enum class UpdateStep { OFFER, DOWNLOADING }

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

    /** O.9 is shown once: finished, skipped or dismissed. */
    fun finishTour() = viewModelScope.launch { container.profile.update { copy(firstRunTipShown = true) } }

    /** Placeholders' "Play": queue the sample work so the mini player and full player can be checked. */
    fun playSample() {
        val work = FakeCatalog.works.first()
        container.player.play(work.tracks, startIndex = 1, playingFrom = work.title)
    }

    val player get() = container.player

    val stats: StateFlow<ProfileStats> = combine(
        container.playlists.playlists,
        container.playlists.liked,
        container.library.history(Section.ASMR),
    ) { playlists, liked, history ->
        ProfileStats(playlists.size, liked.size, (history.sumOf { it.positionMs } / HOUR_MS).toInt())
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ProfileStats())

    private val _update = MutableStateFlow<UpdateStep?>(null)
    val update: StateFlow<UpdateStep?> = _update
    private val _updateProgress = MutableStateFlow(0f)
    val updateProgress: StateFlow<Float> = _updateProgress
    private var download: Job? = null

    init {
        // S.13 "Check for updates automatically": once per launch, after onboarding, unless Later skipped it.
        viewModelScope.launch {
            delay(UPDATE_CHECK_DELAY_MS)
            val release = FakeUpdates.available ?: return@launch
            val updates = container.settings.settings.first().updates
            val profile = container.profile.profile.first()
            if (profile.onboardingDone && updates.autoCheck && updates.skippedVersion != release.version && _update.value == null) {
                _update.value = UpdateStep.OFFER
            }
        }
    }

    /** A check asked for by hand (S.13): offers the update even if Later skipped it before. */
    fun checkForUpdates() {
        if (FakeUpdates.available != null && _update.value == null) _update.value = UpdateStep.OFFER
    }

    /** S.14 Later: don't offer this version again. */
    fun skipUpdate() {
        val version = FakeUpdates.available?.version
        viewModelScope.launch { container.settings.updateUpdates { copy(skippedVersion = version) } }
        _update.value = null
    }

    /** S.14 Update now / S.13 Update now → S.15. A fake download: 18.4 MB in about 20 s. */
    fun startUpdate() {
        download?.cancel()
        _updateProgress.value = 0f
        _update.value = UpdateStep.DOWNLOADING
        download = viewModelScope.launch {
            while (_updateProgress.value < 1f) {
                delay(DOWNLOAD_TICK_MS)
                _updateProgress.value = (_updateProgress.value + DOWNLOAD_TICK_MS / DOWNLOAD_MS.toFloat()).coerceAtMost(1f)
            }
        }
    }

    /** Swiped away: hidden until the next launch, not skipped. */
    fun hideUpdate() { _update.value = null }

    fun cancelUpdate() {
        download?.cancel()
        _update.value = null
    }

    /** Install hands the APK to Android once the real GitHub check exists; for now it closes the sheet. */
    fun installUpdate() { _update.value = null }

    /** S.7: every table and both DataStores, then [onDone] (the shell restarts at O.1). */
    fun clearAllData(onDone: () -> Unit) = viewModelScope.launch {
        container.clearAllData()
        onDone()
    }

    /** S.12 Reset profile: name, avatar and age, then onboarding again. */
    fun resetProfile(onDone: () -> Unit) = viewModelScope.launch {
        container.profile.clear()
        onDone()
    }

    private companion object {
        const val HOUR_MS = 3_600_000L
        const val UPDATE_CHECK_DELAY_MS = 1_500L
        const val DOWNLOAD_TICK_MS = 250L
        const val DOWNLOAD_MS = 20_000L
    }
}
