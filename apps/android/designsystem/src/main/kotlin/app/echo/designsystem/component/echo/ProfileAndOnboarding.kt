package app.echo.designsystem.component.echo

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.theme.ThemeConfig
import app.echo.designsystem.tokens.EchoSpacing

/** The profile's avatar: either the name's initial or one of the picker icons. */
sealed interface AvatarChoice {
    data object Initial : AvatarChoice
    data class Icon(@DrawableRes val icon: Int) : AvatarChoice
}

@Composable
private fun AvatarCircle(choice: AvatarChoice, initial: String, size: androidx.compose.ui.unit.Dp, selected: Boolean = false) {
    val colors = MaterialTheme.colorScheme
    Box(
        Modifier.size(size).clip(EchoShapes.Full)
            .background(if (selected || choice == AvatarChoice.Initial) colors.primaryContainer else colors.surfaceContainerHighest),
        contentAlignment = Alignment.Center,
    ) {
        when (choice) {
            AvatarChoice.Initial -> Text(
                initial.take(1).uppercase(),
                style = if (size >= 56.dp) MaterialTheme.typography.headlineSmallEmphasized else MaterialTheme.typography.titleMedium,
                color = colors.onPrimaryContainer,
            )
            is AvatarChoice.Icon -> Icon(painterResource(choice.icon), null, Modifier.size(size * 0.45f))
        }
    }
}

/** P.1 header (Figma "Echo · Profile header (local · no account)"): 64 dp avatar, name, "Your profile · …". */
@Composable
fun ProfileHeader(name: String, subtitle: String, avatar: AvatarChoice, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().padding(horizontal = EchoSpacing.sectionPadding, vertical = EchoSpacing.s),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l),
    ) {
        AvatarCircle(avatar, name, 64.dp)
        Column {
            Text(name, style = MaterialTheme.typography.titleLargeEmphasized)
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** The icons offered next to the initial (Figma "Avatar/note", "/book", "/video", "/play" …). */
val DefaultAvatarIcons = listOf(EchoIcons.MusicNote, EchoIcons.Book, EchoIcons.Movie, EchoIcons.PlayArrow, EchoIcons.Star,
    EchoIcons.Favorite, EchoIcons.Palette, EchoIcons.Headphones)

/**
 * Single-select avatar picker (Figma "M3E · Avatar picker (single-select)", O.6 / S.12): the initial first, then
 * icons, 58 dp circles 14 dp apart; the selected one gets a primary ring.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AvatarPicker(
    name: String,
    selected: AvatarChoice,
    onSelect: (AvatarChoice) -> Unit,
    modifier: Modifier = Modifier,
    icons: List<Int> = DefaultAvatarIcons,
) {
    val choices = listOf<AvatarChoice>(AvatarChoice.Initial) + icons.map { AvatarChoice.Icon(it) }
    FlowRow(
        modifier.fillMaxWidth().padding(horizontal = EchoSpacing.sectionPadding),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        choices.forEach { choice ->
            val isSelected = choice == selected
            Surface(
                selected = isSelected,
                onClick = { onSelect(choice) },
                shape = EchoShapes.Full,
                border = if (isSelected) BorderStroke(3.dp, MaterialTheme.colorScheme.primary) else null,
                modifier = Modifier.semantics { contentDescription = if (choice is AvatarChoice.Icon) "Avatar" else name },
            ) {
                AvatarCircle(choice, name, 58.dp, selected = isSelected)
            }
        }
    }
}

/**
 * Three mini phones (Light / Dark / Pure black), selectable (Figma "Echo · Theme previews", O.8). Each is drawn in
 * its own theme so it shows the real colours.
 */
@Composable
fun ThemePreviews(
    labels: List<String>,
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier.fillMaxWidth().padding(horizontal = EchoSpacing.xl),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l),
    ) {
        EchoPreviewTheme.entries.forEachIndexed { index, theme ->
            val isSelected = index == selected
            Column(
                Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
            ) {
                Surface(
                    selected = isSelected,
                    onClick = { onSelect(index) },
                    shape = MaterialTheme.shapes.largeIncreased,
                    border = BorderStroke(if (isSelected) 3.dp else 1.dp, if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant),
                    modifier = Modifier.fillMaxWidth().aspectRatio(0.58f),
                ) { MiniPhone(theme.config) }
                Text(
                    labels.getOrElse(index) { theme.name },
                    style = if (isSelected) MaterialTheme.typography.labelLargeEmphasized else MaterialTheme.typography.labelLarge,
                )
            }
        }
    }
}

@Composable
private fun MiniPhone(config: ThemeConfig) = EchoTheme(config) {
    val c = MaterialTheme.colorScheme
    Column(Modifier.fillMaxSize().background(c.surface).padding(EchoSpacing.s), verticalArrangement = Arrangement.spacedBy(EchoSpacing.s - EchoSpacing.xxs)) {
        Box(Modifier.fillMaxWidth(0.7f).height(6.dp).clip(EchoShapes.Full).background(c.onSurfaceVariant.copy(alpha = 0.6f)))
        Box(Modifier.fillMaxWidth().height(6.dp).clip(EchoShapes.Full).background(c.onSurfaceVariant.copy(alpha = 0.4f)))
        Box(Modifier.fillMaxWidth(0.5f).height(6.dp).clip(EchoShapes.Full).background(c.onSurfaceVariant.copy(alpha = 0.4f)))
        Box(Modifier.fillMaxWidth().aspectRatio(1.4f).clip(MaterialTheme.shapes.small).background(c.primaryContainer))
        Spacer(Modifier.weight(1f))
        Box(Modifier.fillMaxWidth().height(14.dp).clip(EchoShapes.Full).background(c.surfaceContainer))
    }
}

/**
 * The illustration box of a welcome page (Figma "Echo · Onboarding illustration", O.2–O.4): a big rounded tile
 * (extraExtraLarge) on primaryContainer with an icon, until real art exists.
 */
@Composable
fun OnboardingIllustration(@DrawableRes icon: Int, modifier: Modifier = Modifier) {
    Box(
        modifier.fillMaxWidth().padding(horizontal = EchoSpacing.sectionPadding).height(320.dp)
            .clip(MaterialTheme.shapes.extraExtraLarge).background(MaterialTheme.colorScheme.primaryContainer),
        contentAlignment = Alignment.Center,
    ) {
        Icon(painterResource(icon), null, Modifier.size(96.dp), tint = MaterialTheme.colorScheme.onPrimaryContainer)
    }
}

/**
 * The in-app part of O.1 Splash (Figma "Echo · Splash"): the app mark, "Echo", the tagline and the version. The
 * system SplashScreen API shows the icon first; this takes over while the first settings load.
 */
@Composable
fun EchoSplash(tagline: String, version: String, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            Modifier.size(96.dp).clip(MaterialTheme.shapes.extraLargeIncreased).background(MaterialTheme.colorScheme.primary),
            contentAlignment = Alignment.Center,
        ) {
            Icon(painterResource(EchoIcons.GraphicEq), null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.onPrimary)
        }
        Spacer(Modifier.height(EchoSpacing.xxl))
        Text("Echo", style = MaterialTheme.typography.displaySmall)
        Text(tagline, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        Spacer(Modifier.height(EchoSpacing.xxxl))
        Text(version, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@EchoPreviews
@Composable
private fun ProfileAndOnboardingPreview() = EchoThemesPreview {
    ProfileHeader("Pat", "Your profile · saved on this device", AvatarChoice.Initial)
    AvatarPicker("Pat", selected = AvatarChoice.Initial, onSelect = {})
    ThemePreviews(listOf("Light", "Dark", "Pure black"), selected = 1, onSelect = {})
    PageIndicatorRow()
}

@Composable
private fun PageIndicatorRow() = Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
    app.echo.designsystem.component.m3e.PageIndicator(3, 0)
}

@EchoPreviews
@Composable
private fun SplashAndIllustrationPreview() = EchoThemesPreview {
    OnboardingIllustration(EchoIcons.LibraryMusic)
    Box(Modifier.height(320.dp)) { EchoSplash("Listen · Read · Watch", "v0.1.0") }
}

