package app.echo.android.shell

import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.echo.android.navigation.Route
import app.echo.data.model.Profile
import app.echo.designsystem.component.echo.AvatarChoice
import app.echo.designsystem.component.echo.ProfileHeader
import app.echo.designsystem.component.m3e.EchoSheet
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SegmentedListItem
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.tokens.EchoSpacing

/** P.1 Profile (a sheet over the screen with the avatar). Placeholder content until Phase 10. */
@Composable
fun ProfileSheet(profile: Profile, onOpen: (Route) -> Unit, onDismiss: () -> Unit) {
    EchoSheet(onDismiss = onDismiss, modifier = Modifier.testTag("overlay:P.1")) {
        ProfileHeader(profile.name, "Your profile · saved on this device", AvatarChoice.Initial)
        SegmentedList(Modifier.padding(vertical = EchoSpacing.l)) {
            item { SegmentedListItem("S.12 Profile", onClick = { onOpen(Route.EditProfile) }, leading = { icon(EchoIcons.Person) }) }
            item { SegmentedListItem("1.12 Playlists", onClick = { onOpen(Route.Playlists) }, leading = { icon(EchoIcons.QueueMusic) }) }
            item { SegmentedListItem("0.3 History", onClick = { onOpen(Route.History) }, leading = { icon(EchoIcons.History) }) }
            item { SegmentedListItem("S.1 Settings", onClick = { onOpen(Route.Settings) }, leading = { icon(EchoIcons.Settings) }) }
        }
    }
}

@Composable
private fun icon(res: Int) = androidx.compose.material3.Icon(androidx.compose.ui.res.painterResource(res), null)
