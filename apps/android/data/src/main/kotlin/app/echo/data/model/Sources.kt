package app.echo.data.model

/** The four sections of the app. The source switcher (0.1) groups sources by these. */
enum class Section {
    ASMR,
    MANGA,
    JAV,
    HENTAI,
    ;

    /** JAV and Hentai are adult-only as a whole. */
    val adult: Boolean get() = this == JAV || this == HENTAI
}

/**
 * A site the user can pick in 0.1 Source switcher. [id] matches `app.echo.core.SourceId.id` where the backend has
 * the source; Hentai (hanime) and Hentai ASMR are UI-only until their scrapers exist.
 */
data class Source(
    val id: String,
    val name: String,
    val description: String,
    val section: Section,
    val adult: Boolean = section.adult,
    val beta: Boolean = false,
)

/** Every source, in switcher order (Figma 0.1). */
object Sources {
    val asmrOne = Source("asmrone", "asmr.one", "Works, tracks, subtitles", Section.ASMR)
    val japaneseAsmr = Source("jnet", "Japanese ASMR", "japaneseasmr.com · browse & play", Section.ASMR)
    val jasmr = Source("jasmr", "JASMR", "jasmr.net · browse & play", Section.ASMR)
    val hentaiAsmr = Source("hasmr", "Hentai ASMR", "hentaiasmr.moe · browse & play", Section.ASMR, adult = true)
    val threeHentai = Source("threehentai", "3hentai", "Galleries · Mihon-style reader", Section.MANGA, adult = true)
    val javDatabase = Source("javdatabase", "javdatabase", "Movies & idols · streams via jav.guru", Section.JAV, beta = true)
    val hanime = Source("hanime", "Hentai", "hanime catalog · videos via hentaibros", Section.HENTAI)

    val all: List<Source> = listOf(asmrOne, japaneseAsmr, jasmr, hentaiAsmr, threeHentai, javDatabase, hanime)

    fun byId(id: String): Source? = all.firstOrNull { it.id == id }
}
