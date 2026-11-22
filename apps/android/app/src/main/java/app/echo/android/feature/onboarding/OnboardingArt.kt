package app.echo.android.feature.onboarding

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.echo.designsystem.component.echo.CoverImage
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.theme.EchoShapes

/*
 * The welcome illustrations (Figma "Echo · Onboarding illustration", O.2–O.4): a 360 × 356 dp stage with the pieces at
 * Figma's positions. Figma's dark wireframe grey (#383838) is the primary colour, like the filled buttons.
 */

private val StageWidth = 360.dp
private val StageHeight = 356.dp

/** The stage, centred, 24 dp under the status bar. */
@Composable
private fun Stage(content: @Composable BoxScope.() -> Unit) = Box(Modifier.fillMaxWidth().padding(top = 24.dp)) {
    Box(Modifier.size(StageWidth, StageHeight).align(Alignment.TopCenter), content = content)
}

/**
 * A cover placeholder card at ([x], [y]) on the stage, [rotation] degrees clockwise about its centre. Figma: #e6e6e6 with
 * a 1 dp outline and a 24 dp drop shadow.
 */
@Composable
private fun ArtCard(
    x: Dp, y: Dp, width: Dp, height: Dp,
    radius: Dp = 24.dp,
    rotation: Float = 0f,
    content: @Composable BoxScope.() -> Unit = {},
) {
    val shape = RoundedCornerShape(radius)
    Box(
        Modifier.offset(x, y).size(width, height).rotate(rotation)
            .shadow(12.dp, shape)
            .clip(shape)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape),
    ) {
        CoverImage(null, null, Modifier.fillMaxSize(), shape = null)
        content()
    }
}

/** The 36 dp round badge in the corner of an O.2 card (note, book, play). */
@Composable
private fun BoxScope.Badge(@DrawableRes icon: Int) {
    Box(
        Modifier.offset(12.dp, 12.dp).size(36.dp).clip(EchoShapes.Full).background(MaterialTheme.colorScheme.primary),
        contentAlignment = Alignment.Center,
    ) {
        Icon(painterResource(icon), null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onPrimary)
    }
}

/** O.2 "one app" (Figma 29:27982): three tilted covers, for listening, reading and watching. */
@Composable
internal fun OneAppArt() = Stage {
    // Positions are the unrotated top-left, from each card's centre in Figma (92, 166), (256, 137), (193, 239).
    ArtCard(7.dp, 81.dp, 170.dp, 170.dp, radius = 32.dp, rotation = 8f) { Badge(EchoIcons.MusicNoteFilled) }
    ArtCard(181.dp, 32.dp, 150.dp, 210.dp, rotation = -6f) { Badge(EchoIcons.BookFilled) }
    ArtCard(88.dp, 174.dp, 210.dp, 130.dp, rotation = 2f) { Badge(EchoIcons.PlayArrowFilled) }
}

/** O.3 "switch sources" (Figma 29:28023): the search bar with its source pill, and the switcher under it. */
@Composable
internal fun SwitchSourcesArt() = Stage {
    val colors = MaterialTheme.colorScheme
    Surface(
        shape = EchoShapes.Full, shadowElevation = 6.dp, color = colors.surfaceBright,
        modifier = Modifier.offset(30.dp, 30.dp).size(300.dp, 56.dp),
    ) {
        Row(Modifier.padding(start = 8.dp, end = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier.height(40.dp).clip(EchoShapes.Full).background(colors.primary).padding(start = 10.dp, end = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(painterResource(EchoIcons.MusicNoteFilled), null, Modifier.size(18.dp), tint = colors.onPrimary)
                Text("asmr.one", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = colors.onPrimary)
                Icon(painterResource(EchoIcons.ExpandMore), null, Modifier.size(16.dp), tint = colors.onPrimary)
            }
            Text("Search", fontSize = 15.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(start = 8.dp))
        }
    }
    Surface(
        shape = RoundedCornerShape(28.dp), shadowElevation = 10.dp, color = colors.surfaceBright,
        modifier = Modifier.offset(30.dp, 110.dp).size(300.dp, 190.dp),
    ) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            SwitcherRow(EchoIcons.MusicNoteFilled, "ASMR", selected = true)
            SwitcherRow(EchoIcons.BookFilled, "Manga")
            SwitcherRow(EchoIcons.MovieFilled, "JAV")
            SwitcherRow(EchoIcons.PlayArrowFilled, "Hentai")
        }
    }
}

/** One switcher row: 36 dp, 16 dp corners; the selected one is secondaryContainer with a check. */
@Composable
private fun SwitcherRow(@DrawableRes icon: Int, label: String, selected: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    Row(
        Modifier.fillMaxWidth().height(36.dp).clip(RoundedCornerShape(16.dp))
            .background(if (selected) colors.secondaryContainer else colors.surfaceContainer)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(painterResource(icon), null, Modifier.size(20.dp))
        Text(
            label, fontSize = 14.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
        if (selected) Icon(painterResource(EchoIcons.Check), null, Modifier.size(20.dp))
    }
}

/** O.4 "pick up" (Figma 29:28073): three covers labelled ASMR · MANGA · JAV, each with how far you got. */
@Composable
internal fun PickUpArt() = Stage {
    ArtCard(10.dp, 40.dp, 150.dp, 150.dp) { Progress("ASMR", 90f / 150f) }
    ArtCard(180.dp, 20.dp, 120.dp, 170.dp) { Progress("MANGA", 78f / 120f) }
    ArtCard(60.dp, 200.dp, 240.dp, 130.dp) { Progress("JAV", 84f / 240f) }
}

/** The label pill (10 dp from the corner) and the 5 dp progress bar along the bottom of an O.4 card. */
@Composable
private fun BoxScope.Progress(label: String, progress: Float) {
    val colors = MaterialTheme.colorScheme
    Text(
        label,
        fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = colors.onPrimary,
        modifier = Modifier.offset(10.dp, 10.dp).clip(RoundedCornerShape(8.dp)).background(colors.primary)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
    Box(Modifier.align(Alignment.BottomStart).fillMaxWidth(progress).height(5.dp).background(colors.primary))
}
