package app.echo.data.prefs

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import app.echo.data.model.AiSubtitleSettings
import app.echo.data.model.AsmrSettings
import app.echo.data.model.JavSettings
import app.echo.data.model.PlaybackSettings
import app.echo.data.model.Profile
import app.echo.data.model.ReaderBackground
import app.echo.data.model.ReaderSettings
import app.echo.data.model.ReadingMode
import app.echo.data.model.ScaleType
import app.echo.data.model.Section
import app.echo.data.model.Settings
import app.echo.data.model.TapZones
import app.echo.data.model.ThemeMode
import app.echo.data.model.ThemeSettings
import app.echo.data.model.UpdateChannel
import app.echo.data.model.UpdateSettings
import app.echo.data.model.VideoQuality
import app.echo.data.repository.ProfileRepository
import app.echo.data.repository.SettingsRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.io.IOException
import app.echo.data.prefs.SettingsKeys as K

/** A read that fails (corrupt file, IO) falls back to the defaults instead of crashing. */
private fun DataStore<Preferences>.safeData(): Flow<Preferences> =
    data.catch { if (it is IOException) emit(emptyPreferences()) else throw it }

private inline fun <reified E : Enum<E>> Preferences.enum(key: Preferences.Key<String>, default: E): E =
    this[key]?.let { name -> enumValues<E>().firstOrNull { it.name == name } } ?: default

class DataStoreSettingsRepository(private val store: DataStore<Preferences>) : SettingsRepository {

    override val settings: Flow<Settings> = store.safeData().map { it.toSettings() }.distinctUntilChanged()
    override val theme: Flow<ThemeSettings> = settings.map { it.theme }.distinctUntilChanged()

    private suspend fun edit(write: MutablePreferences.(Settings) -> Unit) {
        store.edit { prefs -> prefs.write(prefs.toSettings()) }
    }

    override suspend fun updateTheme(transform: ThemeSettings.() -> ThemeSettings) = edit { s ->
        val t = s.theme.transform()
        this[K.themeMode] = t.mode.name
        this[K.dynamicColor] = t.dynamicColor
        this[K.pureBlack] = t.pureBlack
        this[K.seedColor] = t.seedColor
        this[K.dynamicPlayerColor] = t.dynamicPlayerColor
        this[K.blurredPlayerBackground] = t.blurredPlayerBackground
        this[K.biggerCovers] = t.biggerCovers
        this[K.animations] = t.animations
    }

    override suspend fun updatePlayback(transform: PlaybackSettings.() -> PlaybackSettings) = edit { s ->
        val p = s.playback.transform()
        this[K.defaultSpeed] = p.defaultSpeed
        this[K.skipSeconds] = p.skipSeconds
        this[K.resume] = p.resume
        this[K.finishedThresholdMs] = p.finishedThresholdMs
        this[K.finishedThresholdPercent] = p.finishedThresholdPercent
        this[K.defaultQuality] = p.defaultQuality.name
        this[K.pictureInPicture] = p.pictureInPicture
    }

    override suspend fun updateReader(transform: ReaderSettings.() -> ReaderSettings) = edit { s ->
        val r = s.reader.transform()
        this[K.readingMode] = r.readingMode.name
        this[K.tapZones] = r.tapZones.name
        this[K.scaleType] = r.scaleType.name
        this[K.cropBorders] = r.cropBorders
        this[K.animatePageTransitions] = r.animatePageTransitions
        this[K.dualPageLandscape] = r.dualPageLandscape
        this[K.readerBackground] = r.background.name
        this[K.showPageNumber] = r.showPageNumber
        this[K.keepScreenOn] = r.keepScreenOn
    }

    override suspend fun updateAsmr(transform: AsmrSettings.() -> AsmrSettings) = edit { s ->
        val a = s.asmr.transform()
        this[K.musicSource] = a.musicSource
        this[K.subtitlesOnly] = a.subtitlesOnly
        this[K.sfwOnly] = a.sfwOnly
        this[K.mirror] = a.mirror
        this[K.translationLanguage] = a.translationLanguage
        this[K.homeTags] = a.homeTags
    }

    override suspend fun updateJav(transform: JavSettings.() -> JavSettings) = edit { s ->
        this[K.hideUpcoming] = s.jav.transform().hideUpcoming
    }

    override suspend fun updateUpdates(transform: UpdateSettings.() -> UpdateSettings) = edit { s ->
        val u = s.updates.transform()
        this[K.updateChannel] = u.channel.name
        this[K.autoCheck] = u.autoCheck
        this[K.wifiOnly] = u.wifiOnly
        this[K.showWhatsNew] = u.showWhatsNew
    }

    override suspend fun updateAiSubtitles(transform: AiSubtitleSettings.() -> AiSubtitleSettings) = edit { s ->
        val a = s.aiSubtitles.transform()
        this[K.aiEnabled] = a.enabled
        this[K.aiEngine] = a.engine
        this[K.aiModel] = a.model
    }

    override suspend fun setLastSource(sourceId: String) {
        store.edit { it[K.lastSource] = sourceId }
    }

    override suspend fun clear() {
        store.edit { it.clear() }
    }

    /** First value, for code that needs settings once (e.g. the splash screen). */
    suspend fun current(): Settings = settings.first()
}

internal fun Preferences.toSettings(): Settings {
    val d = Settings()
    return Settings(
        theme = ThemeSettings(
            mode = enum(K.themeMode, d.theme.mode),
            dynamicColor = this[K.dynamicColor] ?: d.theme.dynamicColor,
            pureBlack = this[K.pureBlack] ?: d.theme.pureBlack,
            seedColor = this[K.seedColor] ?: d.theme.seedColor,
            dynamicPlayerColor = this[K.dynamicPlayerColor] ?: d.theme.dynamicPlayerColor,
            blurredPlayerBackground = this[K.blurredPlayerBackground] ?: d.theme.blurredPlayerBackground,
            biggerCovers = this[K.biggerCovers] ?: d.theme.biggerCovers,
            animations = this[K.animations] ?: d.theme.animations,
        ),
        playback = PlaybackSettings(
            defaultSpeed = this[K.defaultSpeed] ?: d.playback.defaultSpeed,
            skipSeconds = this[K.skipSeconds] ?: d.playback.skipSeconds,
            resume = this[K.resume] ?: d.playback.resume,
            finishedThresholdMs = this[K.finishedThresholdMs] ?: d.playback.finishedThresholdMs,
            finishedThresholdPercent = this[K.finishedThresholdPercent] ?: d.playback.finishedThresholdPercent,
            defaultQuality = enum(K.defaultQuality, VideoQuality.AUTO),
            pictureInPicture = this[K.pictureInPicture] ?: d.playback.pictureInPicture,
        ),
        reader = ReaderSettings(
            readingMode = enum(K.readingMode, ReadingMode.PAGED_RTL),
            tapZones = enum(K.tapZones, TapZones.DEFAULT),
            scaleType = enum(K.scaleType, ScaleType.FIT_SCREEN),
            cropBorders = this[K.cropBorders] ?: d.reader.cropBorders,
            animatePageTransitions = this[K.animatePageTransitions] ?: d.reader.animatePageTransitions,
            dualPageLandscape = this[K.dualPageLandscape] ?: d.reader.dualPageLandscape,
            background = enum(K.readerBackground, ReaderBackground.BLACK),
            showPageNumber = this[K.showPageNumber] ?: d.reader.showPageNumber,
            keepScreenOn = this[K.keepScreenOn] ?: d.reader.keepScreenOn,
        ),
        asmr = AsmrSettings(
            musicSource = this[K.musicSource] ?: d.asmr.musicSource,
            subtitlesOnly = this[K.subtitlesOnly] ?: d.asmr.subtitlesOnly,
            sfwOnly = this[K.sfwOnly] ?: d.asmr.sfwOnly,
            mirror = this[K.mirror] ?: d.asmr.mirror,
            translationLanguage = this[K.translationLanguage] ?: d.asmr.translationLanguage,
            homeTags = this[K.homeTags] ?: d.asmr.homeTags,
        ),
        jav = JavSettings(hideUpcoming = this[K.hideUpcoming] ?: d.jav.hideUpcoming),
        updates = UpdateSettings(
            channel = enum(K.updateChannel, UpdateChannel.STABLE),
            autoCheck = this[K.autoCheck] ?: d.updates.autoCheck,
            wifiOnly = this[K.wifiOnly] ?: d.updates.wifiOnly,
            showWhatsNew = this[K.showWhatsNew] ?: d.updates.showWhatsNew,
        ),
        aiSubtitles = AiSubtitleSettings(
            enabled = this[K.aiEnabled] ?: d.aiSubtitles.enabled,
            engine = this[K.aiEngine] ?: d.aiSubtitles.engine,
            model = this[K.aiModel] ?: d.aiSubtitles.model,
        ),
        lastSourceId = this[K.lastSource] ?: d.lastSourceId,
    )
}

class DataStoreProfileRepository(private val store: DataStore<Preferences>) : ProfileRepository {

    override val profile: Flow<Profile> = store.safeData().map { it.toProfile() }.distinctUntilChanged()

    override suspend fun update(transform: Profile.() -> Profile) {
        store.edit { prefs ->
            val p = prefs.toProfile().transform()
            prefs[ProfileKeys.name] = p.name
            prefs[ProfileKeys.avatar] = p.avatar
            if (p.age != null) prefs[ProfileKeys.age] = p.age else prefs.remove(ProfileKeys.age)
            prefs[ProfileKeys.showAdultSources] = p.showAdultSources
            prefs[ProfileKeys.enabledSections] = p.enabledSections.map { it.name }.toSet()
            prefs[ProfileKeys.onboardingDone] = p.onboardingDone
            prefs[ProfileKeys.firstRunTipShown] = p.firstRunTipShown
        }
    }

    override suspend fun clear() {
        store.edit { it.clear() }
    }
}

internal fun Preferences.toProfile(): Profile {
    val d = Profile()
    return Profile(
        name = this[ProfileKeys.name] ?: d.name,
        avatar = this[ProfileKeys.avatar] ?: d.avatar,
        age = this[ProfileKeys.age],
        showAdultSources = this[ProfileKeys.showAdultSources] ?: d.showAdultSources,
        enabledSections = this[ProfileKeys.enabledSections]
            ?.mapNotNull { name -> Section.entries.firstOrNull { it.name == name } }?.toSet()
            ?: d.enabledSections,
        onboardingDone = this[ProfileKeys.onboardingDone] ?: d.onboardingDone,
        firstRunTipShown = this[ProfileKeys.firstRunTipShown] ?: d.firstRunTipShown,
    )
}
