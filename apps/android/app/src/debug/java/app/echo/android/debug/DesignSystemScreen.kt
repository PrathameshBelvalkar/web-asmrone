package app.echo.android.debug

import android.os.Build
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.theme.EchoShapes
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.theme.LocalEchoTheme
import app.echo.designsystem.theme.PlayerTheme
import app.echo.designsystem.theme.SamplePlayerSeed
import app.echo.designsystem.theme.ThemeConfig
import app.echo.designsystem.theme.ThemeMode
import app.echo.designsystem.tokens.EchoElevation
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing
import app.echo.designsystem.tokens.EchoStateLayers

/**
 * Phase 1 catalogue (design.md §6.8): one section per Figma 5 · Design system frame, rendered with the real
 * tokens. Phase 1 is done when this matches the DS frames side by side. The chips at the top switch the theme
 * live, so the colour animation and the pure black rules can be checked too.
 *
 * Debug only. Spec labels are written inline (not strings.xml) because this screen is a developer tool.
 */
@Composable
fun DesignSystemScreen(initial: ThemeConfig = ThemeConfig(dynamicColor = false)) {
    var config by remember { mutableStateOf(initial) }
    EchoTheme(config) {
        DesignSystemContent(config = config, onConfig = { config = it })
    }
}

/** The sections, in Figma order. Also used by the screenshot tests one at a time. */
enum class DsSection(val title: String) {
    Colour("Colour & theme switching"),
    Typography("Typography"),
    Shape("Shape"),
    Spacing("Spacing, padding & layout"),
    Components("Component sizes, elevation & states"),
    Motion("Motion & icons"),
    Gallery("Components (Phase 2)"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DesignSystemContent(config: ThemeConfig, onConfig: (ThemeConfig) -> Unit) {
    Scaffold(
        modifier = Modifier.testTag("screen:ds"),
        topBar = { TopAppBar(title = { Text("Design system") }) },
    ) { padding ->
        Column(
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(padding)
                .padding(start = EchoSpacing.screenMargin, end = EchoSpacing.screenMargin, bottom = EchoSpacing.xxxl),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.s),
        ) {
            ThemeControls(config, onConfig)
            DsSection.entries.forEach { section -> DsSectionContent(section) }
        }
    }
}

/** One section, as in its Figma frame. */
@Composable
private fun DsSectionContent(section: DsSection) {
    Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        SectionTitle(section.title)
        when (section) {
            DsSection.Colour -> ColourSection()
            DsSection.Typography -> TypographySection()
            DsSection.Shape -> ShapeSection()
            DsSection.Spacing -> SpacingSection()
            DsSection.Components -> ComponentsSection()
            DsSection.Motion -> MotionSection()
            DsSection.Gallery -> ComponentGallery()
        }
    }
}

/** A single section, for the screenshot tests. */
@Composable
fun DesignSystemSection(section: DsSection, config: ThemeConfig) {
    EchoTheme(config) {
        Surface {
            Column(Modifier.fillMaxSize().padding(EchoSpacing.screenMargin)) { DsSectionContent(section) }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Theme controls

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ThemeControls(config: ThemeConfig, onConfig: (ThemeConfig) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.chipGap)) {
            ThemeMode.entries.forEach { mode ->
                FilterChip(
                    selected = config.mode == mode,
                    onClick = { onConfig(config.copy(mode = mode)) },
                    label = { Text(mode.name.lowercase().replaceFirstChar { it.uppercase() }) },
                )
            }
        }
        SwitchRow("Dynamic colour", config.dynamicColor, enabled = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            onConfig(config.copy(dynamicColor = it))
        }
        SwitchRow("Pure black", config.pureBlack, enabled = isDarkTheme()) { onConfig(config.copy(pureBlack = it)) }
        SwitchRow("Animations", config.animations) { onConfig(config.copy(animations = it)) }
    }
}

/** Pure black only applies in dark (design.md §7.3), so its switch is greyed out in light. */
@Composable
private fun isDarkTheme() = LocalEchoTheme.current.isDark

@Composable
private fun SwitchRow(label: String, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = EchoSizes.minTouchTarget),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange, enabled = enabled)
    }
}

@Composable
private fun SectionTitle(text: String) {
    Column {
        Spacer(Modifier.height(EchoSpacing.xxl))
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Spacer(Modifier.height(EchoSpacing.xxl))
        Text(text, style = MaterialTheme.typography.headlineMedium)
    }
}

@Composable
private fun SubTitle(text: String, note: String? = null) {
    Column(Modifier.padding(top = EchoSpacing.l)) {
        Text(text, style = MaterialTheme.typography.titleMedium)
        if (note != null) Text(note, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun Caption(text: String, modifier: Modifier = Modifier) = Text(
    text,
    modifier = modifier,
    style = MaterialTheme.typography.bodySmall,
    color = MaterialTheme.colorScheme.onSurfaceVariant,
)

// ---------------------------------------------------------------------------------------------------------------
// DS · Colour

@Composable
private fun ColourSection() {
    SubTitle("Theme modes", "Every mode is the same set of roles; only the values change.")
    ThemeModeCard("Light", "System or user choice", ThemeConfig(mode = ThemeMode.LIGHT, dynamicColor = false))
    ThemeModeCard("Dark", "System or user choice", ThemeConfig(mode = ThemeMode.DARK, dynamicColor = false))
    ThemeModeCard(
        "Pure black (AMOLED)", "Dark + surface/background #000000",
        ThemeConfig(mode = ThemeMode.DARK, dynamicColor = false, pureBlack = true),
    )
    ThemeModeCard(
        "Dynamic colour", "This device's wallpaper · Android 12+ · default ON",
        ThemeConfig(mode = ThemeMode.LIGHT, dynamicColor = true),
    )
    ThemeModeCard(
        "Dynamic player colour", "Example cover · full player only",
        ThemeConfig(mode = ThemeMode.LIGHT, dynamicColor = false), SamplePlayerSeed,
    )
    SubTitle("Colour roles", "MaterialTheme.colorScheme.<role> · current theme")
    colourRoles.forEach { role -> ColourRoleRow(role) }
}

@Composable
private fun ThemeModeCard(title: String, subtitle: String, config: ThemeConfig, playerSeed: Color? = null) {
    EchoTheme(config) {
        PlayerTheme(playerSeed) {
            Surface(
                shape = MaterialTheme.shapes.extraLarge,
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(EchoSpacing.l), verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
                    Column {
                        Text(title, style = MaterialTheme.typography.titleMedium)
                        Caption(subtitle)
                    }
                    Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.surfaceContainer) {
                        Row(
                            Modifier.fillMaxWidth().padding(EchoSpacing.s),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
                        ) {
                            Box(
                                Modifier.size(EchoSizes.Button.s).clip(MaterialTheme.shapes.small)
                                    .background(MaterialTheme.colorScheme.primaryContainer),
                            )
                            Column(Modifier.weight(1f)) {
                                Text("Track title", style = MaterialTheme.typography.titleSmall)
                                Caption("Artist")
                            }
                            FilledIconButton(onClick = {}, shape = MaterialTheme.shapes.medium) {
                                Icon(painterResource(EchoIcons.PlayArrowFilled), contentDescription = "Play")
                            }
                        }
                    }
                    Button(onClick = {}) { Text("Play") }
                }
            }
        }
    }
}

private class ColourRole(val name: String, val use: String, val get: @Composable () -> Color)

private val colourRoles = listOf(
    ColourRole("primary", "Filled buttons, active nav pill, FAB, slider, progress") { MaterialTheme.colorScheme.primary },
    ColourRole("onPrimary", "Text/icons on primary") { MaterialTheme.colorScheme.onPrimary },
    ColourRole("primaryContainer", "Selected list item, toggles on, mini-player art fallback") { MaterialTheme.colorScheme.primaryContainer },
    ColourRole("onPrimaryContainer", "Text on primary container") { MaterialTheme.colorScheme.onPrimaryContainer },
    ColourRole("secondaryContainer", "Tonal buttons, nav active indicator, selected chips") { MaterialTheme.colorScheme.secondaryContainer },
    ColourRole("onSecondaryContainer", "Text on tonal buttons") { MaterialTheme.colorScheme.onSecondaryContainer },
    ColourRole("tertiaryContainer", "Accents: NEW / BETA badges, highlights") { MaterialTheme.colorScheme.tertiaryContainer },
    ColourRole("error", "Errors, destructive actions (Clear all data)") { MaterialTheme.colorScheme.error },
    ColourRole("surface", "Screen background") { MaterialTheme.colorScheme.surface },
    ColourRole("onSurface", "Primary text and icons") { MaterialTheme.colorScheme.onSurface },
    ColourRole("onSurfaceVariant", "Secondary text, inactive icons") { MaterialTheme.colorScheme.onSurfaceVariant },
    ColourRole("surfaceContainerLow", "Segmented list tiles, cards") { MaterialTheme.colorScheme.surfaceContainerLow },
    ColourRole("surfaceContainer", "Navigation bar, mini player") { MaterialTheme.colorScheme.surfaceContainer },
    ColourRole("surfaceContainerHigh", "Bottom sheets, menus, dialogs") { MaterialTheme.colorScheme.surfaceContainerHigh },
    ColourRole("surfaceContainerHighest", "Search bar, text fields, chips (filled)") { MaterialTheme.colorScheme.surfaceContainerHighest },
    ColourRole("outline", "Text field borders, outlined buttons") { MaterialTheme.colorScheme.outline },
    ColourRole("outlineVariant", "Dividers, chip borders") { MaterialTheme.colorScheme.outlineVariant },
    ColourRole("inverseSurface", "Snackbars") { MaterialTheme.colorScheme.inverseSurface },
    ColourRole("scrim", "Behind sheets and dialogs (32%)") { MaterialTheme.colorScheme.scrim },
)

@Composable
private fun ColourRoleRow(role: ColourRole) {
    val color = role.get()
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
        Box(
            Modifier.size(EchoSizes.Button.s).clip(MaterialTheme.shapes.small).background(color)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, MaterialTheme.shapes.small),
        )
        Column(Modifier.weight(1f)) {
            Row {
                Text(role.name, style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
                Text(color.hex(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Caption(role.use)
        }
    }
}

private fun Color.hex() = "#%06X".format(toArgb() and 0xFFFFFF)

// ---------------------------------------------------------------------------------------------------------------
// DS · Typography

private class TypeRow(val name: String, val spec: String, val use: String, val style: @Composable () -> TextStyle)

private val typeRows = listOf(
    TypeRow("Display Large", "57/64 · -0.25", "—") { MaterialTheme.typography.displayLarge },
    TypeRow("Display Medium", "45/52 · 0", "—") { MaterialTheme.typography.displayMedium },
    TypeRow("Display Small", "36/44 · 0", "End of gallery “You finished it”") { MaterialTheme.typography.displaySmall },
    TypeRow("Headline Large", "32/40 · 0", "Large flexible app bar title") { MaterialTheme.typography.headlineLarge },
    TypeRow("Headline Medium", "28/36 · 0", "Medium flexible app bar title") { MaterialTheme.typography.headlineMedium },
    TypeRow("Headline Small", "24/32 · 0", "Full player track title") { MaterialTheme.typography.headlineSmall },
    TypeRow("Title Large", "22/28 · 0", "Small app bar title, shelf headers") { MaterialTheme.typography.titleLarge },
    TypeRow("Title Medium", "16/24 · 0.15", "List item headline, mini player title") { MaterialTheme.typography.titleMedium },
    TypeRow("Title Small", "14/20 · 0.1", "Card titles") { MaterialTheme.typography.titleSmall },
    TypeRow("Body Large", "16/24 · 0.5", "Lyrics (past/next lines), descriptions") { MaterialTheme.typography.bodyLarge },
    TypeRow("Body Medium", "14/20 · 0.25", "Supporting text") { MaterialTheme.typography.bodyMedium },
    TypeRow("Body Small", "12/16 · 0.4", "Meta lines (artist · duration)") { MaterialTheme.typography.bodySmall },
    TypeRow("Label Large", "14/20 · 0.1", "Buttons, tabs, chips") { MaterialTheme.typography.labelLarge },
    TypeRow("Label Medium", "12/16 · 0.5", "Nav bar labels, badges") { MaterialTheme.typography.labelMedium },
    TypeRow("Label Small", "11/16 · 0.5", "Overlines (PLAYING FROM)") { MaterialTheme.typography.labelSmall },
)

@Composable
private fun TypographySection() {
    Caption("Roboto (system default) for every style. Sizes in sp: size/line · tracking.")
    typeRows.forEach { row ->
        Column(Modifier.padding(vertical = EchoSpacing.xs)) {
            Row {
                Text(row.name, style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
                Caption(row.spec)
            }
            val sample = if (row.name.startsWith("Display") || row.name == "Headline Large") "Echo" else "Whispered bedtime story"
            Text(sample, style = row.style(), maxLines = 1)
            Caption(row.use)
        }
    }
    run {
        SubTitle("Emphasized styles", "Same sizes, heavier weight: typography.titleLargeEmphasized")
        Column(Modifier.padding(top = EchoSpacing.s)) {
            Caption("Baseline · Title Large")
            Text("Close your eyes for me.", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(EchoSpacing.s))
            Caption("Emphasized · Title Large")
            Text("Close your eyes for me.", style = MaterialTheme.typography.titleLargeEmphasized)
            Spacer(Modifier.height(EchoSpacing.s))
            Caption("Japanese text: Noto Sans JP via system fallback, one step smaller")
            Text("Whispered bedtime story", style = MaterialTheme.typography.bodyLarge)
            Text("おやすみなさいの囁き", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// DS · Shape

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ShapeSection() {
    val shapes = MaterialTheme.shapes
    val scale: List<Triple<String, String, Shape>> = listOf(
        Triple("None", "0 dp", EchoShapes.None),
        Triple("Extra small", "4 dp", shapes.extraSmall),
        Triple("Small", "8 dp", shapes.small),
        Triple("Medium", "12 dp", shapes.medium),
        Triple("Large", "16 dp", shapes.large),
        Triple("Large increased", "20 dp", shapes.largeIncreased),
        Triple("Extra large", "28 dp", shapes.extraLarge),
        Triple("Extra large increased", "32 dp", shapes.extraLargeIncreased),
        Triple("Extra extra large", "48 dp", shapes.extraExtraLarge),
        Triple("Full", "fully rounded", EchoShapes.Full),
    )
    Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
        Caption("M3 Expressive corner radius scale (10 steps). Toggles morph round ↔ square on press or selection.")
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.l),
        ) {
            scale.forEach { (name, value, shape) ->
                Column(Modifier.width(SHAPE_TILE), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier.size(SHAPE_TILE).clip(shape).background(MaterialTheme.colorScheme.primaryContainer)
                            .border(1.dp, MaterialTheme.colorScheme.primary, shape),
                    )
                    Text(name, style = MaterialTheme.typography.labelMedium, maxLines = 2)
                    Caption(value)
                }
            }
        }
    }
}

private val SHAPE_TILE = 96.dp

// ---------------------------------------------------------------------------------------------------------------
// DS · Spacing

@Composable
private fun SpacingSection() {
    val scale = listOf(
        EchoSpacing.xxs to "Gap between segmented list items, connected buttons",
        EchoSpacing.xs to "Icon ↔ label in nav items, tiny gaps",
        EchoSpacing.s to "Chip gap, button-group gap, text stack gap",
        EchoSpacing.m to "Cover row gap, list item icon ↔ text",
        EchoSpacing.l to "Screen margin (compact), list item padding, card padding",
        EchoSpacing.xl to "Card padding (large), sheet side padding",
        EchoSpacing.xxl to "Section padding, dialog padding",
        EchoSpacing.xxxl to "Gap between shelves on big screens",
        EchoSizes.minTouchTarget to "Min touch target",
        EchoSizes.appBarSmall to "App bar height (small)",
    )
    Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
        Caption("Everything sits on a 4 dp grid. Compact phones use 16 dp side margins.")
        scale.forEach { (dp, use) ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${dp.value.toInt()}", style = MaterialTheme.typography.labelLarge, modifier = Modifier.width(32.dp))
                Box(Modifier.width(dp).height(EchoSpacing.l).background(MaterialTheme.colorScheme.primary))
                Spacer(Modifier.width(EchoSpacing.m))
                Caption(use, Modifier.weight(1f))
            }
        }
        SubTitle(
            "Phone layout (compact)",
            "Margins 16 · app bar 64 / 112 / 152 · navigation bar 64 + gesture area · mini player 8 above the nav bar",
        )
        PhoneLayoutDiagram()
    }
}

@Composable
private fun PhoneLayoutDiagram() {
    val c = MaterialTheme.colorScheme
    Surface(shape = MaterialTheme.shapes.extraLarge, border = BorderStroke(1.dp, c.outlineVariant)) {
        Column(Modifier.fillMaxWidth().padding(EchoSpacing.s), verticalArrangement = Arrangement.spacedBy(EchoSpacing.xs)) {
            DiagramBar("Status bar", 24.dp, c.surfaceContainerHighest)
            DiagramBar("App bar · 64", EchoSizes.appBarSmall, c.surfaceContainer)
            Box(Modifier.fillMaxWidth().height(160.dp).background(c.surface).border(1.dp, c.outlineVariant)) {
                Box(Modifier.fillMaxSize().padding(horizontal = EchoSpacing.screenMargin).background(c.primaryContainer.copy(alpha = 0.4f))) {
                    Caption("Content · margins 16", Modifier.align(Alignment.Center))
                }
            }
            DiagramBar("Mini player", EchoSizes.appBarSmall, c.surfaceContainer, shape = MaterialTheme.shapes.extraLarge)
            Spacer(Modifier.height(EchoSpacing.miniPlayerAboveNavBar - EchoSpacing.xs))
            DiagramBar("Navigation bar · 64", EchoSizes.navigationBarHeight, c.surfaceContainer)
        }
    }
}

@Composable
private fun DiagramBar(label: String, height: Dp, color: Color, shape: Shape = EchoShapes.None) {
    Box(Modifier.fillMaxWidth().height(height).clip(shape).background(color), contentAlignment = Alignment.Center) {
        Caption(label)
    }
}

// ---------------------------------------------------------------------------------------------------------------
// DS · Components

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ComponentsSection() {
    Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
        Caption("Minimum touch target is 48 × 48 dp even when the visible element is smaller.")
        SubTitle("Buttons & icon buttons", "Same five sizes for buttons, icon buttons, toggle, split buttons and button groups.")
        val sizes = listOf(
            Triple("XS · 32 dp", "Inline actions", EchoSizes.Button.xs),
            Triple("S · 40 dp", "Default · lists, toolbars", EchoSizes.Button.s),
            Triple("M · 56 dp", "Media page Play / Shuffle", EchoSizes.Button.m),
            Triple("L · 96 dp", "Full player play/pause", EchoSizes.Button.l),
            Triple("XL · 136 dp", "Hero moments", EchoSizes.Button.xl),
        )
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.l),
            itemVerticalAlignment = Alignment.Bottom,
        ) {
            sizes.forEach { (label, use, height) ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    SizedButton(height)
                    Text(label, style = MaterialTheme.typography.labelMedium)
                    Caption(use)
                }
            }
        }
        SubTitle("Sizes")
        listOf(
            "Chips" to "32 dp · 8 dp radius",
            "Text field" to "56 dp · outlined, 4 dp top radius",
            "Search bar" to "56 dp · full radius",
            "List item" to "56 / 72 / 88 dp · 16 dp side padding",
            "Navigation bar (flexible)" to "64 dp · indicator 56 × 32 dp",
            "FAB / Extended FAB" to "56 dp · 16 dp radius",
            "Icons" to "24 dp (20 in chips and S buttons)",
            "Avatar" to "40 dp (app bar) · 96 dp (artist) · profile 36 + 2 ring",
            "Slider" to "44 dp handle · 16 dp track (XS)",
            "Bottom sheet" to "Handle 32 × 4 · 28 dp top radius · scrim 32%",
        ).forEach { (name, size) ->
            Row(Modifier.fillMaxWidth()) {
                Text(name, style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
                Caption(size, Modifier.weight(1.4f))
            }
        }
        SubTitle("Elevation levels", "Prefer tonal surfaces; shadows only for floating things.")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m), verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
            listOf(
                Triple("Level 0 · 0 dp", "Screens", EchoElevation.level0),
                Triple("Level 1 · 1 dp", "Cards", EchoElevation.level1),
                Triple("Level 2 · 3 dp", "Nav bar, menus", EchoElevation.level2),
                Triple("Level 3 · 6 dp", "FAB, mini player", EchoElevation.level3),
                Triple("Level 4 · 8 dp", "Hover", EchoElevation.level4),
                Triple("Level 5 · 12 dp", "Dragged", EchoElevation.level5),
            ).forEach { (label, use, elevation) ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Surface(
                        modifier = Modifier.size(width = 104.dp, height = 72.dp),
                        shape = MaterialTheme.shapes.medium,
                        shadowElevation = elevation,
                        color = MaterialTheme.colorScheme.surface,
                    ) {}
                    Spacer(Modifier.height(EchoSpacing.s))
                    Text(label, style = MaterialTheme.typography.labelMedium)
                    Caption(use)
                }
            }
        }
        SubTitle("State layers", "A layer of the content colour on top of the container.")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s), verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
            listOf(
                "Enabled" to 0f,
                "Hover" to EchoStateLayers.HOVER,
                "Focus" to EchoStateLayers.FOCUS,
                "Pressed" to EchoStateLayers.PRESSED,
                "Dragged" to EchoStateLayers.DRAGGED,
            ).forEach { (name, alpha) -> StateChip(name, "${(alpha * 100).toInt()}%", alpha) }
            StateChip("Disabled", "12% · 38%", 0f, disabled = true)
        }
    }
}

@Composable
private fun SizedButton(height: Dp) {
    val type = when {
        height >= EchoSizes.Button.xl -> MaterialTheme.typography.headlineLarge
        height >= EchoSizes.Button.l -> MaterialTheme.typography.headlineSmall
        height >= EchoSizes.Button.m -> MaterialTheme.typography.titleMedium
        else -> MaterialTheme.typography.labelLarge
    }
    Button(
        onClick = {},
        modifier = Modifier.height(height),
        contentPadding = PaddingValues(horizontal = height / 2.5f),
    ) { Text("Play", style = type) }
}

@Composable
private fun StateChip(name: String, value: String, alpha: Float, disabled: Boolean = false) {
    val c = MaterialTheme.colorScheme
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        val container = if (disabled) c.onSurface.copy(alpha = EchoStateLayers.DISABLED_CONTAINER) else c.secondaryContainer
        val content = if (disabled) c.onSurface.copy(alpha = EchoStateLayers.DISABLED_CONTENT) else c.onSecondaryContainer
        Box(
            Modifier.clip(EchoShapes.Full).background(container)
                .background(c.onSecondaryContainer.copy(alpha = alpha))
                .padding(horizontal = EchoSpacing.l, vertical = EchoSpacing.s),
        ) { Text("Label", style = MaterialTheme.typography.labelLarge, color = content) }
        Text(name, style = MaterialTheme.typography.labelMedium)
        Caption(value)
    }
}

// ---------------------------------------------------------------------------------------------------------------
// DS · Motion & icons

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MotionSection() {
    val motion = MaterialTheme.motionScheme
    var moved by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
        Caption("Springs, not durations. Spatial = position, size, shape (may overshoot). Effects = colour, opacity (never overshoots). Tap to play.")
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val travel = maxWidth - EchoSizes.Button.s - 160.dp
            Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                listOf(
                    "Fast spatial" to motion.fastSpatialSpec<Dp>(),
                    "Default spatial" to motion.defaultSpatialSpec<Dp>(),
                    "Slow spatial" to motion.slowSpatialSpec<Dp>(),
                ).forEach { (name, spec) ->
                    val x by animateDpAsState(if (moved) travel else 0.dp, spec, label = name)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(name, style = MaterialTheme.typography.labelLarge, modifier = Modifier.width(160.dp))
                        Box(
                            Modifier.offset(x = x).size(EchoSizes.Button.s).clip(EchoShapes.Full)
                                .background(MaterialTheme.colorScheme.primary),
                        )
                    }
                }
                val tint by animateColorAsState(
                    if (moved) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.primaryContainer,
                    motion.defaultEffectsSpec(),
                    label = "effects",
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Default effects", style = MaterialTheme.typography.labelLarge, modifier = Modifier.width(160.dp))
                    Box(Modifier.height(EchoSizes.Button.s).weight(1f).clip(EchoShapes.Full).background(tint))
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m), verticalAlignment = Alignment.CenterVertically) {
            Button(onClick = { moved = !moved }) { Text("Play motion") }
            MorphButton()
            Caption("← press: shape morph 12 → 16 dp")
        }
        SubTitle("Icons", "Material Symbols Rounded · 24 dp · weight 400. Outlined inactive, filled selected.")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.xs), verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
            EchoIcons.All.forEach { icon ->
                Column(Modifier.width(ICON_TILE), horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(horizontalArrangement = Arrangement.spacedBy(EchoSpacing.xs)) {
                        Icon(painterResource(icon.outlined), contentDescription = icon.name, modifier = Modifier.size(EchoSizes.icon))
                        Icon(painterResource(icon.filled), contentDescription = null, modifier = Modifier.size(EchoSizes.icon))
                    }
                    Text(
                        icon.name,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Normal),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

private val ICON_TILE = 72.dp

/** Square play/pause morph: medium (12) at rest → large (16) pressed, on the fast spatial spring. */
@Composable
private fun MorphButton() {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val radius by animateDpAsState(if (pressed) 16.dp else 12.dp, MaterialTheme.motionScheme.fastSpatialSpec(), label = "morph")
    FilledIconButton(
        onClick = {},
        shape = RoundedCornerShape(radius),
        interactionSource = interaction,
        modifier = Modifier.size(EchoSizes.Button.m),
    ) { Icon(painterResource(EchoIcons.PlayArrowFilled), contentDescription = "Play") }
}

