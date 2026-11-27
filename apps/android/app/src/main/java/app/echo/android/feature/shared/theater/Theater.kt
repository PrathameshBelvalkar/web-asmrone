package app.echo.android.feature.shared.theater

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
import androidx.compose.material3.OutlinedButton
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
import app.echo.designsystem.component.echo.ReaderTheme
import app.echo.designsystem.component.m3e.EchoSlider
import app.echo.designsystem.icon.EchoIcons
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/** What the theater plays: the line over the title ("ABC-101", "EPISODE 1 · SUB EN"), the title, its length and where to start. */
data class TheaterMedia(val overline: String, val title: String, val durationMs: Long, val startMs: Long = 0)

/** A fake playhead (design phase: no video yet, a black surface with a moving position). */
data class TheaterState(
    val media: TheaterMedia? = null,
    val positionMs: Long = 0,
    val playing: Boolean = false,
    val speed: Float = 1f,
    val quality: String = QUALITY_AUTO,
    /** H.11 stream host; null where there's no choice. */
    val host: String? = null,
) {
    val durationMs: Long get() = media?.durationMs ?: 0
}

const val QUALITY_AUTO = "Auto"
private val Qualities = listOf(QUALITY_AUTO, "1080p", "720p", "480p")
private val Speeds = listOf(1f, 1.25f, 1.5f, 2f)
private const val SKIP_MS = 10_000L
private const val TICK_MS = 250L
private const val HIDE_CONTROLS_MS = 3_000L

/**
 * Plays [load]'s media from its start, and calls [save] with the position whenever it pauses, closes or ends.
 * 3.7 and H.11 differ only in what they load and where they save.
 */
class TheaterViewModel(
    private val load: suspend () -> TheaterMedia?,
    private val save: suspend (positionMs: Long, durationMs: Long, finished: Boolean) -> Unit,
    host: String? = null,
) : ViewModel() {
    private val _state = MutableStateFlow(TheaterState(host = host))
    val state: StateFlow<TheaterState> = _state
    private var ticker: Job? = null

    init {
        viewModelScope.launch {
            val media = load() ?: return@launch
            _state.value = _state.value.copy(media = media, positionMs = media.startMs.coerceIn(0, media.durationMs))
            play()
        }
    }

    fun togglePlay() = if (_state.value.playing) pause() else play()

    private fun play() {
        if (_state.value.media == null) return
        _state.value = _state.value.copy(playing = true)
        ticker?.cancel()
        ticker = viewModelScope.launch {
            while (true) {
                delay(TICK_MS)
                val s = _state.value
                val next = s.positionMs + (TICK_MS * s.speed).toLong()
                if (next >= s.durationMs) {
                    _state.value = s.copy(positionMs = s.durationMs, playing = false)
                    persist(finished = true)
                    break
                }
                _state.value = s.copy(positionMs = next)
            }
        }
    }

    fun pause() {
        ticker?.cancel()
        _state.value = _state.value.copy(playing = false)
        persist()
    }

    fun seekTo(ms: Long) { _state.value = _state.value.copy(positionMs = ms.coerceIn(0, _state.value.durationMs)) }
    fun skip(deltaMs: Long) = seekTo(_state.value.positionMs + deltaMs)
    fun nextSpeed() { _state.value = _state.value.copy(speed = Speeds[(Speeds.indexOf(_state.value.speed) + 1) % Speeds.size]) }
    fun setQuality(value: String) { _state.value = _state.value.copy(quality = value) }
    fun setHost(value: String) { _state.value = _state.value.copy(host = value) }

    private fun persist(finished: Boolean = false) {
        val s = _state.value
        if (s.media == null) return
        viewModelScope.launch { save(s.positionMs, s.durationMs, finished) }
    }

    override fun onCleared() {
        // The pause when the screen closes has already saved the position.
        ticker?.cancel()
    }
}

/**
 * The theater around [vm]: turns the screen to landscape while open and saves the position when it closes.
 * [hosts] adds H.11's Source menu; [showQuality] the 3.7 quality menu; [closeIcon] H.11's ✕ instead of ←.
 */
@Composable
fun TheaterRoute(
    vm: TheaterViewModel,
    code: String,
    onBack: () -> Unit,
    showQuality: Boolean = true,
    closeIcon: Boolean = false,
    hosts: List<String> = emptyList(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val activity = LocalContext.current.findActivity()
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
        code = code,
        onBack = onBack,
        onTogglePlay = vm::togglePlay,
        onSeek = vm::seekTo,
        onSkip = vm::skip,
        onSpeed = vm::nextSpeed,
        onQuality = if (showQuality) vm::setQuality else null,
        hosts = hosts,
        onHost = vm::setHost,
        closeIcon = closeIcon,
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
 * Figma 3.7 / H.11 Theater: black, landscape. Tap to show or hide the controls; they hide after 3 s of playing.
 * Top: back (or close), the overline and title, Source (H.11), speed, picture-in-picture, quality (3.7).
 * Centre: back 10 · play/pause · forward 10. Bottom: position, seek bar, duration, fullscreen.
 */
@Composable
fun TheaterScreen(
    state: TheaterState,
    code: String,
    onBack: () -> Unit,
    onTogglePlay: () -> Unit,
    onSeek: (Long) -> Unit,
    onSkip: (Long) -> Unit,
    onSpeed: () -> Unit,
    onQuality: ((String) -> Unit)?,
    onPip: () -> Unit,
    hosts: List<String> = emptyList(),
    onHost: (String) -> Unit = {},
    closeIcon: Boolean = false,
) = ReaderTheme {
    var controls by rememberSaveable { mutableStateOf(true) }
    var menu by remember { mutableStateOf(false) }
    LaunchedEffect(controls, state.playing, menu, state.speed) {
        if (controls && state.playing && !menu) {
            delay(HIDE_CONTROLS_MS)
            controls = false
        }
    }
    Box(
        Modifier.fillMaxSize().background(Color.Black).testTag("screen:$code")
            .clickable(
                interactionSource = remember { MutableInteractionSource() }, indication = null,
                onClickLabel = stringResource(if (controls) R.string.a11y_hide_controls else R.string.a11y_show_controls),
            ) { controls = !controls },
    ) {
        AnimatedVisibility(controls, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f)).safeDrawingPadding().padding(horizontal = 24.dp, vertical = 12.dp)) {
                Row(Modifier.fillMaxWidth().align(Alignment.TopCenter), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    WhiteIcon(
                        if (closeIcon) EchoIcons.Close else EchoIcons.ArrowBack,
                        stringResource(app.echo.designsystem.R.string.echo_cd_back), onBack,
                    )
                    Column(Modifier.weight(1f).padding(start = 4.dp)) {
                        Text(state.media?.overline.orEmpty(), style = MaterialTheme.typography.labelMediumEmphasized, color = Color.White.copy(alpha = 0.7f))
                        Text(state.media?.title.orEmpty(), style = MaterialTheme.typography.titleMedium, color = Color.White, maxLines = 1)
                    }
                    if (hosts.isNotEmpty()) HostMenu(state.host, hosts, onHost, menu) { menu = it }
                    if (state.speed != 1f) Text("${state.speed}×", style = MaterialTheme.typography.labelLarge, color = Color.White)
                    WhiteIcon(EchoIcons.Speed, stringResource(R.string.jav_speed), onSpeed)
                    WhiteIcon(EchoIcons.PictureInPicture, stringResource(R.string.jav_pip), onPip)
                    if (onQuality != null) QualityMenu(state.quality, onQuality, menu) { menu = it }
                }
                CentreControls(state.playing, onTogglePlay, onSkip, Modifier.align(Alignment.Center))
                SeekRow(state, onSeek, onBack, Modifier.align(Alignment.BottomCenter))
            }
        }
    }
}

@Composable
private fun QualityMenu(quality: String, onQuality: (String) -> Unit, open: Boolean, onOpen: (Boolean) -> Unit) {
    Box {
        FilledTonalIconButton(onClick = { onOpen(true) }) {
            Icon(painterResource(EchoIcons.Settings), stringResource(R.string.jav_quality))
        }
        DropdownMenu(expanded = open, onDismissRequest = { onOpen(false) }) {
            Qualities.forEach { q ->
                DropdownMenuItem(
                    text = { Text(if (q == QUALITY_AUTO) stringResource(R.string.jav_quality_auto) else q) },
                    onClick = { onQuality(q); onOpen(false) },
                    leadingIcon = { if (q == quality) Icon(painterResource(EchoIcons.Check), null) },
                )
            }
        }
    }
}

/** H.11 "Source" (Outlined, S): picks the stream host. */
@Composable
private fun HostMenu(host: String?, hosts: List<String>, onHost: (String) -> Unit, open: Boolean, onOpen: (Boolean) -> Unit) {
    Box {
        OutlinedButton(onClick = { onOpen(true) }) {
            Icon(painterResource(EchoIcons.OpenInNew), null, Modifier.size(18.dp), tint = Color.White)
            Text(stringResource(R.string.hentai_source), color = Color.White, modifier = Modifier.padding(start = 8.dp))
        }
        DropdownMenu(expanded = open, onDismissRequest = { onOpen(false) }) {
            hosts.forEach { h ->
                DropdownMenuItem(
                    text = { Text(h) },
                    onClick = { onHost(h); onOpen(false) },
                    leadingIcon = { if (h == host) Icon(painterResource(EchoIcons.Check), null) },
                )
            }
        }
    }
}

/** Back 10 · play/pause (tonal, wide, square: 112 × 80) · forward 10. */
@Composable
private fun CentreControls(playing: Boolean, onTogglePlay: () -> Unit, onSkip: (Long) -> Unit, modifier: Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        WhiteIcon(EchoIcons.FastRewindFilled, stringResource(R.string.jav_replay_10), { onSkip(-SKIP_MS) }, size = 56)
        FilledTonalIconButton(onClick = onTogglePlay, shape = MaterialTheme.shapes.extraLarge, modifier = Modifier.size(112.dp, 80.dp)) {
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
