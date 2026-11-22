package app.echo.data.model

/*
 * Settings stored in DataStore (`settings`), design.md §9.2. Defaults here are the app's defaults.
 */

enum class ThemeMode { SYSTEM, LIGHT, DARK }

/** S.8 Look and feel / O.8 Make it yours. */
data class ThemeSettings(
    val mode: ThemeMode = ThemeMode.SYSTEM,
    val dynamicColor: Boolean = true,
    val pureBlack: Boolean = false,
    /** ARGB. #6750A4 is the M3 baseline seed (the exact Figma scheme). */
    val seedColor: Long = BASELINE_SEED,
    val dynamicPlayerColor: Boolean = true,
    val blurredPlayerBackground: Boolean = true,
    val biggerCovers: Boolean = false,
    val animations: Boolean = true,
) {
    companion object {
        const val BASELINE_SEED: Long = 0xFF6750A4
    }
}

enum class VideoQuality { AUTO, P1080, P720, P480 }

/** S.9 Playback. */
data class PlaybackSettings(
    val defaultSpeed: Float = 1f,
    val skipSeconds: Int = 10,
    val resume: Boolean = true,
    /** A track or video counts as finished this close to its end. */
    val finishedThresholdMs: Long = 2 * 60_000L,
    val finishedThresholdPercent: Int = 5,
    val defaultQuality: VideoQuality = VideoQuality.AUTO,
    val pictureInPicture: Boolean = true,
)

enum class ReadingMode { PAGED_RTL, PAGED_LTR, PAGED_VERTICAL, LONG_STRIP, LONG_STRIP_GAPS, TWO_PAGES }
enum class TapZones { DEFAULT, L_SHAPED, KINDLE, EDGE, OFF }
enum class ScaleType { FIT_SCREEN, FIT_WIDTH, FIT_HEIGHT, ORIGINAL }
enum class ReaderBackground { BLACK, GRAY, WHITE, AUTO }

/** S.10 Reader (defaults) and 2.8 Reader settings. */
data class ReaderSettings(
    val readingMode: ReadingMode = ReadingMode.PAGED_RTL,
    val tapZones: TapZones = TapZones.DEFAULT,
    val scaleType: ScaleType = ScaleType.FIT_SCREEN,
    val cropBorders: Boolean = false,
    val dualPageLandscape: Boolean = true,
    val background: ReaderBackground = ReaderBackground.BLACK,
    val showPageNumber: Boolean = true,
    val keepScreenOn: Boolean = true,
)

/** S.2 Preferences / S.3 Music source. */
data class AsmrSettings(
    val musicSource: String = Sources.asmrOne.id,
    val subtitlesOnly: Boolean = false,
    val sfwOnly: Boolean = false,
    val mirror: String = "asmr-100",
    val translationLanguage: String = "English",
    val homeTags: Set<String> = emptySet(),
)

/** S.5 JAV. */
data class JavSettings(val hideUpcoming: Boolean = false)

enum class UpdateChannel { STABLE, BETA, NIGHTLY }

/** S.13 App updates. */
data class UpdateSettings(
    val channel: UpdateChannel = UpdateChannel.STABLE,
    val autoCheck: Boolean = true,
    val wifiOnly: Boolean = true,
    val showWhatsNew: Boolean = true,
)

/** S.4 AI subtitles (UI only for now). */
data class AiSubtitleSettings(val enabled: Boolean = false, val engine: String = "Whisper", val model: String = "small")

/** Everything in the `settings` DataStore. */
data class Settings(
    val theme: ThemeSettings = ThemeSettings(),
    val playback: PlaybackSettings = PlaybackSettings(),
    val reader: ReaderSettings = ReaderSettings(),
    val asmr: AsmrSettings = AsmrSettings(),
    val jav: JavSettings = JavSettings(),
    val updates: UpdateSettings = UpdateSettings(),
    val aiSubtitles: AiSubtitleSettings = AiSubtitleSettings(),
    /** The source picked last in 0.1; the app starts on its section's Home. */
    val lastSourceId: String = Sources.asmrOne.id,
)
