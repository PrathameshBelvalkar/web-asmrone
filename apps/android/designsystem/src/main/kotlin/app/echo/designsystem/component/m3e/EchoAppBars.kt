package app.echo.designsystem.component.m3e

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LargeFlexibleTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MediumFlexibleTopAppBar
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.TopAppBarScrollBehavior
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import app.echo.designsystem.R
import app.echo.designsystem.component.echo.ProfileAvatar
import app.echo.designsystem.component.echo.SourceSwitcherButton
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviews
import app.echo.designsystem.preview.EchoThemesPreview
import app.echo.designsystem.preview.PreviewData
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * Search app bar (Figma "M3E · App bar (Search app bar)", 20 screens): a 56 dp pill search bar holding the
 * [SourceSwitcherButton] and the search placeholder, then the [ProfileAvatar]. Tapping the bar opens the
 * section's search screen; it is not a text field itself. Applies the status bar inset.
 */
@Composable
fun EchoSearchAppBar(
    source: String,
    @DrawableRes sectionIcon: Int,
    profileInitial: String,
    onSearch: () -> Unit,
    onSwitchSource: () -> Unit,
    onProfile: () -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = stringResource(R.string.echo_search_placeholder),
) {
    Row(
        modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(start = EchoSpacing.screenMargin, end = EchoSpacing.m, top = EchoSpacing.s, bottom = EchoSpacing.s),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s),
    ) {
        Surface(
            onClick = onSearch,
            modifier = Modifier.weight(1f).height(EchoSizes.searchBarHeight),
            shape = EchoShapes.Full,
            color = MaterialTheme.colorScheme.surfaceContainerHighest,
        ) {
            Row(
                Modifier.padding(start = EchoSpacing.s - EchoSpacing.xxs, end = EchoSpacing.l),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
            ) {
                SourceSwitcherButton(source, sectionIcon, onClick = onSwitchSource)
                Text(
                    placeholder,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                )
                Icon(
                    painterResource(EchoIcons.Search),
                    contentDescription = stringResource(R.string.echo_cd_search),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(EchoSizes.icon),
                )
            }
        }
        ProfileAvatar(profileInitial, onClick = onProfile)
    }
}

/** Figma "App bar (Medium flexible)" / "(Large flexible)". */
enum class FlexibleAppBarSize { Medium, Large }

/**
 * Flexible app bar (Figma "M3E · App bar (Medium flexible)" 21 screens, "(Large flexible)" 3): title and an
 * optional subtitle that collapse on scroll. Pass `TopAppBarDefaults.exitUntilCollapsedScrollBehavior()`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EchoFlexibleAppBar(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    size: FlexibleAppBarSize = FlexibleAppBarSize.Medium,
    onBack: (() -> Unit)? = null,
    scrollBehavior: TopAppBarScrollBehavior? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val titleContent: @Composable () -> Unit = { Text(title, maxLines = 1) }
    val subtitleContent: @Composable () -> Unit = { if (subtitle != null) Text(subtitle, maxLines = 1) }
    val navigation: @Composable () -> Unit = { if (onBack != null) BackButton(onBack) }
    val colors = TopAppBarDefaults.topAppBarColors(
        containerColor = MaterialTheme.colorScheme.surface,
        scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer,
    )
    when (size) {
        FlexibleAppBarSize.Medium -> MediumFlexibleTopAppBar(
            title = titleContent, modifier = modifier, subtitle = subtitleContent, navigationIcon = navigation,
            actions = actions, colors = colors, scrollBehavior = scrollBehavior,
        )
        FlexibleAppBarSize.Large -> LargeFlexibleTopAppBar(
            title = titleContent, modifier = modifier, subtitle = subtitleContent, navigationIcon = navigation,
            actions = actions, colors = colors, scrollBehavior = scrollBehavior,
        )
    }
}

/** Figma "App bar (Small)", "(Small, centered)", "(Small, transparent over hero)". */
enum class SmallAppBarStyle { Default, Centered, Transparent }

/** Small app bar (Figma "M3E · App bar (Small …)", 15 screens). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EchoSmallAppBar(
    title: String,
    modifier: Modifier = Modifier,
    style: SmallAppBarStyle = SmallAppBarStyle.Default,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    @DrawableRes navigationIcon: Int = EchoIcons.ArrowBack,
    actions: @Composable RowScope.() -> Unit = {},
) {
    val colors = if (style == SmallAppBarStyle.Transparent) {
        TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent, scrolledContainerColor = Color.Transparent)
    } else {
        TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
    }
    val navigation: @Composable () -> Unit = { if (onBack != null) BackButton(onBack, navigationIcon) }
    val titleContent: @Composable () -> Unit = {
        androidx.compose.foundation.layout.Column(
            horizontalAlignment = if (style == SmallAppBarStyle.Centered) Alignment.CenterHorizontally else Alignment.Start,
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge, maxLines = 1)
            if (subtitle != null) {
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
            }
        }
    }
    if (style == SmallAppBarStyle.Centered) {
        CenterAlignedTopAppBar(title = titleContent, modifier = modifier, navigationIcon = navigation, actions = actions, colors = colors)
    } else {
        TopAppBar(title = titleContent, modifier = modifier, navigationIcon = navigation, actions = actions, colors = colors)
    }
}

/** The standard back arrow. Figma layer "icon/back" with the → BACK link. */
@Composable
fun BackButton(onClick: () -> Unit, @DrawableRes icon: Int = EchoIcons.ArrowBack) =
    EchoIconButton(icon, stringResource(R.string.echo_cd_back), onClick, size = ComponentSize.S)

@OptIn(ExperimentalMaterial3Api::class)
@EchoPreviews
@Composable
private fun EchoAppBarsPreview() = EchoThemesPreview {
    EchoSearchAppBar(
        source = PreviewData.SOURCE, sectionIcon = EchoIcons.MusicNote, profileInitial = PreviewData.PROFILE_INITIAL,
        onSearch = {}, onSwitchSource = {}, onProfile = {},
    )
    EchoFlexibleAppBar("Library", subtitle = "asmr.one", onBack = {}) {
        EchoIconButton(EchoIcons.Search, "Search", {})
    }
    EchoSmallAppBar("Now playing", style = SmallAppBarStyle.Centered, subtitle = "From Rainy night library", onBack = {}, navigationIcon = EchoIcons.ExpandMore) {
        EchoIconButton(EchoIcons.MoreVert, "More", {})
    }
}
