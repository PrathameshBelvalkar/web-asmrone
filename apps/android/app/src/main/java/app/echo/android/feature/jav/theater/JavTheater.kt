package app.echo.android.feature.jav.theater

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ActivityInfo
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.feature.jav.clock
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Movie
import app.echo.data.model.Section
import app.echo.data.repository.JavRepository
import app.echo.data.repository.LibraryRepository
import app.echo.data.repository.Load
import app.echo.designsystem.component.m3e.EchoSlider
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.component.echo.ReaderTheme
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/** 3.7: the movie and a fake playhead (design phase: no video yet, a black surface with a moving position). */
data class TheaterState(
    val movie: Movie? = null,
    val positionMs: Long = 0,
    val playing: Boolean = false,
    val speed: Float = 1f,
    val quality: String = QUALITY_AUTO,
) {
    val durationMs: Long get() = (movie?.durationMin ?: 0) * 60_000L
}

const val QUALITY_AUTO = "Auto"
private val Qualities = listOf(QUALITY_AUTO, "1080p", "720p", "480p")
private val Speeds = listOf(1f, 1.25f, 1.5f, 2f)
private const val SKIP_MS = 10_000L
private const val TICK_MS = 250L
private const val HIDE_CONTROLS_MS = 3_000L

/** Plays from where 3.12 left off (or the start), and writes the position back whenever it pauses or closes. */
class TheaterViewModel(
    private val id: String,
    private val fromStart: Boolean,
    private val jav: JavRepository,
    private val library: LibraryRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(TheaterState())
    val state: StateFlow<TheaterState> = _state
    private var ticker: Job? = null

    init {
        viewModelScope.launch {
            val movie = jav.movie(id).first { it !is Load.Loading }.let { (it as? Load.Content)?.value } ?: return@launch
            val saved = library.history(Section.JAV).first().firstOrNull { it.id == id && !it.finished }?.positionMs
            _state.value = _state.value.copy(movie = movie, positionMs = if (fromStart) 0 else saved ?: 0)
            play()
        }
    }

    fun togglePlay() = if (_state.value.playing) pause() else play()

    private fun play() {
        if (_state.value.movie == null) return
        _state.value = _state.value.copy(playing = true)
        ticker?.cancel()
        ticker = viewModelScope.launch {
            while (true) {
                delay(TICK_MS)
                val s = _state.value
                val next = s.positionMs + (TICK_MS * s.speed).toLong()
                if (next >= s.durationMs) {
                    _state.value = s.copy(positionMs = s.durationMs, playing = false)
                    save(finished = true)
                    break
                }
                _state.value = s.copy(positionMs = next)
            }
        }
    }

    fun pause() {
        ticker?.cancel()
        _state.value = _state.value.copy(playing = false)
        save()
    }

    fun seekTo(ms: Long) { _state.value = _state.value.copy(positionMs = ms.coerceIn(0, _state.value.durationMs)) }
    fun skip(deltaMs: Long) = seekTo(_state.value.positionMs + deltaMs)
    fun nextSpeed() { _state.value = _state.value.copy(speed = Speeds[(Speeds.indexOf(_state.value.speed) + 1) % Speeds.size]) }
    fun setQuality(value: String) { _state.value = _state.value.copy(quality = value) }

    fun save(finished: Boolean = false) {
        val s = _state.value
        val movie = s.movie ?: return
        viewModelScope.launch { library.saveWatchProgress(movie, s.positionMs, s.durationMs, finished) }
    }

    override fun onCleared() {
        // The pause when the screen closes has already saved the position.
        ticker?.cancel()
    }
}

@Composable
fun JavTheaterRoute(id: String, fromStart: Boolean, shell: ShellActions) {
    val vm = echoViewModel(key = "theater-$id-$fromStart") { TheaterViewModel(id, fromStart, it.jav, it.library) }
    val state by vm.state.collectAsStateWithLifecycle()
    val activity = LocalContext.current.findActivity()
    // Figma 3.7 is landscape: turn the screen while the theater is open, and save the position when it closes.
    DisposableEffect(Unit) {
        val before = activity?.requestedOrientation
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        onDispose {
            vm.pause()
            if (before != null) activity.requestedOrientation = before
        }
    }
    TheaterScreen(
        state = state,
        onBack = shell::back,
        onTogglePlay = vm::togglePlay,
        onSeek = { vm.seekTo(it) },
        onSkip = vm::skip,
        onSpeed = vm::nextSpeed,
        onQuality = vm::setQuality,
        onPip = {
            if (activity != null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                runCatching { activity.enterPictureInPictureMode(android.app.PictureInPictureParams.Builder().build()) }
            }
        },
    )
}

private fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/**
 * Figma 3.7 Theater (28:4026): black, landscape. Tap to show or hide the controls; they hide after 3 s of playing.
 * Top: back, code and title, speed, picture-in-picture, quality. Centre: back 10 · play/pause · forward 10.
 * Bottom: position, seek bar, duration, fullscreen.
 */
@Composable
fun TheaterScreen(
    state: TheaterState,
    onBack: () -> Unit,
    onTogglePlay: () -> Unit,
    onSeek: (Long) -> Unit,
    onSkip: (Long) -> Unit,
    onSpeed: () -> Unit,
    onQuality: (String) -> Unit,
    onPip: () -> Unit,
) = ReaderTheme {
    var controls by rememberSaveable { mutableStateOf(true) }
    var qualityMenu by remember { mutableStateOf(false) }
    // Auto-hide while playing; any change of state (play, seek, menu) restarts the countdown.
    LaunchedEffect(controls, state.playing, qualityMenu, state.speed) {
        if (controls && state.playing && !qualityMenu) {
            delay(HIDE_CONTROLS_MS)
            controls = false
        }
    }
    Box(
        Modifier.fillMaxSize().background(Color.Black).testTag("screen:3.7")
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { controls = !controls },
    ) {
        AnimatedVisibility(controls, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f)).safeDrawingPadding().padding(horizontal = 24.dp, vertical = 12.dp)) {
                TopBar(state, onBack, onSpeed, onPip, qualityMenu, { qualityMenu = it }, onQuality, Modifier.align(Alignment.TopCenter))
                CentreControls(state.playing, onTogglePlay, onSkip, Modifier.align(Alignment.Center))
                SeekRow(state, onSeek, onBack, Modifier.align(Alignment.BottomCenter))
            }
        }
    }
}

@Composable
private fun TopBar(
    state: TheaterState,
    onBack: () -> Unit,
    onSpeed: () -> Unit,
    onPip: () -> Unit,
    qualityMenu: Boolean,
    onQualityMenu: (Boolean) -> Unit,
    onQuality: (String) -> Unit,
    modifier: Modifier,
) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        WhiteIcon(EchoIcons.ArrowBack, stringResource(app.echo.designsystem.R.string.echo_cd_back), onBack)
        Column(Modifier.weight(1f).padding(start = 4.dp)) {
            Text(state.movie?.code.orEmpty(), style = MaterialTheme.typography.labelMediumEmphasized, color = Color.White.copy(alpha = 0.7f))
            Text(state.movie?.title.orEmpty(), style = MaterialTheme.typography.titleMedium, color = Color.White, maxLines = 1)
        }
        if (state.speed != 1f) Text("${state.speed}×", style = MaterialTheme.typography.labelLarge, color = Color.White)
        WhiteIcon(EchoIcons.Speed, stringResource(R.string.jav_speed), onSpeed)
        WhiteIcon(EchoIcons.PictureInPicture, stringResource(R.string.jav_pip), onPip)
        Box {
            FilledTonalIconButton(onClick = { onQualityMenu(true) }) {
                Icon(painterResource(EchoIcons.Settings), stringResource(R.string.jav_quality))
            }
            DropdownMenu(expanded = qualityMenu, onDismissRequest = { onQualityMenu(false) }) {
                Qualities.forEach { q ->
                    DropdownMenuItem(
                        text = { Text(if (q == QUALITY_AUTO) stringResource(R.string.jav_quality_auto) else q) },
                        onClick = { onQuality(q); onQualityMenu(false) },
                        leadingIcon = { if (q == state.quality) Icon(painterResource(EchoIcons.Check), null) },
                    )
                }
            }
        }
    }
}

/** Back 10 · play/pause (tonal, wide, square: 112 × 80) · forward 10. */
@Composable
private fun CentreControls(playing: Boolean, onTogglePlay: () -> Unit, onSkip: (Long) -> Unit, modifier: Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        WhiteIcon(EchoIcons.FastRewindFilled, stringResource(R.string.jav_replay_10), { onSkip(-SKIP_MS) }, size = 56)
        FilledTonalIconButton(
            onClick = onTogglePlay,
            shape = MaterialTheme.shapes.extraLarge,
            modifier = Modifier.size(112.dp, 80.dp),
        ) {
            Icon(
                painterResource(if (playing) EchoIcons.PauseFilled else EchoIcons.PlayArrowFilled),
                stringResource(if (playing) R.string.jav_pause else R.string.jav_play),
                Modifier.size(32.dp),
            )
        }
        WhiteIcon(EchoIcons.FastForwardFilled, stringResource(R.string.jav_forward_10), { onSkip(SKIP_MS) }, size = 56)
    }
}

/** "42:07 ━━━━━━━━━━ 2:00:00 ⛶". Fullscreen leaves the theater (the page is the non-fullscreen view). */
@Composable
private fun SeekRow(state: TheaterState, onSeek: (Long) -> Unit, onExit: () -> Unit, modifier: Modifier) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(clock(state.positionMs), style = MaterialTheme.typography.labelMedium, color = Color.White)
        EchoSlider(
            value = state.positionMs.toFloat(),
            onValueChange = { onSeek(it.toLong()) },
            valueRange = 0f..state.durationMs.coerceAtLeast(1).toFloat(),
            modifier = Modifier.weight(1f),
        )
        Text(clock(state.durationMs), style = MaterialTheme.typography.labelMedium, color = Color.White)
        WhiteIcon(EchoIcons.Fullscreen, stringResource(R.string.jav_fullscreen), onExit)
    }
}

@Composable
private fun WhiteIcon(icon: Int, description: String, onClick: () -> Unit, size: Int = 48) {
    IconButton(onClick = onClick, modifier = Modifier.size(size.dp)) {
        Icon(painterResource(icon), description, tint = Color.White)
    }
}
