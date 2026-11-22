package app.echo.designsystem.component.m3e

import androidx.annotation.DrawableRes
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.material3.ripple
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoElevation
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/** One destination of the [EchoNavigationBar]. */
data class NavDestination(val label: String, @DrawableRes val icon: Int, @DrawableRes val selectedIcon: Int)

/**
 * Flexible navigation bar, floating, with an expanded active item (Figma "M3E · Navigation bar (Flexible) —
 * floating, expanded active item", 39 screens): a pill on surfaceContainer, 12 dp from the screen edges, with
 * the active destination as a wide primary pill (icon and label side by side) and the others stacked.
 * Applies the navigation bar insets itself.
 */
@Composable
fun EchoNavigationBar(
    destinations: List<NavDestination>,
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(horizontal = EchoSpacing.m, vertical = EchoSpacing.xs),
    ) {
        Surface(
            shape = EchoShapes.Full,
            color = MaterialTheme.colorScheme.surfaceContainer,
            shadowElevation = EchoElevation.level2,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(EchoSpacing.s).selectableGroup(),
                horizontalArrangement = Arrangement.spacedBy(EchoSpacing.xs),
            ) {
                destinations.forEachIndexed { index, destination ->
                    NavItem(
                        destination = destination,
                        selected = index == selected,
                        onClick = { onSelect(index) },
                        modifier = Modifier.weight(if (index == selected) 1.2f else 1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun NavItem(destination: NavDestination, selected: Boolean, onClick: () -> Unit, modifier: Modifier) {
    val colors = MaterialTheme.colorScheme
    val spec = MaterialTheme.motionScheme.fastEffectsSpec<androidx.compose.ui.graphics.Color>()
    val container by animateColorAsState(if (selected) colors.primary else colors.primary.copy(alpha = 0f), spec, label = "nav")
    val content by animateColorAsState(if (selected) colors.onPrimary else colors.onSurfaceVariant, spec, label = "navContent")
    val interaction = remember { MutableInteractionSource() }
    Box(
        modifier
            .height(EchoSizes.navIndicatorWidth)
            .clip(EchoShapes.Full)
            .background(container)
            .selectable(
                selected = selected,
                onClick = onClick,
                role = Role.Tab,
                interactionSource = interaction,
                indication = ripple(),
            ),
        contentAlignment = Alignment.Center,
    ) {
        val icon = painterResource(if (selected) destination.selectedIcon else destination.icon)
        if (selected) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(EchoSizes.icon))
                Spacer(Modifier.width(EchoSpacing.s))
                Text(destination.label, style = MaterialTheme.typography.labelLargeEmphasized, color = content, maxLines = 1)
            }
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(EchoSizes.icon))
                Spacer(Modifier.height(EchoSpacing.xxs))
                Text(destination.label, style = MaterialTheme.typography.labelMedium, color = content, maxLines = 1)
            }
        }
    }
}

/** The three destinations every section has (Home / Search / Library). */
fun sectionDestinations(home: String, search: String, library: String) = listOf(
    NavDestination(home, EchoIcons.Home, EchoIcons.HomeFilled),
    NavDestination(search, EchoIcons.Search, EchoIcons.SearchFilled),
    NavDestination(library, EchoIcons.LibraryMusic, EchoIcons.LibraryMusicFilled),
)

@EchoPreviews
@Composable
private fun EchoNavigationBarPreview() = EchoThemesPreview {
    val destinations = sectionDestinations("Home", "Search", "Library")
    EchoNavigationBar(destinations, selected = 0, onSelect = {})
    EchoNavigationBar(destinations, selected = 2, onSelect = {})
}

