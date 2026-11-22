package app.echo.android.shell

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.android.feature.settings.avatarChoice
import app.echo.android.navigation.Route
import app.echo.data.model.Profile
import app.echo.designsystem.component.echo.ProfileHeader
import app.echo.designsystem.component.m3e.ChipRow
import app.echo.designsystem.component.m3e.ChipSpec
import app.echo.designsystem.component.m3e.ChipStyle
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.tokens.EchoSpacing

/**
 * Figma P.1 Profile (29:28468): a sheet over the current screen. The header opens S.12, the chips 1.12, then
 * Your library (0.2), History (0.3) and Settings (S.1).
 */
@Composable
fun ProfileSheet(profile: Profile, stats: ProfileStats, onOpen: (Route) -> Unit, onDismiss: () -> Unit) {
    EchoSheet(onDismiss = onDismiss, modifier = Modifier.testTag("overlay:P.1")) {
        ProfileHeader(
            profile.name, stringResource(R.string.profile_sheet_subtitle), profile.avatarChoice(),
            Modifier.clickable { onOpen(Route.EditProfile) },
        )
        ChipRow(
            chips = listOf(
                ChipSpec(stringResource(R.string.profile_playlists, stats.playlists), EchoIcons.QueueMusic),
                ChipSpec(stringResource(R.string.profile_liked, stats.liked), EchoIcons.FavoriteFilled),
                ChipSpec(stringResource(R.string.profile_listened, stats.listenedHours), EchoIcons.History),
            ),
            onClick = { onOpen(Route.Playlists) },
            style = ChipStyle.Assist,
            modifier = Modifier.padding(vertical = EchoSpacing.s),
        )
        SegmentedList(Modifier.padding(top = EchoSpacing.s, bottom = EchoSpacing.l)) {
            item {
                SegmentedListItem(
                    stringResource(R.string.profile_your_library), onClick = { onOpen(Route.Library) },
                    supporting = stringResource(R.string.profile_your_library_summary),
                    leading = { icon(EchoIcons.LibraryMusic) }, trailing = { icon(EchoIcons.ChevronRight) },
                )
            }
            item {
                SegmentedListItem(
                    stringResource(R.string.history_title), onClick = { onOpen(Route.History) },
                    leading = { icon(EchoIcons.History) }, trailing = { icon(EchoIcons.ChevronRight) },
                )
            }
            item {
                SegmentedListItem(
                    stringResource(R.string.settings_title), onClick = { onOpen(Route.Settings) },
                    leading = { icon(EchoIcons.Settings) }, trailing = { icon(EchoIcons.ChevronRight) },
                )
            }
        }
    }
}

@Composable
private fun icon(res: Int) = Icon(painterResource(res), null)
