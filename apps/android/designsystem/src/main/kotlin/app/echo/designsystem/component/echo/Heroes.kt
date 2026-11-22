package app.echo.designsystem.component.echo

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.echo.designsystem.R
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.tokens.EchoElevation
import app.echo.designsystem.tokens.EchoSpacing

/** Back + actions over an image: tonal icon buttons so they read on any picture (Figma "Icon button (Filled, glass)"). */
@Composable
fun OverlayAppBar(onBack: () -> Unit, modifier: Modifier = Modifier, actions: @Composable RowScope.() -> Unit = {}) {
    Row(
        modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars).padding(horizontal = EchoSpacing.m, vertical = EchoSpacing.xs),
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        EchoIconButton(EchoIcons.ArrowBack, stringResource(R.string.echo_cd_back), onBack, style = IconButtonStyle.Tonal)
        Spacer(Modifier.weight(1f))
        actions()
    }
}

/**
 * Full-bleed article image with a gradient to the surface and an [OverlayAppBar] (Figma "Echo · Article hero
 * (immersive)", 3.2 News post). 300 dp tall.
 */
@Composable
fun ArticleHero(image: Any?, onBack: () -> Unit, modifier: Modifier = Modifier, actions: @Composable RowScope.() -> Unit = {}) {
    Box(modifier.fillMaxWidth().height(300.dp)) {
        CoverImage(image, null, Modifier.fillMaxSize(), shape = null)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, MaterialTheme.colorScheme.surface), startY = 300f)))
        OverlayAppBar(onBack, actions = actions)
    }
}

/**
 * Hentai title hero (Figma "Echo · Title hero (poster backdrop + overlapping cover)", H.7): landscape backdrop
 * fading into the surface, a 2:3 cover overlapping it on the left, and badges / title / [details] to its right.
 */
@Composable
fun TitleHero(
    backdrop: Any?,
    cover: Any?,
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    badges: @Composable RowScope.() -> Unit = {},
    details: @Composable () -> Unit = {},
    actions: @Composable RowScope.() -> Unit = {},
) {
    Box(modifier.fillMaxWidth().height(372.dp)) {
        CoverImage(backdrop, null, Modifier.fillMaxWidth().height(260.dp), shape = null)
        Box(
            Modifier.fillMaxWidth().height(260.dp)
                .background(Brush.verticalGradient(listOf(MaterialTheme.colorScheme.scrim.copy(alpha = 0.3f), MaterialTheme.colorScheme.surface))),
        )
        OverlayAppBar(onBack, actions = actions)
        Row(
            Modifier.align(Alignment.BottomStart).padding(horizontal = EchoSpacing.xl),
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l),
            verticalAlignment = Alignment.Bottom,
        ) {
            CoverImage(
                cover, title,
                Modifier.size(124.dp, 186.dp)
                    .shadow(EchoElevation.level4, MaterialTheme.shapes.largeIncreased)
                    .border(BorderStroke(4.dp, MaterialTheme.colorScheme.surface), MaterialTheme.shapes.largeIncreased),
                shape = MaterialTheme.shapes.largeIncreased,
            )
            Column(Modifier.padding(bottom = EchoSpacing.s), verticalArrangement = Arrangement.spacedBy(EchoSpacing.s - EchoSpacing.xxs)) {
                Row(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s - EchoSpacing.xxs), content = badges)
                Text(title, style = MaterialTheme.typography.titleLargeEmphasized, maxLines = 3, overflow = TextOverflow.Ellipsis)
                details()
            }
        }
    }
}

@EchoPreviews
@Composable
private fun HeroesPreview() = EchoThemesPreview {
    ArticleHero(null, onBack = {}) {
        EchoIconButton(EchoIcons.Bookmark, "Bookmark", {}, style = IconButtonStyle.Tonal)
        EchoIconButton(EchoIcons.Share, "Share", {}, style = IconButtonStyle.Tonal)
    }
    TitleHero(
        backdrop = null, cover = null, title = "Title placeholder that can wrap", onBack = {},
        badges = {
            app.echo.designsystem.component.m3e.CoverBadge("UNCENSORED")
            app.echo.designsystem.component.m3e.CoverBadge("EP 1", style = app.echo.designsystem.component.m3e.BadgeStyle.Accent)
        },
        details = { StudioLink("Studio Name", "507 titles", {}) },
    )
}

