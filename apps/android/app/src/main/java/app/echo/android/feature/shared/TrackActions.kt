package app.echo.android.feature.shared

import androidx.compose.ui.res.pluralStringResource
import android.content.Intent
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.R
import app.echo.android.ui.echoViewModel
import app.echo.data.model.Playlist
import app.echo.data.model.Track
import app.echo.data.repository.PlaylistRepository
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** An action a screen adds to the track sheet (e.g. "Remove from playlist" on 1.7, "Remove from Up next" on 1.9). */
data class TrackExtra(val label: String, @DrawableRes val icon: Int, val onClick: () -> Unit)

/**
 * Opens the track actions sheet for a track, with the screen's [TrackExtra]s. The shell provides it, so every
 * track row's ⋮ works the same way; it does nothing in previews and tests.
 */
val LocalTrackActions = staticCompositionLocalOf<(Track, List<TrackExtra>) -> Unit> { { _, _ -> } }

class TrackActionsViewModel(private val repo: PlaylistRepository) : ViewModel() {
    val playlists: StateFlow<List<Playlist>> = repo.playlists.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    fun liked(track: Track) = repo.isLiked(track.id)
    fun setLiked(track: Track, liked: Boolean) = viewModelScope.launch { repo.setLiked(track, liked) }
    fun addTo(playlistId: Long, track: Track) = viewModelScope.launch { repo.add(playlistId, track) }
}

/**
 * The track sheet (the same actions as 1.11 More, for any track row): like, add to playlist, go to the work or the
 * artist, share, then the screen's extras.
 */
@Composable
fun TrackActionsSheet(
    track: Track,
    extras: List<TrackExtra>,
    onWork: (String) -> Unit,
    onArtist: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val vm = echoViewModel { TrackActionsViewModel(it.playlists) }
    val liked by remember(track.id) { vm.liked(track) }.collectAsStateWithLifecycle(false)
    val playlists by vm.playlists.collectAsStateWithLifecycle()
    var picking by remember { mutableStateOf(false) }
    val context = LocalContext.current
    if (picking) {
        EchoSheet(onDismiss = onDismiss, title = stringResource(R.string.work_add_to_playlist)) {
            SegmentedList(Modifier.padding(bottom = EchoSpacing.xxl)) {
                playlists.forEach { pl ->
                    item {
                        SegmentedListItem(
                            pl.name, onClick = { vm.addTo(pl.id, track); onDismiss() },
                            supporting = pluralStringResource(R.plurals.results_tracks_count, pl.trackCount, pl.trackCount),
                            leading = { Icon(painterResource(EchoIcons.QueueMusic), null) },
                        )
                    }
                }
            }
        }
        return
    }
    EchoSheet(onDismiss = onDismiss, modifier = Modifier.testTag("overlay:track")) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.xl, vertical = EchoSpacing.xs),
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CoverImage(track.coverUrl, null, Modifier.size(48.dp), shape = MaterialTheme.shapes.medium)
            Column {
                Text(track.title, style = MaterialTheme.typography.titleMedium, maxLines = 1)
                Text(track.artist, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        SegmentedList(Modifier.padding(top = EchoSpacing.m, bottom = EchoSpacing.xxl)) {
            item {
                Action(
                    stringResource(if (liked) R.string.track_unlike else R.string.track_like),
                    if (liked) EchoIcons.FavoriteFilled else EchoIcons.Favorite,
                ) { vm.setLiked(track, !liked); onDismiss() }
            }
            item { Action(stringResource(R.string.work_add_to_playlist), EchoIcons.PlaylistAdd) { picking = true } }
            item { Action(stringResource(R.string.player_go_to_work), EchoIcons.LibraryMusic) { onDismiss(); onWork(track.workId) } }
            item { Action(stringResource(R.string.player_go_to_artist), EchoIcons.Person) { onDismiss(); onArtist(track.artist) } }
            item {
                Action(stringResource(R.string.track_share), EchoIcons.Share) {
                    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, "${track.title} · ${track.artist}")
                    context.startActivity(Intent.createChooser(send, null))
                    onDismiss()
                }
            }
            extras.forEach { extra -> item { Action(extra.label, extra.icon) { onDismiss(); extra.onClick() } } }
        }
    }
}

@Composable
private fun Action(label: String, @DrawableRes icon: Int, onClick: () -> Unit) =
    SegmentedListItem(label, onClick = onClick, leading = { Icon(painterResource(icon), null) })
