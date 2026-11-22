package app.echo.designsystem.component.echo

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.echo.designsystem.R
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.preview.PreviewData
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/** The avatar icon picked in O.6 / S.12, or null for the initial. The shell provides it to every [ProfileAvatar]. */
val LocalProfileAvatarIcon = staticCompositionLocalOf<Int?> { null }

/**
 * The local profile avatar (Figma "Echo · Profile avatar", 23 screens): a ring around the avatar in a 48 dp
 * touch target. Shows the profile initial until an image is picked (O.6 / S.12). Opens P.1.
 */
@Composable
fun ProfileAvatar(
    initial: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    image: (@Composable () -> Unit)? = null,
) {
    val description = stringResource(R.string.echo_cd_profile)
    Box(
        modifier
            .size(EchoSizes.minTouchTarget)
            .clip(EchoShapes.Full)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .size(EchoSizes.profileAvatar + EchoSizes.profileAvatarRing * 2)
                .border(EchoSizes.profileAvatarRing, MaterialTheme.colorScheme.primary, EchoShapes.Full)
                .padding(EchoSizes.profileAvatarRing * 2),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier.size(EchoSizes.profileAvatar - EchoSizes.profileAvatarRing * 2)
                    .clip(EchoShapes.Full)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                val icon = LocalProfileAvatarIcon.current
                if (image != null) {
                    image()
                } else if (icon != null) {
                    Icon(
                        painterResource(icon), contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(18.dp),
                    )
                } else {
                    Text(
                        initial.take(1).uppercase(),
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
        }
    }
}

@EchoPreviews
@Composable
private fun ProfileAvatarPreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin)) {
        ProfileAvatar(PreviewData.PROFILE_INITIAL, onClick = {})
        ProfileAvatar("Mika", onClick = {}, modifier = Modifier.padding(start = 8.dp))
    }
}
