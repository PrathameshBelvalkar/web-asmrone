package app.echo.android.feature.onboarding

import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.heading
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.PreviewParameter
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.echo.android.AppContainer
import app.echo.android.R
import app.echo.android.feature.settings.avatarChoice
import app.echo.android.feature.settings.key
import app.echo.android.feature.settings.rememberAvatarPhotoPicker
import app.echo.android.navigation.Route
import app.echo.android.navigation.ShellActions
import app.echo.android.ui.echoViewModel
import app.echo.data.fake.FakeUpdates
import app.echo.data.model.Profile
import app.echo.data.model.Section
import app.echo.data.model.ThemeMode
import app.echo.data.model.ThemeSettings
import app.echo.designsystem.component.echo.AvatarCircle
import app.echo.designsystem.component.echo.AvatarPicker
import app.echo.designsystem.component.echo.EchoSplash
import app.echo.designsystem.component.echo.ThemePreviews
import app.echo.designsystem.component.m3e.BadgeStyle
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.component.m3e.ComponentSize
import app.echo.designsystem.component.m3e.CoverBadge
import app.echo.designsystem.component.m3e.EchoButton
import app.echo.designsystem.component.m3e.EchoIconButton
import app.echo.designsystem.component.m3e.IconButtonStyle
import app.echo.designsystem.component.m3e.PageIndicator
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SwitchListItem
import app.echo.designsystem.component.m3e.ValueIndicatorSlider
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.preview.EchoPreviewTheme
import app.echo.designsystem.preview.EchoPreviewThemes
import app.echo.designsystem.preview.EchoScreenPreviews
import app.echo.designsystem.theme.EchoTheme
import app.echo.designsystem.theme.LocalEchoTheme
import app.echo.designsystem.tokens.EchoSpacing
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** The onboarding steps after the welcome pages, in order. [Profile.onboardingStep] stores the index. */
private val Steps = listOf(Route.Welcome(0), Route.ChooseSources, Route.YourProfile, Route.Age, Route.MakeItYours)

private const val STEP_SOURCES = 1
private const val STEP_PROFILE = 2
private const val STEP_AGE = 3
private const val STEP_LOOK = 4

/** Sections ticked the first time O.5 opens (Figma: ASMR and Manga). */
private val DefaultSections = setOf(Section.ASMR, Section.MANGA)

/** What onboarding reads: the profile and the theme. Null until both have loaded. */
data class OnboardingState(val profile: Profile, val theme: ThemeSettings)

/** O.1–O.8. Every answer is saved straight away, so leaving and coming back resumes at the same step. */
class OnboardingViewModel(private val container: AppContainer) : ViewModel() {
    val state: StateFlow<OnboardingState?> = combine(container.profile.profile, container.settings.theme, ::OnboardingState)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun profile(change: Profile.() -> Profile) = viewModelScope.launch { container.profile.update(change) }
    fun theme(change: ThemeSettings.() -> ThemeSettings) = viewModelScope.launch { container.settings.updateTheme(change) }

    /** Moves on to [step], keeping the furthest step reached. */
    fun reach(step: Int, change: Profile.() -> Profile = { this }) = profile {
        change().copy(onboardingStep = maxOf(onboardingStep, step))
    }
}

@Composable
private fun WithOnboarding(content: @Composable (OnboardingState, OnboardingViewModel) -> Unit) {
    val vm = echoViewModel { OnboardingViewModel(it) }
    val state by vm.state.collectAsStateWithLifecycle()
    state?.let { content(it, vm) }
}

/** The frame of O.5–O.8: title and line at the top, the content scrolling, one full-width button at the bottom. */
@Composable
private fun StepFrame(
    code: String,
    @StringRes title: Int,
    @StringRes body: Int,
    button: String,
    onButton: () -> Unit,
    buttonEnabled: Boolean = true,
    gradient: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val background = if (gradient) Brush.verticalGradient(listOf(colors.surfaceContainerHigh, colors.surface)) else null
    Column(
        Modifier.fillMaxSize()
            .then(if (background != null) Modifier.background(background) else Modifier)
            .statusBarsPadding().navigationBarsPadding()
            .testTag("screen:$code"),
    ) {
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(top = EchoSpacing.xxxl),
            verticalArrangement = Arrangement.spacedBy(EchoSpacing.l),
        ) {
            Column(Modifier.padding(horizontal = EchoSpacing.sectionPadding), verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                Text(stringResource(title), style = MaterialTheme.typography.headlineMediumEmphasized, modifier = Modifier.semantics { heading() })
                Text(stringResource(body), style = MaterialTheme.typography.bodyMedium, color = colors.onSurfaceVariant)
            }
            content()
        }
        EchoButton(
            button, onButton,
            Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.sectionPadding, vertical = EchoSpacing.l),
            size = ComponentSize.M, enabled = buttonEnabled,
        )
    }
}

// O.1 Splash ---------------------------------------------------------------------------------------------------------

/** How long the splash stays at least, so it reads as a screen rather than a flash. */
private const val SPLASH_MIN_MS = 900L

@Composable
fun SplashRoute(shell: ShellActions) {
    val vm = echoViewModel { OnboardingViewModel(it) }
    val state by vm.state.collectAsStateWithLifecycle()
    // Stays until the settings have loaded (§7.3), then resumes at the step reached.
    LaunchedEffect(state != null) {
        val profile = state?.profile ?: return@LaunchedEffect
        delay(SPLASH_MIN_MS)
        shell.leaveSplash(Steps.getOrElse(profile.onboardingStep) { Route.Welcome(0) })
    }
    SplashScreen()
}

/** Figma O.1 Splash (29:27967). */
@Composable
fun SplashScreen() = EchoSplash(
    tagline = stringResource(R.string.onboarding_tagline),
    version = stringResource(R.string.onboarding_version, FakeUpdates.installed.version),
    modifier = Modifier.testTag("screen:O.1"),
)

// O.2–O.4 Welcome ----------------------------------------------------------------------------------------------------

private data class WelcomePage(@StringRes val title: Int, @StringRes val body: Int, val art: @Composable () -> Unit)

private val WelcomePages = listOf(
    WelcomePage(R.string.onboarding_welcome_1_title, R.string.onboarding_welcome_1_body) { OneAppArt() },
    WelcomePage(R.string.onboarding_welcome_2_title, R.string.onboarding_welcome_2_body) { SwitchSourcesArt() },
    WelcomePage(R.string.onboarding_welcome_3_title, R.string.onboarding_welcome_3_body) { PickUpArt() },
)

@Composable
fun WelcomeRoute(page: Int, shell: ShellActions) = WithOnboarding { state, vm ->
    WelcomeScreen(
        page = page,
        onDone = {
            // The first time through, O.5 starts with ASMR and Manga ticked.
            val first = state.profile.onboardingStep < STEP_SOURCES
            vm.reach(STEP_SOURCES) { if (first) copy(enabledSections = DefaultSections) else this }
            shell.open(Route.ChooseSources)
        },
    )
}

/** Figma O.2–O.4 Welcome (29:27982, 29:28023, 29:28073): one pager, Skip · Next, then Get started. */
@Composable
fun WelcomeScreen(page: Int, onDone: () -> Unit) {
    val pager = rememberPagerState(initialPage = page) { WelcomePages.size }
    val scope = rememberCoroutineScope()
    val last = pager.currentPage == WelcomePages.lastIndex
    val colors = MaterialTheme.colorScheme
    Column(
        Modifier.fillMaxSize()
            .background(Brush.verticalGradient(listOf(colors.surfaceContainerHigh, colors.surface)))
            .statusBarsPadding().navigationBarsPadding()
            .testTag("screen:O.${pager.currentPage + 2}"),
    ) {
        HorizontalPager(pager, Modifier.weight(1f)) { index ->
            val content = WelcomePages[index]
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                content.art()
                // Figma "Copy": 32 dp sides, 8 dp above, 10 dp between; 30 sp title, 15 sp body.
                Column(
                    Modifier.fillMaxWidth().padding(start = 32.dp, end = 32.dp, top = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        stringResource(content.title),
                        style = MaterialTheme.typography.headlineMediumEmphasized.copy(fontSize = 30.sp, lineHeight = 38.sp),
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        stringResource(content.body),
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp, lineHeight = 20.sp),
                        color = colors.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
        // Figma "Footer": the indicator, 20 dp, then the buttons 12 dp apart; 24 dp sides.
        PageIndicator(WelcomePages.size, pager.currentPage, Modifier.align(Alignment.CenterHorizontally))
        Row(
            Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 20.dp, bottom = EchoSpacing.l),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (!last) {
                EchoButton(stringResource(R.string.onboarding_skip), onDone, style = ButtonStyle.Text, size = ComponentSize.M)
                EchoButton(
                    stringResource(R.string.onboarding_next),
                    { scope.launch { pager.animateScrollToPage(pager.currentPage + 1) } },
                    Modifier.weight(1f), size = ComponentSize.M, icon = EchoIcons.ArrowForward,
                )
            } else {
                EchoButton(stringResource(R.string.onboarding_get_started), onDone, Modifier.weight(1f), size = ComponentSize.M)
            }
        }
    }
}

// O.5 Choose sources -------------------------------------------------------------------------------------------------

private data class SectionChoice(
    val section: Section,
    @StringRes val title: Int,
    @StringRes val body: Int,
    @DrawableRes val icon: Int,
    val beta: Boolean = false,
)

private val SectionChoices = listOf(
    SectionChoice(Section.ASMR, R.string.onboarding_section_asmr, R.string.onboarding_section_asmr_body, EchoIcons.MusicNoteFilled),
    SectionChoice(Section.MANGA, R.string.onboarding_section_manga, R.string.onboarding_section_manga_body, EchoIcons.BookFilled),
    SectionChoice(Section.JAV, R.string.onboarding_section_jav, R.string.onboarding_section_jav_body, EchoIcons.MovieFilled, beta = true),
    SectionChoice(Section.HENTAI, R.string.onboarding_section_hentai, R.string.onboarding_section_hentai_body, EchoIcons.PlayArrowFilled),
)

@Composable
fun ChooseSourcesRoute(shell: ShellActions) = WithOnboarding { state, vm ->
    ChooseSourcesScreen(
        selected = state.profile.enabledSections,
        onToggle = { section -> vm.profile { copy(enabledSections = enabledSections.toggle(section)) } },
        onContinue = { vm.reach(STEP_PROFILE); shell.open(Route.YourProfile) },
    )
}

private fun <T> Set<T>.toggle(item: T) = if (item in this) this - item else this + item

/** Figma O.5 Choose sources (29:28110). Saves `enabledSections` on every tap. */
@Composable
fun ChooseSourcesScreen(selected: Set<Section>, onToggle: (Section) -> Unit, onContinue: () -> Unit) {
    StepFrame(
        "O.5", R.string.onboarding_sources_title, R.string.onboarding_sources_body,
        button = stringResource(R.string.onboarding_continue_selected, selected.size),
        onButton = onContinue, buttonEnabled = selected.isNotEmpty(),
    ) {
        Column(Modifier.padding(horizontal = EchoSpacing.sectionPadding), verticalArrangement = Arrangement.spacedBy(EchoSpacing.m)) {
            SectionChoices.forEach { choice -> SectionCard(choice, choice.section in selected) { onToggle(choice.section) } }
        }
    }
}

/** One O.5 card: icon tile, title (with BETA), the sources, and a checkbox. */
@Composable
private fun SectionCard(choice: SectionChoice, selected: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Surface(
        selected = selected,
        onClick = onClick,
        shape = MaterialTheme.shapes.extraLarge,
        color = if (selected) colors.secondaryContainer else colors.surface,
        contentColor = if (selected) colors.onSecondaryContainer else colors.onSurface,
        border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) colors.onSurfaceVariant else colors.outlineVariant),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(EchoSpacing.l), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EchoSpacing.l)) {
            Box(
                Modifier.size(48.dp).clip(MaterialTheme.shapes.medium)
                    .background(if (selected) colors.inverseSurface else colors.surfaceContainerHighest),
                contentAlignment = Alignment.Center,
            ) {
                Icon(painterResource(choice.icon), null, tint = if (selected) colors.inverseOnSurface else colors.onSurface)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(EchoSpacing.xxs)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
                    Text(stringResource(choice.title), style = MaterialTheme.typography.titleMediumEmphasized)
                    if (choice.beta) CoverBadge(stringResource(R.string.onboarding_beta).uppercase(), style = BadgeStyle.Overlay)
                }
                Text(stringResource(choice.body), style = MaterialTheme.typography.bodySmall, color = colors.onSurfaceVariant)
            }
            Checkbox(checked = selected, onCheckedChange = null)
        }
    }
}

// O.6 Your profile ---------------------------------------------------------------------------------------------------

@Composable
fun YourProfileRoute(shell: ShellActions) = WithOnboarding { state, vm ->
    YourProfileScreen(
        profile = state.profile,
        onProfile = vm::profile,
        onContinue = { vm.reach(STEP_AGE); shell.open(Route.Age) },
    )
}

/** Figma O.6 Your profile (29:28166): name, then an avatar (the "+" picks a photo). */
@Composable
fun YourProfileScreen(profile: Profile, onProfile: (Profile.() -> Profile) -> Unit, onContinue: () -> Unit) {
    // Typed locally and saved as it changes; blank isn't saved, so the field can be cleared and retyped.
    var name by rememberSaveable { mutableStateOf(profile.name) }
    val pickPhoto = rememberAvatarPhotoPicker { photo -> onProfile { copy(avatar = photo.key()) } }
    StepFrame(
        "O.6", R.string.onboarding_profile_title, R.string.onboarding_profile_body,
        button = stringResource(R.string.onboarding_continue), onButton = onContinue, buttonEnabled = name.isNotBlank(),
    ) {
        AvatarCircle(profile.avatarChoice(), name.ifBlank { profile.name }, 88.dp, modifier = Modifier.align(Alignment.CenterHorizontally))
        OutlinedTextField(
            value = name,
            onValueChange = { text ->
                name = text
                if (text.isNotBlank()) onProfile { copy(name = text.trim()) }
            },
            label = { Text(stringResource(R.string.onboarding_your_name)) },
            supportingText = { Text(stringResource(R.string.onboarding_your_name_supporting)) },
            trailingIcon = if (name.isNotEmpty()) {
                { EchoIconButton(EchoIcons.Close, stringResource(R.string.onboarding_clear_name), { name = "" }) }
            } else {
                null
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = EchoSpacing.sectionPadding),
        )
        Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
            Text(
                stringResource(R.string.onboarding_pick_avatar).uppercase(),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = EchoSpacing.sectionPadding),
            )
            AvatarPicker(
                name = name.ifBlank { profile.name },
                selected = profile.avatarChoice(),
                onSelect = { choice -> onProfile { copy(avatar = choice.key()) } },
                onPickPhoto = pickPhoto,
            )
            Text(
                stringResource(R.string.onboarding_photo_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = EchoSpacing.sectionPadding),
            )
        }
    }
}

// O.7 Age ------------------------------------------------------------------------------------------------------------

private const val MIN_AGE = 13
private const val MAX_AGE = 80

/** The big age number (Figma O.7: about 88 sp, larger than displayLarge). */
private val AGE_FONT = 88.sp

@Composable
fun AgeRoute(shell: ShellActions) = WithOnboarding { state, vm ->
    AgeScreen(
        initial = state.profile.age ?: Profile.ADULT_AGE,
        onContinue = { age ->
            // Adults see the adult sections they picked in O.5; under 18 they stay hidden (S.12 can change it).
            vm.reach(STEP_LOOK) { copy(age = age, showAdultSources = age >= Profile.ADULT_AGE) }
            shell.open(Route.MakeItYours)
        },
    )
}

/** Figma O.7 Age (29:28227): the big number, the slider with a mark at 18, −/+ to fine-tune, two notes. */
@Composable
fun AgeScreen(initial: Int, onContinue: (Int) -> Unit) {
    var age by rememberSaveable { mutableIntStateOf(initial) }
    StepFrame(
        "O.7", R.string.onboarding_age_title, R.string.onboarding_age_body,
        button = stringResource(R.string.onboarding_continue), onButton = { onContinue(age) }, gradient = true,
    ) {
        Row(Modifier.align(Alignment.CenterHorizontally), verticalAlignment = Alignment.Bottom) {
            Text(if (age >= MAX_AGE) "$MAX_AGE+" else age.toString(), style = MaterialTheme.typography.displayLargeEmphasized.copy(fontSize = AGE_FONT, lineHeight = AGE_FONT))
            Text(
                stringResource(R.string.onboarding_years),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = EchoSpacing.s, bottom = EchoSpacing.m),
            )
        }
        ValueIndicatorSlider(
            value = age, onValueChange = { age = it }, range = MIN_AGE..MAX_AGE,
            marker = Profile.ADULT_AGE, maxLabel = "$MAX_AGE+",
            modifier = Modifier.padding(horizontal = EchoSpacing.sectionPadding),
        )
        Row(
            Modifier.align(Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
        ) {
            EchoIconButton(
                EchoIcons.Remove, stringResource(R.string.onboarding_age_down), { age = (age - 1).coerceAtLeast(MIN_AGE) },
                style = IconButtonStyle.Tonal, size = ComponentSize.M,
            )
            Text(stringResource(R.string.onboarding_fine_tune), style = MaterialTheme.typography.labelLarge)
            EchoIconButton(
                EchoIcons.Add, stringResource(R.string.onboarding_age_up), { age = (age + 1).coerceAtMost(MAX_AGE) },
                style = IconButtonStyle.Tonal, size = ComponentSize.M,
            )
        }
        Column(Modifier.padding(horizontal = EchoSpacing.sectionPadding), verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
            AgeNote(EchoIcons.Info, R.string.onboarding_age_note_adult)
            AgeNote(EchoIcons.LockFilled, R.string.onboarding_age_note_rules)
        }
    }
}

@Composable
private fun AgeNote(@DrawableRes icon: Int, @StringRes text: Int) {
    Row(
        Modifier.fillMaxWidth().clip(MaterialTheme.shapes.large).background(MaterialTheme.colorScheme.surfaceContainer)
            .padding(EchoSpacing.l),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(EchoSpacing.m),
    ) {
        Icon(painterResource(icon), null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(stringResource(text), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// O.8 Make it yours --------------------------------------------------------------------------------------------------

@Composable
fun MakeItYoursRoute(shell: ShellActions) = WithOnboarding { state, vm ->
    MakeItYoursScreen(state.theme, onTheme = vm::theme, onStart = shell::finishOnboarding)
}

/** Figma O.8 Make it yours (29:28273). Applies live, like S.8; Start exploring finishes onboarding and opens Home. */
@Composable
fun MakeItYoursScreen(theme: ThemeSettings, onTheme: (ThemeSettings.() -> ThemeSettings) -> Unit, onStart: () -> Unit) {
    val isDark = LocalEchoTheme.current.isDark
    val look = when {
        theme.mode == ThemeMode.LIGHT || (theme.mode == ThemeMode.SYSTEM && !isDark) -> 0
        theme.pureBlack -> 2
        else -> 1
    }
    StepFrame(
        "O.8", R.string.onboarding_look_title, R.string.onboarding_look_body,
        button = stringResource(R.string.onboarding_start), onButton = onStart,
    ) {
        ThemePreviews(
            labels = listOf(
                stringResource(R.string.onboarding_theme_light),
                stringResource(R.string.onboarding_theme_dark),
                stringResource(R.string.onboarding_theme_black),
            ),
            selected = look,
            onSelect = { index ->
                onTheme {
                    when (index) {
                        0 -> copy(mode = ThemeMode.LIGHT, pureBlack = false)
                        1 -> copy(mode = ThemeMode.DARK, pureBlack = false)
                        else -> copy(mode = ThemeMode.DARK, pureBlack = true)
                    }
                }
            },
        )
        SegmentedList {
            item {
                SwitchListItem(
                    stringResource(R.string.settings_dynamic_colour), theme.dynamicColor, { on -> onTheme { copy(dynamicColor = on) } },
                    supporting = stringResource(R.string.onboarding_dynamic_colour_summary),
                    enabled = android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S,
                )
            }
            item {
                SwitchListItem(
                    stringResource(R.string.settings_dynamic_player), theme.dynamicPlayerColor,
                    { on -> onTheme { copy(dynamicPlayerColor = on) } },
                    supporting = stringResource(R.string.settings_dynamic_player_summary),
                )
            }
        }
    }
}

// Previews -----------------------------------------------------------------------------------------------------------

@EchoScreenPreviews
@Composable
private fun WelcomeScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface { WelcomeScreen(page = 0, onDone = {}) }
}

@EchoScreenPreviews
@Composable
private fun ChooseSourcesScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface { ChooseSourcesScreen(DefaultSections, {}, {}) }
}

@EchoScreenPreviews
@Composable
private fun AgeScreenPreview(@PreviewParameter(EchoPreviewThemes::class) theme: EchoPreviewTheme) = EchoTheme(theme.config) {
    Surface { AgeScreen(24, {}) }
}
