package app.echo.data.repository

import app.echo.data.model.AiSubtitleSettings
import app.echo.data.model.AsmrSettings
import app.echo.data.model.JavSettings
import app.echo.data.model.PlaybackSettings
import app.echo.data.model.Profile
import app.echo.data.model.ReaderSettings
import app.echo.data.model.Settings
import app.echo.data.model.ThemeSettings
import app.echo.data.model.UpdateSettings
import kotlinx.coroutines.flow.Flow

/**
 * App settings (DataStore `settings`). Every group is a [Flow] and has an `update { copy(…) }` function, so S.8 and
 * O.8 (both write the theme) can't disagree. Screens never see DataStore keys.
 */
interface SettingsRepository {
    val settings: Flow<Settings>
    val theme: Flow<ThemeSettings>

    suspend fun updateTheme(transform: ThemeSettings.() -> ThemeSettings)
    suspend fun updatePlayback(transform: PlaybackSettings.() -> PlaybackSettings)
    suspend fun updateReader(transform: ReaderSettings.() -> ReaderSettings)
    suspend fun updateAsmr(transform: AsmrSettings.() -> AsmrSettings)
    suspend fun updateJav(transform: JavSettings.() -> JavSettings)
    suspend fun updateUpdates(transform: UpdateSettings.() -> UpdateSettings)
    suspend fun updateAiSubtitles(transform: AiSubtitleSettings.() -> AiSubtitleSettings)
    suspend fun setLastSource(sourceId: String)

    /** S.7 Clear all data. */
    suspend fun clear()
}

/** The local profile (DataStore `profile`). */
interface ProfileRepository {
    val profile: Flow<Profile>

    suspend fun update(transform: Profile.() -> Profile)

    /** S.7 Clear all data: back to a fresh install (onboarding runs again). */
    suspend fun clear()
}
