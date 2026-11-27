package app.echo.data.fake

import app.echo.data.model.Artist
import app.echo.data.model.ArtistKind
import app.echo.data.model.Episode
import app.echo.data.model.Gallery
import app.echo.data.model.GenreGroup
import app.echo.data.model.HentaiTag
import app.echo.data.model.HentaiTagCategory
import app.echo.data.model.HentaiTitle
import app.echo.data.model.Idol
import app.echo.data.model.Movie
import app.echo.data.model.NewsCategory
import app.echo.data.model.NewsPost
import app.echo.data.model.Tag
import app.echo.data.model.Track
import app.echo.data.model.Work

/**
 * Placeholder content copied from the Figma frames (design.md rule 4): "Whispered bedtime story", "Circle Aoi",
 * "Gallery title placeholder", "ABC-101", "Title placeholder 1". No images: covers show the grey placeholder.
 */
object FakeCatalog {
    private const val MIN = 60_000L

    // ASMR ------------------------------------------------------------------------------------------------------

    private val trackNames = listOf(
        "Opening, whispered" to 4 * MIN + 12_000, "Ear cleaning (left → right)" to 18 * MIN + 40_000,
        "Rain and heartbeat" to 22 * MIN + 5_000, "Soft tapping" to 12 * MIN, "Brushing" to 15 * MIN + 30_000,
        "Goodnight" to 6 * MIN + 45_000,
    )

    private fun tracksFor(workId: String, artist: String) = trackNames.mapIndexed { i, (name, dur) ->
        Track("$workId-t${i + 1}", workId, "asmrone", "%02d · %s".format(i + 1, name), artist, null, dur)
    }

    private val workSeeds = listOf(
        Triple("Whispered bedtime story", "Circle Aoi", listOf("Aoi Mizuno", "Hana Seto")),
        Triple("Rain on a tin roof", "Studio Komorebi", listOf("Hana Seto")),
        Triple("Soft tapping", "Circle Aoi", listOf("Aoi Mizuno")),
        Triple("Rainy night library", "Studio Komorebi", listOf("Rin Kagami")),
        Triple("Ear cleaning", "Circle Aoi", listOf("Aoi Mizuno")),
        Triple("Train at dusk", "Studio Komorebi", listOf("Rin Kagami", "Hana Seto")),
        Triple("Morning wind-down", "Circle Aoi", listOf("Hana Seto")),
        Triple("Heartbeat and rain", "Studio Komorebi", listOf("Aoi Mizuno")),
    )

    val works: List<Work> = workSeeds.mapIndexed { i, (title, circle, vas) ->
        val id = "w${i + 1}"
        Work(
            id = id, title = title, circle = circle, voiceActors = vas, code = "RJ0123456${i}",
            tags = listOf("Binaural", "Rain", "Ear cleaning", "Whisper").take(2 + i % 3),
            description = "A slow, gentle evening: soft greetings, ear cleaning left and right, and a heartbeat under steady rain.",
            tracks = tracksFor(id, circle),
        )
    }

    /** 1.10 lyrics (Figma), repeated for any track. */
    val lyricLines: List<Pair<String, String?>> = listOf(
        "Good evening… you came back." to "おかえりなさい…",
        "Lie down. I’ll start on your right side." to "横になって。右からね。",
        "Close your eyes for me." to "目を閉じて。",
        "(soft brushing)" to null,
        "That’s it… just breathe." to "そう…ゆっくり息して。",
        "Now, the left side…" to "次は、左ね…",
        "Can you hear the rain?" to "雨の音、聞こえる？",
        "Stay with me a little longer." to "もう少しだけ、ここにいて。",
    ).let { it + it + it }

    val artists: List<Artist> = listOf(
        Artist("a1", "Circle Aoi", 128, kind = ArtistKind.CIRCLE), Artist("a2", "Studio Komorebi", 64, kind = ArtistKind.CIRCLE),
        Artist("a3", "Aoi Mizuno", 312), Artist("a4", "Hana Seto", 97), Artist("a5", "Rin Kagami", 41),
    )

    /** "asmr.one · 1,204 works" on 1.4. */
    const val TOTAL_WORKS = 1204

    // Manga -----------------------------------------------------------------------------------------------------

    val galleries: List<Gallery> = (1..24).map { i ->
        Gallery(
            id = "g$i", title = "Gallery title placeholder that wraps", artist = "Artist Name",
            // g1–g5 match the seeded reading history (p. 34 / 52, 40, 12 / 40, 5 / 24, 24).
            pageCount = listOf(52, 40, 40, 24, 24).getOrElse(i - 1) { 20 + i * 3 },
            language = if (i % 3 == 0) "EN" else "JP",
            // The 2.5 chips (series, characters, group) are tags too, so tapping one finds galleries.
            tags = listOf("Full color", "Romance", "Vanilla").take(1 + i % 3) + listOf("Series name", "Character A", "Character B", "Group name"),
            parodies = listOf("Series name"), characters = listOf("Character A", "Character B"), groups = listOf("Group name"),
        )
    }

    val tags: List<Tag> = ('A'..'Z').flatMap { c -> (1..3).map { n -> Tag("tag-$c$n", "$c tag name $n", 12_480 / n - c.code) } }

    val mangaArtists: List<Tag> = ('A'..'Z').flatMap { c -> (1..2).map { n -> Tag("artist-$c$n", "$c. Artist Name $n", 40 - n * 7) } }

    // JAV -------------------------------------------------------------------------------------------------------

    val idols: List<Idol> = listOf("Aoi Mizuno", "Hana Seto", "Rin Kagami", "Mei Aizawa", "Yui Hoshino", "Sora Amane")
        .mapIndexed { i, name ->
            Idol(
                "i${i + 1}", name, movieCount = 40 + i * 7, debutYear = 2016 + i * 2 % 9, active = i != 4,
                agency = listOf("Agency A", "Agency B", "Agency C")[i % 3],
            )
        }

    /** 3.10 groups (Figma): Format, Story, Setting, then two more. Ids run genre-0 … in this order. */
    val genreGroups: List<GenreGroup> = run {
        val names = listOf(
            "Format" to listOf("VR", "4K", "Debut", "Compilation", "Best-of"),
            "Story" to listOf("Drama", "Comedy", "Romance", "Documentary"),
            "Setting" to listOf("Office", "Travel", "Hotel", "Outdoor"),
            "Style" to listOf("Cosplay", "Uniform", "Retro", "Solo", "Couple"),
            "Mood" to listOf("Sweet", "Slow", "Playful"),
        )
        var n = 0
        names.map { (group, genres) -> GenreGroup(group, genres.map { Tag("genre-${n++}", it, 5000 - n * 150) }) }
    }

    val genres: List<Tag> = genreGroups.flatMap { it.genres }

    /** Released movies, newest first (ABC-101 …), then four upcoming ones (ABC-301 …). */
    val movies: List<Movie> = (1..20).map { i ->
        Movie(
            id = "m$i", code = "ABC-%03d".format(100 + i), title = "Movie title placeholder", studio = "Example Studio",
            releaseDate = "2026-11-%02d".format(21 - i), durationMin = 120,
            idols = idols.map { it.name }.drop(i % 3).take(4),
            genres = (0 until 4).map { k -> genres[(i + k * 5) % genres.size].name }.distinct(),
            sampleImages = List(6) { null }, censored = i % 4 != 0, views = (i * 7919) % 5000, rating = 3f + (i * 13 % 20) / 10f,
        )
    } + (1..4).map { i ->
        Movie(
            id = "u$i", code = "ABC-%03d".format(300 + i), title = "Upcoming title placeholder", studio = "Example Studio",
            releaseDate = "2026-12-%02d".format(3 + (i - 1) * 7), durationMin = 120, idols = listOf(idols[0].name),
            genres = listOf("Drama"), upcoming = true,
        )
    }

    val news: List<NewsPost> = listOf(
        NewsPost("n1", "News headline placeholder that can wrap onto two lines", NewsCategory.RELEASES, "Nov 19", 3),
        NewsPost("n2", "Headline placeholder for a release story", NewsCategory.RELEASES, "2 h ago", 2),
        NewsPost("n3", "Headline placeholder for an industry story", NewsCategory.INDUSTRY, "5 h ago", 4),
        NewsPost("n4", "Weekly ranking headline placeholder", NewsCategory.RANKINGS, "8 h ago", 1),
        NewsPost("n5", "Headline placeholder that wraps", NewsCategory.INTERVIEWS, "Yesterday", 6),
    ).map {
        it.copy(
            body = List(4) { "Paragraph placeholder. The article text goes here, a few sentences long, so the layout can be checked." },
            pullQuote = "A short pull quote from the story sits here.", caption = "Image caption placeholder",
            movieId = "m1", movieCode = "ABC-101", idolId = "i1", idolName = idols[0].name, studio = "Example Studio",
        )
    }

    // Hentai ----------------------------------------------------------------------------------------------------

    /** H.2 / H.4 tag groups (Figma: Format · Story · Characters · Pairing · Other). */
    private val hentaiTagPool: Map<HentaiTagCategory, List<String>> = mapOf(
        HentaiTagCategory.FORMAT to listOf("HD", "3D", "POV"),
        HentaiTagCategory.STORY to listOf("Romance", "Comedy", "Fantasy", "Drama"),
        HentaiTagCategory.CHARACTERS to listOf("Elf", "Maid", "Teacher", "Nurse"),
        HentaiTagCategory.PAIRING to listOf("Couple", "Group", "Yuri"),
        HentaiTagCategory.OTHER to listOf("Short", "Remastered"),
    )

    private val hentaiStudios = listOf("Studio A", "Studio B", "Studio C", "Studio D", "Studio E")
    private val seasonNames = listOf("Winter", "Spring", "Summer", "Fall")

    /** 36 titles: four seasons a year from 2026 back, five studios, three series of episodes each. */
    val hentaiTitles: List<HentaiTitle> = (1..36).map { i ->
        val year = 2026 - (i - 1) / 6
        val month = 12 - ((i - 1) % 6) * 2
        val released = "%d-%02d-%02d".format(year, month, 1 + i % 27)
        val views = 1_200_000L + i * 400_000L
        val pool = hentaiTagPool.values.toList()
        HentaiTitle(
            id = "h$i", title = "Title placeholder $i", studio = hentaiStudios[i % hentaiStudios.size], year = year,
            views = views, isNew = i <= 4, uncensored = i % 4 == 0,
            episodes = (1..(1 + i % 3)).map { Episode(it, "Episode $it", 23 * MIN + 14_000, released = "%d-%02d-%02d".format(year, month, 1 + (i + it * 7) % 27)) },
            tags = buildList {
                if (i % 4 == 0) add("Uncensored")
                // Each group steps at its own rate, so tags from different groups don't always come together.
                pool.forEachIndexed { k, names -> add(names[(i * (k + 1) + i / (k + 2)) % names.size]) }
            },
            rating = 80 + i % 19, likes = views / 80, downloads = views / 16,
            released = released, added = "%d-%02d-%02d".format(year, month, minOf(28, 4 + i % 27)),
            synopsis = "Synopsis placeholder. A few sentences about the story, the characters and where it goes, " +
                "long enough to need Show more on a phone. The real text comes from the source.",
            altNames = listOf("Romaji name", "日本語の名前", "English name"),
            season = "${seasonNames[(month - 1) / 3]} $year", series = "Series name ${(i - 1) / 3 + 1}",
            trending = ((i * 7919) % 900) + 100,
        )
    }

    /** Tag counts from the catalogue, "Uncensored" included as a Format tag. */
    val hentaiTags: List<HentaiTag> = (listOf(HentaiTagCategory.FORMAT to "Uncensored") +
        hentaiTagPool.flatMap { (cat, names) -> names.map { cat to it } })
        .map { (cat, name) -> HentaiTag(name, cat, hentaiTitles.count { name in it.tags }) }

    val hentaiStudioTags: List<Tag> = hentaiStudios.map { name -> Tag("studio:$name", name, hentaiTitles.count { it.studio == name }) }
}
