package app.echo.android.feature.shared.theater

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ActivityInfo
import android.os.Build
import android.util.Rational
import androidx.annotation.OptIn
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
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.app.OnPictureInPictureModeChangedProvider
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.compose.ContentFrame
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.media3.ui.compose.SURFACE_TYPE_TEXTURE_VIEW
import kotlin.math.roundToInt
import app.echo.android.R
import app.echo.android.feature.jav.clock
import app.echo.designsystem.component.echo.ReaderTheme
import app.echo.designsystem.component.m3e.EchoSlider
import app.echo.designsystem.icon.EchoIcons
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * What the theater plays: the line over the title ("ABC-101", "EPISODE 1 · SUB EN"), the title, its catalogue length,
 * where to start, and the stream ([videoUrl], HLS or a progressive file, fetched with [headers], e.g. a Referer).
 * A null [videoUrl] means there's nothing to play yet.
 */
data class TheaterMedia(
    val overline: String,
    val title: String,
    val durationMs: Long,
    val startMs: Long = 0,
    val videoUrl: String? = null,
    val headers: Map<String, String> = emptyMap(),
)

enum class TheaterStatus {
    /** Finding the stream, or the player is getting its first frames. */
    LOADING,
    READY,
    /** The title has no stream ([TheaterMedia.videoUrl] is null). */
    NO_VIDEO,
    /** The title or its stream couldn't be loaded; Try again reloads it where it stopped. */
    ERROR,
}

data class TheaterState(
    val media: TheaterMedia? = null,
    val status: TheaterStatus = TheaterStatus.LOADING,
    val positionMs: Long = 0,
    /** The stream's length once the player knows it; the catalogue's until then. */
    val durationMs: Long = 0,
    /** Play was asked for (it may still be buffering). */
    val playing: Boolean = false,
    val buffering: Boolean = false,
    val speed: Float = 1f,
    val quality: String = QUALITY_AUTO,
    /** Auto, then the stream's video heights, highest first ("1080p", "720p", …). */
    val qualities: List<String> = listOf(QUALITY_AUTO),
)

const val QUALITY_AUTO = "Auto"
private val Speeds = listOf(1f, 1.25f, 1.5f, 2f)
private const val SKIP_MS = 10_000L
private const val TICK_MS = 250L
private const val HIDE_CONTROLS_MS = 3_000L

/** A saved position this close to the end (or past it: the stream is shorter than the catalogue says) starts over. */
private const val RESUME_END_MARGIN_MS = 5_000L

/**
 * Plays [load]'s media with Media3 ExoPlayer, from its start, and calls [save] with the position whenever it pauses,
 * closes or ends. 3.7 and H.11 differ only in what they load and where they save. The player lives in the ViewModel,
 * so it keeps playing through rotation and picture-in-picture.
 *
 * A second, muted player at the lowest quality shows the frame under the seek bar's thumb while it's dragged.
 */
@OptIn(UnstableApi::class)
class TheaterViewModel(
    private val load: suspend () -> TheaterMedia?,
    private val save: suspend (positionMs: Long, durationMs: Long, finished: Boolean) -> Unit,
    private val newPlayer: () -> ExoPlayer,
) : ViewModel() {
    private val _state = MutableStateFlow(TheaterState())
    val state: StateFlow<TheaterState> = _state

    /** Made when there's a stream to play, released with the ViewModel. */
    private val _player = MutableStateFlow<ExoPlayer?>(null)
    val player: StateFlow<Player?> = _player

    /** The seek preview's player: made on the first drag, kept for the next ones, dropped when the stream changes. */
    private val _previewPlayer = MutableStateFlow<ExoPlayer?>(null)
    val previewPlayer: StateFlow<Player?> = _previewPlayer

    /** Quality label → the video track it pins. */
    private var qualityTracks: Map<String, TrackSelectionOverride> = emptyMap()

    /** The start position still has to be checked against the stream's real length. */
    private var startUnchecked = false

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = sync(player)

        override fun onPlaybackStateChanged(playbackState: Int) {
            val player = _player.value ?: return
            if (playbackState == Player.STATE_READY && startUnchecked) {
                startUnchecked = false
                val duration = player.duration
                if (duration != C.TIME_UNSET && player.currentPosition >= duration - RESUME_END_MARGIN_MS) player.seekTo(0)
            }
            if (playbackState == Player.STATE_ENDED) persist(finished = true)
        }

        override fun onPlayerError(error: PlaybackException) {
            _state.update { it.copy(status = TheaterStatus.ERROR, buffering = false) }
        }

        override fun onTracksChanged(tracks: Tracks) {
            qualityTracks = videoQualities(tracks)
            _state.update { s ->
                val labels = listOf(QUALITY_AUTO) + qualityTracks.keys
                s.copy(qualities = labels, quality = s.quality.takeIf { it in labels } ?: QUALITY_AUTO)
            }
        }
    }

    init {
        viewModelScope.launch { open(positionMs = null) }
        // The player has no position callback: poll it while the theater is open.
        viewModelScope.launch {
            while (isActive) {
                delay(TICK_MS)
                _player.value?.let { p -> _state.update { it.copy(positionMs = p.currentPosition.coerceAtLeast(0)) } }
            }
        }
    }

    /** Loads the media and starts it at [positionMs] (or where it was left). */
    private suspend fun open(positionMs: Long?) {
        _state.update { it.copy(status = TheaterStatus.LOADING) }
        releasePreview()
        val media = runCatching { load() }.getOrNull()
        if (media == null) {
            _state.update { it.copy(status = TheaterStatus.ERROR) }
            return
        }
        val start = (positionMs ?: media.startMs).coerceAtLeast(0)
        _state.update { it.copy(media = media, positionMs = start, durationMs = media.durationMs) }
        val url = media.videoUrl
        if (url == null) {
            _state.update { it.copy(status = TheaterStatus.NO_VIDEO) }
            return
        }
        // A retry keeps playing or paused as it was; the first open plays.
        val play = _player.value?.playWhenReady ?: true
        val player = _player.value ?: newPlayer().also {
            it.addListener(listener)
            _player.value = it
        }
        player.setMediaSource(mediaSource(url, media.headers), start)
        player.setPlaybackSpeed(_state.value.speed)
        startUnchecked = start > 0
        player.prepare()
        player.playWhenReady = play
    }

    /** Copies what the player is doing into the state. */
    private fun sync(player: Player) {
        _state.update { s ->
            val failed = player.playerError != null
            s.copy(
                positionMs = player.currentPosition.coerceAtLeast(0),
                durationMs = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: s.durationMs,
                playing = player.playWhenReady && player.playbackState != Player.STATE_ENDED,
                buffering = !failed && player.playbackState == Player.STATE_BUFFERING,
                status = when {
                    failed -> TheaterStatus.ERROR
                    player.playbackState == Player.STATE_IDLE -> s.status
                    player.playbackState == Player.STATE_BUFFERING && s.status == TheaterStatus.LOADING -> TheaterStatus.LOADING
                    else -> TheaterStatus.READY
                },
            )
        }
    }

    fun togglePlay() = if (_state.value.playing) pause() else play()

    private fun play() {
        val player = _player.value ?: return
        // Finished: play again from the start.
        if (player.playbackState == Player.STATE_ENDED) player.seekTo(0)
        player.play()
    }

    fun pause() {
        val player = _player.value ?: return
        player.pause()
        persist()
    }

    fun seekTo(ms: Long) {
        val player = _player.value ?: return
        val target = ms.coerceIn(0, _state.value.durationMs.coerceAtLeast(0))
        player.seekTo(target)
        _state.update { it.copy(positionMs = target) }
    }

    fun skip(deltaMs: Long) = seekTo((_player.value?.currentPosition ?: _state.value.positionMs) + deltaMs)

    fun nextSpeed() {
        val next = Speeds[(Speeds.indexOf(_state.value.speed) + 1) % Speeds.size]
        _player.value?.setPlaybackSpeed(next)
        _state.update { it.copy(speed = next) }
    }

    /** Auto lets the player adapt to the connection; a height pins that video track. */
    fun setQuality(value: String) {
        val player = _player.value ?: return
        val params = player.trackSelectionParameters.buildUpon()
        val override = qualityTracks[value]
        if (override == null) params.clearOverridesOfType(C.TRACK_TYPE_VIDEO) else params.setOverrideForType(override)
        player.trackSelectionParameters = params.build()
        _state.update { it.copy(quality = if (override == null) QUALITY_AUTO else value) }
    }

    /**
     * The seek bar is being dragged to [ms]: show that frame in the preview. The preview player loads the lowest
     * quality without sound and stays paused; scrubbing mode makes its many quick seeks cheap.
     */
    fun preview(ms: Long) {
        val media = _state.value.media ?: return
        val url = media.videoUrl ?: return
        val preview = _previewPlayer.value ?: newPlayer().also { p ->
            p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                .setForceLowestBitrate(true)
                .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, true)
                .build()
            p.volume = 0f
            p.setScrubbingModeEnabled(true)
            p.setMediaSource(mediaSource(url, media.headers), ms)
            p.prepare()
            _previewPlayer.value = p
        }
        preview.seekTo(ms)
    }

    private fun releasePreview() {
        _previewPlayer.value?.release()
        _previewPlayer.value = null
    }

    /** After an error: load again from where it stopped. */
    fun retry() {
        val at = _player.value?.currentPosition ?: _state.value.positionMs
        viewModelScope.launch { open(positionMs = at) }
    }

    private fun persist(finished: Boolean = false) {
        val s = _state.value
        if (s.media == null || s.status == TheaterStatus.NO_VIDEO) return
        val position = if (finished) s.durationMs else _player.value?.currentPosition ?: s.positionMs
        viewModelScope.launch { save(position, s.durationMs, finished) }
    }

    override fun onCleared() {
        // The pause when the screen closed has already saved the position.
        _player.value?.run {
            removeListener(listener)
            release()
        }
        _player.value = null
        releasePreview()
    }
}

/** The stream at [url] (HLS or progressive, picked from the address), fetched with [headers]. */
@OptIn(UnstableApi::class)
private fun mediaSource(url: String, headers: Map<String, String>) =
    DefaultMediaSourceFactory(
        DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true).setDefaultRequestProperties(headers),
    ).createMediaSource(MediaItem.fromUri(url))

/** The stream's video tracks by height ("1080p" …), highest first; the first track of each height. */
@OptIn(UnstableApi::class)
private fun videoQualities(tracks: Tracks): Map<String, TrackSelectionOverride> {
    val byHeight = sortedMapOf<Int, TrackSelectionOverride>(compareByDescending { it })
    tracks.groups.filter { it.type == C.TRACK_TYPE_VIDEO }.forEach { group ->
        for (i in 0 until group.length) {
            val height = group.getTrackFormat(i).height
            if (height > 0 && group.isTrackSupported(i) && height !in byHeight) {
                byHeight[height] = TrackSelectionOverride(group.mediaTrackGroup, i)
            }
        }
    }
    return byHeight.entries.associate { (height, override) -> "${height}p" to override }
}

/**
 * The theater around [vm]: opens in landscape (the rotate button switches to portrait and back), keeps the screen on
 * while playing, and pauses and saves when it closes or the app goes to the background (not for a rotation, nor in
 * picture-in-picture). [closeIcon] is H.11's ✕ instead of ←.
 */
@Composable
fun TheaterRoute(
    vm: TheaterViewModel,
    code: String,
    onBack: () -> Unit,
    closeIcon: Boolean = false,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val player by vm.player.collectAsStateWithLifecycle()
    val previewPlayer by vm.previewPlayer.collectAsStateWithLifecycle()
    val activity = LocalContext.current.findActivity()
    val inPip = rememberInPictureInPicture(activity)
    var landscape by rememberSaveable { mutableStateOf(true) }
    DisposableEffect(activity, landscape) {
        activity?.requestedOrientation =
            if (landscape) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE else ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
        onDispose { }
    }
    DisposableEffect(activity) {
        onDispose {
            // Recreated for a rotation or picture-in-picture: the same theater comes straight back.
            if (activity?.isChangingConfigurations != true) {
                vm.pause()
                activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
        }
    }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        if (activity?.isChangingConfigurations != true) vm.pause()
    }
    val view = LocalView.current
    DisposableEffect(view, state.playing) {
        view.keepScreenOn = state.playing
        onDispose { view.keepScreenOn = false }
    }
    // While playing, leaving the app (Home) carries the video on in picture-in-picture (Android 12+).
    DisposableEffect(activity, state.playing) {
        if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            runCatching { activity.setPictureInPictureParams(pipParams(autoEnter = state.playing)) }
        }
        onDispose {
            if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !activity.isChangingConfigurations) {
                runCatching { activity.setPictureInPictureParams(pipParams(autoEnter = false)) }
            }
        }
    }
    TheaterScreen(
        state = state,
        player = player,
        previewPlayer = previewPlayer,
        code = code,
        onBack = onBack,
        onTogglePlay = vm::togglePlay,
        onSeek = vm::seekTo,
        onPreview = vm::preview,
        onSkip = vm::skip,
        onSpeed = vm::nextSpeed,
        onQuality = vm::setQuality,
        onRetry = vm::retry,
        landscape = landscape,
        onRotate = { landscape = !landscape },
        closeIcon = closeIcon,
        inPip = inPip,
        onPip = { activity?.let { runCatching { it.enterPictureInPictureMode(pipParams(autoEnter = state.playing)) } } },
    )
}

private fun pipParams(autoEnter: Boolean): PictureInPictureParams = PictureInPictureParams.Builder()
    .setAspectRatio(Rational(16, 9))
    .apply { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) setAutoEnterEnabled(autoEnter) }
    .build()

/** Whether the activity is in picture-in-picture now (the controls hide there: the window is too small). */
@Composable
private fun rememberInPictureInPicture(activity: Activity?): Boolean {
    var inPip by remember(activity) { mutableStateOf(activity?.isInPictureInPictureMode == true) }
    DisposableEffect(activity) {
        val provider = activity as? OnPictureInPictureModeChangedProvider
        val listener = Consumer<PictureInPictureModeChangedInfo> { inPip = it.isInPictureInPictureMode }
        provider?.addOnPictureInPictureModeChangedListener(listener)
        onDispose { provider?.removeOnPictureInPictureModeChangedListener(listener) }
    }
    return inPip
}

private fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/**
 * Figma 3.7 / H.11 Theater: the video on black, landscape or portrait. Tap to show or hide the controls; they hide
 * after 3 s of playing (not while the seek bar is held). Top: back (or close), the overline and title, rotate, speed,
 * picture-in-picture, quality. Centre: back 10 · play/pause · forward 10. Bottom: position, seek bar (with a frame
 * preview while dragging), duration, fullscreen. A spinner while it buffers; a message when there's no video or it
 * can't play. [player] and [previewPlayer] are null in previews and until there's a stream.
 */
@Composable
fun TheaterScreen(
    state: TheaterState,
    player: Player?,
    code: String,
    onBack: () -> Unit,
    onTogglePlay: () -> Unit,
    onSeek: (Long) -> Unit,
    onSkip: (Long) -> Unit,
    onSpeed: () -> Unit,
    onQuality: (String) -> Unit,
    onPip: () -> Unit,
    previewPlayer: Player? = null,
    onPreview: (Long) -> Unit = {},
    onRetry: () -> Unit = {},
    landscape: Boolean = true,
    onRotate: () -> Unit = {},
    closeIcon: Boolean = false,
    inPip: Boolean = false,
) = ReaderTheme {
    var controls by rememberSaveable { mutableStateOf(true) }
    var menu by remember { mutableStateOf(false) }
    var scrubbing by remember { mutableStateOf(false) }
    val waiting = state.status == TheaterStatus.LOADING || state.buffering
    LaunchedEffect(controls, state.playing, menu, state.speed, scrubbing) {
        if (controls && state.playing && !menu && !scrubbing) {
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
        if (player != null && state.status != TheaterStatus.NO_VIDEO) {
            // Keeps the video's ratio, letterboxed in black; holds the last frame while seeking or switching quality.
            ContentFrame(player = player, modifier = Modifier.fillMaxSize(), keepContentOnReset = true)
        }
        if (inPip) return@Box
        when (state.status) {
            TheaterStatus.NO_VIDEO -> Message(
                stringResource(R.string.state_no_video_title), stringResource(R.string.state_no_video_body),
                Modifier.align(Alignment.Center),
            )
            TheaterStatus.ERROR -> Message(
                stringResource(R.string.theater_error_title), stringResource(R.string.theater_error_body),
                Modifier.align(Alignment.Center), onRetry,
            )
            else -> if (waiting && !controls) Spinner(Modifier.align(Alignment.Center))
        }
        AnimatedVisibility(controls, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.fillMaxSize()) {
            Box(
                Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f)).safeDrawingPadding()
                    .padding(horizontal = if (landscape) 24.dp else 8.dp, vertical = 12.dp),
            ) {
                Row(Modifier.fillMaxWidth().align(Alignment.TopCenter), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    WhiteIcon(
                        if (closeIcon) EchoIcons.Close else EchoIcons.ArrowBack,
                        stringResource(app.echo.designsystem.R.string.echo_cd_back), onBack,
                    )
                    Column(Modifier.weight(1f).padding(start = 4.dp)) {
                        Text(state.media?.overline.orEmpty(), style = MaterialTheme.typography.labelMediumEmphasized, color = Color.White.copy(alpha = 0.7f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(state.media?.title.orEmpty(), style = MaterialTheme.typography.titleMedium, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    if (state.speed != 1f) Text("${state.speed}×", style = MaterialTheme.typography.labelLarge, color = Color.White)
                    WhiteIcon(
                        EchoIcons.RotateLeft,
                        stringResource(if (landscape) R.string.theater_portrait else R.string.theater_landscape),
                        onRotate,
                    )
                    WhiteIcon(EchoIcons.Speed, stringResource(R.string.jav_speed), onSpeed)
                    WhiteIcon(EchoIcons.PictureInPicture, stringResource(R.string.jav_pip), onPip)
                    QualityMenu(state.quality, state.qualities, onQuality, menu) { menu = it }
                }
                if (state.status == TheaterStatus.READY || state.status == TheaterStatus.LOADING) {
                    CentreControls(state.playing, waiting, onTogglePlay, onSkip, Modifier.align(Alignment.Center))
                }
                SeekRow(
                    state, previewPlayer, onSeek, onPreview, { scrubbing = it }, onBack,
                    Modifier.align(Alignment.BottomCenter),
                )
            }
        }
    }
}

@Composable
private fun Spinner(modifier: Modifier) = CircularProgressIndicator(modifier.size(48.dp), color = Color.White)

/** No video, or it can't play: a title, a line, and Try again when there's something to retry. */
@Composable
private fun Message(title: String, body: String, modifier: Modifier, onRetry: (() -> Unit)? = null) {
    Column(modifier.padding(horizontal = 48.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, color = Color.White, textAlign = TextAlign.Center)
        Text(body, style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.7f), textAlign = TextAlign.Center)
        if (onRetry != null) {
            OutlinedButton(onClick = onRetry, modifier = Modifier.padding(top = 8.dp)) {
                Text(stringResource(R.string.state_try_again), color = Color.White)
            }
        }
    }
}

@Composable
private fun QualityMenu(quality: String, qualities: List<String>, onQuality: (String) -> Unit, open: Boolean, onOpen: (Boolean) -> Unit) {
    Box {
        FilledTonalIconButton(onClick = { onOpen(true) }) {
            Icon(painterResource(EchoIcons.Settings), stringResource(R.string.jav_quality))
        }
        DropdownMenu(expanded = open, onDismissRequest = { onOpen(false) }) {
            qualities.forEach { q ->
                DropdownMenuItem(
                    text = { Text(if (q == QUALITY_AUTO) stringResource(R.string.jav_quality_auto) else q) },
                    onClick = { onQuality(q); onOpen(false) },
                    leadingIcon = { if (q == quality) Icon(painterResource(EchoIcons.Check), null) },
                )
            }
        }
    }
}

/** Back 10 · play/pause (tonal, wide, square: 112 × 80; a spinner while buffering) · forward 10. */
@Composable
private fun CentreControls(playing: Boolean, waiting: Boolean, onTogglePlay: () -> Unit, onSkip: (Long) -> Unit, modifier: Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(24.dp)) {
        WhiteIcon(EchoIcons.FastRewindFilled, stringResource(R.string.jav_replay_10), { onSkip(-SKIP_MS) }, size = 56)
        FilledTonalIconButton(onClick = onTogglePlay, shape = MaterialTheme.shapes.extraLarge, modifier = Modifier.size(112.dp, 80.dp)) {
            if (waiting) {
                CircularProgressIndicator(Modifier.size(32.dp))
            } else {
                Icon(
                    painterResource(if (playing) EchoIcons.PauseFilled else EchoIcons.PlayArrowFilled),
                    stringResource(if (playing) R.string.jav_pause else R.string.jav_play),
                    Modifier.size(32.dp),
                )
            }
        }
        WhiteIcon(EchoIcons.FastForwardFilled, stringResource(R.string.jav_forward_10), { onSkip(SKIP_MS) }, size = 56)
    }
}

/** The seek preview: a 16:9 frame and its time. */
private val PreviewWidth = 176.dp
private val PreviewHeight = 99.dp

/**
 * "42:07 ━━━━━━━━━━ 2:00:00 ⛶". Dragging moves the thumb and the time and shows the frame there in a preview above
 * the thumb ([onPreview] seeks the preview player); the video itself seeks once, on release. Fullscreen leaves the
 * theater (the page is the non-fullscreen view).
 */
@Composable
private fun SeekRow(
    state: TheaterState,
    previewPlayer: Player?,
    onSeek: (Long) -> Unit,
    onPreview: (Long) -> Unit,
    onScrubbing: (Boolean) -> Unit,
    onExit: () -> Unit,
    modifier: Modifier,
) {
    var scrub by remember { mutableStateOf<Float?>(null) }
    // Where the slider sits in the row, to put the preview over the thumb.
    var sliderLeft by remember { mutableIntStateOf(0) }
    var sliderWidth by remember { mutableIntStateOf(0) }
    var rowWidth by remember { mutableIntStateOf(0) }
    val shown = scrub?.toLong() ?: state.positionMs
    val duration = state.durationMs.coerceAtLeast(1)
    Box(modifier.fillMaxWidth().onSizeChanged { rowWidth = it.width }) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(clock(shown), style = MaterialTheme.typography.labelMedium, color = Color.White)
            EchoSlider(
                value = shown.toFloat(),
                onValueChange = {
                    if (scrub == null) onScrubbing(true)
                    scrub = it
                    onPreview(it.toLong())
                },
                valueRange = 0f..duration.toFloat(),
                modifier = Modifier.weight(1f).onGloballyPositioned {
                    sliderLeft = it.positionInParent().x.roundToInt()
                    sliderWidth = it.size.width
                },
                enabled = state.status == TheaterStatus.READY,
                onValueChangeFinished = {
                    scrub?.let { onSeek(it.toLong()) }
                    scrub = null
                    onScrubbing(false)
                },
            )
            Text(clock(state.durationMs), style = MaterialTheme.typography.labelMedium, color = Color.White)
            WhiteIcon(EchoIcons.Fullscreen, stringResource(R.string.jav_fullscreen), onExit)
        }
        val at = scrub
        if (at != null) {
            val density = LocalDensity.current
            val width = with(density) { PreviewWidth.roundToPx() }
            val gap = with(density) { 8.dp.roundToPx() }
            val thumbX = sliderLeft + (at / duration * sliderWidth).roundToInt()
            val x = (thumbX - width / 2).coerceIn(0, (rowWidth - width).coerceAtLeast(0))
            Column(
                Modifier.align(Alignment.TopStart)
                    .offset { IntOffset(x, -(with(density) { PreviewHeight.roundToPx() } + gap * 4)) },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(
                    Modifier.size(PreviewWidth, PreviewHeight).clip(MaterialTheme.shapes.medium)
                        .background(Color.Black).border(1.dp, Color.White.copy(alpha = 0.6f), MaterialTheme.shapes.medium),
                ) {
                    // A TextureView: it layers inside Compose over the main video's SurfaceView.
                    if (previewPlayer != null) {
                        ContentFrame(previewPlayer, Modifier.fillMaxSize(), surfaceType = SURFACE_TYPE_TEXTURE_VIEW)
                    }
                }
                Text(
                    clock(at.toLong()),
                    style = MaterialTheme.typography.labelLargeEmphasized,
                    color = Color.White,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun WhiteIcon(icon: Int, description: String, onClick: () -> Unit, size: Int = 48) {
    IconButton(onClick = onClick, modifier = Modifier.size(size.dp)) {
        Icon(painterResource(icon), description, tint = Color.White)
    }
}
