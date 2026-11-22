package app.echo.data.prefs

import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey

/** DataStore keys, design.md §9.2. The names are stored on disk: never rename one. */
internal object SettingsKeys {
    // Theme
    val themeMode = stringPreferencesKey("themeMode")
    val dynamicColor = booleanPreferencesKey("dynamicColor")
    val pureBlack = booleanPreferencesKey("pureBlack")
    val seedColor = longPreferencesKey("seedColor")
    val dynamicPlayerColor = booleanPreferencesKey("dynamicPlayerColor")
    val blurredPlayerBackground = booleanPreferencesKey("blurredPlayerBackground")
    val biggerCovers = booleanPreferencesKey("biggerCovers")
    val animations = booleanPreferencesKey("animations")

    // Playback
    val defaultSpeed = floatPreferencesKey("defaultSpeed")
    val skipSeconds = intPreferencesKey("skipSeconds")
    val resume = booleanPreferencesKey("resume")
    val finishedThresholdMs = longPreferencesKey("finishedThresholdMs")
    val finishedThresholdPercent = intPreferencesKey("finishedThresholdPercent")
    val defaultQuality = stringPreferencesKey("defaultQuality")
    val pictureInPicture = booleanPreferencesKey("pictureInPicture")

    // Reader defaults
    val readingMode = stringPreferencesKey("readingMode")
    val tapZones = stringPreferencesKey("tapZones")
    val scaleType = stringPreferencesKey("scaleType")
    val cropBorders = booleanPreferencesKey("cropBorders")
    val dualPageLandscape = booleanPreferencesKey("dualPageLandscape")
    val readerBackground = stringPreferencesKey("background")
    val showPageNumber = booleanPreferencesKey("showPageNumber")
    val keepScreenOn = booleanPreferencesKey("keepScreenOn")

    // ASMR source
    val musicSource = stringPreferencesKey("musicSource")
    val subtitlesOnly = booleanPreferencesKey("subtitlesOnly")
    val sfwOnly = booleanPreferencesKey("sfwOnly")
    val mirror = stringPreferencesKey("mirror")
    val translationLanguage = stringPreferencesKey("translationLanguage")
    val homeTags = stringSetPreferencesKey("homeTags")

    // JAV
    val hideUpcoming = booleanPreferencesKey("hideUpcoming")

    // Updates
    val updateChannel = stringPreferencesKey("channel")
    val autoCheck = booleanPreferencesKey("autoCheck")
    val wifiOnly = booleanPreferencesKey("wifiOnly")
    val showWhatsNew = booleanPreferencesKey("showWhatsNew")

    // AI subtitles
    val aiEnabled = booleanPreferencesKey("aiSubtitles.enabled")
    val aiEngine = stringPreferencesKey("aiSubtitles.engine")
    val aiModel = stringPreferencesKey("aiSubtitles.model")

    // Shell
    val lastSource = stringPreferencesKey("lastSource")
}

/** DataStore keys of the `profile` store. */
internal object ProfileKeys {
    val name = stringPreferencesKey("name")
    val avatar = stringPreferencesKey("avatar")
    val age = intPreferencesKey("age")
    val showAdultSources = booleanPreferencesKey("showAdultSources")
    val enabledSections = stringSetPreferencesKey("enabledSections")
    val onboardingDone = booleanPreferencesKey("onboardingDone")
    val firstRunTipShown = booleanPreferencesKey("firstRunTipShown")
}
