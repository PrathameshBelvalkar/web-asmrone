package app.echo.designsystem.component.echo

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.stringResource
import app.echo.designsystem.R
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.IconButtonShape
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoSpacing

/**
 * The like toggle (Figma "M3E · Icon button (Tonal, toggle on, square)", 1.5 / 1.8 / 1.11): a 56 dp tonal icon
 * toggle that is round when off and morphs to a square (16 dp) when liked, with the heart filling in and a short
 * spring "pop" on like. The pop is skipped on first composition so an already-liked track doesn't bounce.
 */
@Composable
fun LikeButton(
    liked: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    size: ComponentSize = ComponentSize.M,
) {
    val scale = remember { Animatable(1f) }
    val spring = MaterialTheme.motionScheme.fastSpatialSpec<Float>()
    val first = remember { booleanArrayOf(true) }
    LaunchedEffect(liked) {
        if (first[0]) { first[0] = false; return@LaunchedEffect }
        if (liked) {
            scale.animateTo(POP_SCALE, spring)
            scale.animateTo(1f, spring)
        }
    }
    EchoIconButton(
        icon = EchoIcons.Favorite,
        checkedIcon = EchoIcons.FavoriteFilled,
        contentDescription = stringResource(R.string.echo_cd_like),
        onClick = onToggle,
        checked = liked,
        style = IconButtonStyle.Tonal,
        size = size,
        shape = IconButtonShape.Round,
        modifier = modifier.graphicsLayer { scaleX = scale.value; scaleY = scale.value },
    )
}

private const val POP_SCALE = 1.18f

@EchoPreviews
@Composable
private fun LikeButtonPreview() = EchoThemesPreview {
    Row(Modifier.padding(horizontal = EchoSpacing.screenMargin), horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l)) {
        LikeButton(liked = false, onToggle = {})
        LikeButton(liked = true, onToggle = {})
    }
}
