package echo.web

import dev.brahmkshatriya.echo.common.clients.LoginClient
import dev.brahmkshatriya.echo.common.models.Album
import dev.brahmkshatriya.echo.common.models.Artist
import dev.brahmkshatriya.echo.common.models.EchoMediaItem
import dev.brahmkshatriya.echo.common.models.Lyrics
import dev.brahmkshatriya.echo.common.models.Playlist
import dev.brahmkshatriya.echo.common.models.QuickSearchItem
import dev.brahmkshatriya.echo.common.models.Streamable
import dev.brahmkshatriya.echo.common.models.Track
import dev.brahmkshatriya.echo.common.models.User
import dev.brahmkshatriya.echo.common.settings.Setting
import dev.brahmkshatriya.echo.common.settings.SettingCategory
import dev.brahmkshatriya.echo.common.settings.SettingItem
import dev.brahmkshatriya.echo.common.settings.SettingList
import dev.brahmkshatriya.echo.common.settings.SettingMultipleChoice
import dev.brahmkshatriya.echo.common.settings.SettingOnClick
import dev.brahmkshatriya.echo.common.settings.SettingSlider
import dev.brahmkshatriya.echo.common.settings.SettingSwitch
import dev.brahmkshatriya.echo.common.settings.SettingTextInput
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.request.receiveText
import io.ktor.server.request.header
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondOutputStream
import io.ktor.server.response.respondText
import io.ktor.server.application.ApplicationCall
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

private val http = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(60, TimeUnit.SECONDS)
    .build()

private suspend fun ApplicationCall.respondJson(el: JsonElement) =
    respondText(el.toString(), ContentType.Application.Json)

private suspend fun ApplicationCall.body(): JsonObject {
    val text = receiveText().ifBlank { "{}" }
    return try {
        Codec.json.parseToJsonElement(text).jsonObject
    } catch (e: Exception) {
        throw BadRequestException("Body must be a JSON object")
    }
}

private fun JsonObject.str(key: String): String? = this[key]?.jsonPrimitive?.contentOrNull
private fun JsonObject.bool(key: String): Boolean? = this[key]?.jsonPrimitive?.booleanOrNull
private fun JsonObject.int(key: String): Int? = this[key]?.jsonPrimitive?.intOrNull
private fun JsonObject.media(key: String = "item"): EchoMediaItem = Codec.decodeMedia(this[key])

private inline fun <reified T : EchoMediaItem> JsonObject.typed(key: String = "item"): T =
    media(key) as? T ?: throw BadRequestException("Expected ${T::class.simpleName}")

private fun JsonObject.tracks(key: String): List<Track> =
    (this[key]?.jsonArray ?: JsonArray(emptyList())).map {
        Codec.decodeMedia(it) as? Track ?: throw BadRequestException("Expected track in $key")
    }

private suspend fun gone(call: ApplicationCall) =
    call.respond(HttpStatusCode.Gone, ErrorDto("expired", "This list expired. Reopen it."))

private fun settingDto(s: Setting): SettingDto {
    fun current(): JsonElement? = Host.settings.raw(s.key)
    return when (s) {
        is SettingCategory -> SettingDto(
            "category", s.key, s.title, children = s.items.map { settingDto(it) }
        )

        is SettingSwitch -> SettingDto(
            "switch", s.key, s.title, s.summary,
            value = current() ?: JsonPrimitive(s.defaultValue),
        )

        is SettingList -> SettingDto(
            "list", s.key, s.title, s.summary,
            options = s.entryTitles.zip(s.entryValues).map { OptionDto(it.first, it.second) },
            value = current() ?: s.defaultEntryIndex?.let { s.entryValues.getOrNull(it) }
                ?.let { JsonPrimitive(it) } ?: JsonNull,
        )

        is SettingMultipleChoice -> SettingDto(
            "multi", s.key, s.title, s.summary,
            options = s.entryTitles.zip(s.entryValues).map { OptionDto(it.first, it.second) },
            value = current() ?: JsonArray(
                s.defaultEntryIndices.orEmpty().mapNotNull { s.entryValues.getOrNull(it) }
                    .map { JsonPrimitive(it) }
            ),
        )

        is SettingSlider -> SettingDto(
            "slider", s.key, s.title, s.summary,
            value = current() ?: JsonPrimitive(s.defaultValue ?: s.from),
            min = s.from, max = s.to, steps = s.steps,
        )

        is SettingTextInput -> SettingDto(
            "text", s.key, s.title, s.summary,
            value = current() ?: JsonPrimitive(s.defaultValue.orEmpty()),
        )

        is SettingOnClick -> SettingDto("button", s.key, s.title, s.summary)
        is SettingItem -> SettingDto("info", s.key, s.title, s.summary)
    }
}

private fun rememberMedia(media: Streamable.Media) = Codec.mediaResponseJson(media)

fun Route.api() = route("/api") {

    // ----- Feeds -----
    get("/home") {
        call.respond(Host.io { openNew(loadHomeFeed()) })
    }
    get("/library") {
        call.respond(Host.io { openNew(loadLibraryFeed()) })
    }
    get("/search") {
        val q = call.request.queryParameters["q"].orEmpty()
        call.respond(Host.io { openNew(loadSearchFeed(q)) })
    }
    get("/quicksearch") {
        val q = call.request.queryParameters["q"].orEmpty()
        if (q.isBlank()) return@get call.respondJson(JsonArray(emptyList()))
        val items = Host.io { quickSearch(q) }
        call.respondJson(Codec.json.encodeToJsonElement(ListSerializer(QuickSearchItem.serializer()), items))
    }
    get("/feeds/{id}/open") {
        val id = call.parameters["id"].orEmpty()
        val feed = Store.feeds.get(id) ?: return@get gone(call)
        val tab = call.request.queryParameters["tab"]
        call.respond(Host.io { openFeed(feed, id, tab) })
    }
    get("/pages/{id}") {
        val id = call.parameters["id"].orEmpty()
        val cont = call.request.queryParameters["cont"]
        val page = loadPage(id, cont) ?: return@get gone(call)
        call.respond(page)
    }

    // ----- Albums, artists, playlists, tracks -----
    post("/album/load") {
        val album = call.body().typed<Album>()
        call.respondJson(Codec.mediaJson(Host.io { loadAlbum(album) }))
    }
    post("/album/feed") {
        val album = call.body().typed<Album>()
        call.respond(Host.io { loadFeed(album)?.let { openNew(it) } ?: emptyFeed() })
    }
    post("/album/tracks") {
        val album = call.body().typed<Album>()
        call.respond(Host.io { loadTracks(album)?.let { openNew(it) } ?: emptyFeed() })
    }
    post("/artist/load") {
        val artist = call.body().typed<Artist>()
        call.respondJson(Codec.mediaJson(Host.io { loadArtist(artist) }))
    }
    post("/artist/feed") {
        val artist = call.body().typed<Artist>()
        call.respond(Host.io { openNew(loadFeed(artist)) })
    }
    post("/playlist/load") {
        val playlist = call.body().typed<Playlist>()
        call.respondJson(Codec.mediaJson(Host.io { loadPlaylist(playlist) }))
    }
    post("/playlist/feed") {
        val playlist = call.body().typed<Playlist>()
        call.respond(Host.io { loadFeed(playlist)?.let { openNew(it) } ?: emptyFeed() })
    }
    post("/playlist/tracks") {
        val playlist = call.body().typed<Playlist>()
        call.respond(Host.io { openNew(loadTracks(playlist)) })
    }
    post("/track/load") {
        val track = call.body().typed<Track>()
        call.respondJson(Codec.mediaJson(Host.io { loadTrack(track, false) }))
    }
    post("/track/media") {
        val track = call.body().typed<Track>()
        val streamable = track.servers.firstOrNull()
            ?: throw BadRequestException("This track has no stream")
        val media = Host.io { loadStreamableMedia(streamable, false) }
        call.respondJson(rememberMedia(media))
    }
    post("/lyrics") {
        val track = call.body().typed<Track>()
        val lyrics: Lyrics? = Host.io {
            val feed = searchTrackLyrics("asmrone", track)
            val first = feed.getPagedData(feed.notSortTabs.firstOrNull())
                .pagedData.loadPage(null).data.firstOrNull()
                ?: return@io null
            loadLyrics(first)
        }
        call.respondJson(lyrics?.let { Codec.json.encodeToJsonElement(Lyrics.serializer(), it) } ?: JsonNull)
    }
    post("/radio") {
        val body = call.body()
        val item = body.media()
        val context = body["context"]?.let { Codec.decodeMedia(it) }
        call.respond(Host.io {
            val created = radio(item, context)
            val loaded = loadRadio(created)
            RadioDto(radio = Codec.mediaJson(loaded), feed = openNew(loadTracks(loaded)))
        })
    }
    post("/share") {
        val item = call.body().media()
        call.respond(UrlDto(Host.io { onShare(item) }))
    }
    post("/like") {
        val body = call.body()
        val item = body.media()
        val shouldLike = body.bool("shouldLike") ?: true
        Host.io { likeItem(item, shouldLike) }
        call.respond(HttpStatusCode.NoContent)
    }
    post("/like/status") {
        val item = call.body().media()
        call.respond(LikeStatusDto(Host.io { isItemLiked(item) }))
    }

    // ----- Playlists -----
    post("/playlists/editable") {
        val track = call.body()["track"]?.let { Codec.decodeMedia(it) as? Track }
        val list = Host.io { listEditablePlaylists(track) }
        call.respond(list.map { EditableDto(Codec.mediaJson(it.first), it.second) })
    }
    post("/playlists/create") {
        val body = call.body()
        val title = body.str("title") ?: throw BadRequestException("title is required")
        val description = body.str("description")
        call.respondJson(Codec.mediaJson(Host.io { createPlaylist(title, description) }))
    }
    post("/playlists/delete") {
        val playlist = call.body().typed<Playlist>()
        Host.io { deletePlaylist(playlist) }
        call.respond(HttpStatusCode.NoContent)
    }
    post("/playlists/edit") {
        val body = call.body()
        val playlist = body.typed<Playlist>()
        val title = body.str("title") ?: throw BadRequestException("title is required")
        Host.io { editPlaylistMetadata(playlist, title, body.str("description")) }
        call.respond(HttpStatusCode.NoContent)
    }
    post("/playlists/privacy") {
        val body = call.body()
        val playlist = body.typed<Playlist>()
        val isPrivate = body.bool("isPrivate") ?: true
        Host.io { setPrivacy(playlist, isPrivate) }
        call.respond(HttpStatusCode.NoContent)
    }
    post("/playlists/add-tracks") {
        val body = call.body()
        val playlist = body.typed<Playlist>()
        val existing = body.tracks("tracks")
        val added = body.tracks("new")
        val index = body.int("index") ?: existing.size
        Host.io { addTracksToPlaylist(playlist, existing, index, added) }
        call.respond(HttpStatusCode.NoContent)
    }
    post("/playlists/remove-tracks") {
        val body = call.body()
        val playlist = body.typed<Playlist>()
        val tracks = body.tracks("tracks")
        val indexes = body["indexes"]?.jsonArray?.map { it.jsonPrimitive.intOrNull ?: 0 } ?: emptyList()
        Host.io { removeTracksFromPlaylist(playlist, tracks, indexes) }
        call.respond(HttpStatusCode.NoContent)
    }

    // ----- Account -----
    get("/auth/forms") {
        val forms = Host.io { forms }
        call.respond(forms.map { form: LoginClient.Form ->
            FormDto(form.key, form.label, form.inputFields.map {
                FieldDto(it.key, it.label, it.type.name, it.isRequired)
            })
        })
    }
    post("/auth/login") {
        val body = call.body()
        val key = body.str("key") ?: "login"
        val data: Map<String, String?> = (body["data"]?.jsonObject ?: JsonObject(emptyMap()))
            .mapValues { (it.value as? JsonPrimitive)?.contentOrNull }
        val users = Host.io { onLogin(key, data) }
        val user = users.firstOrNull() ?: throw BadRequestException("Login returned no user")
        Host.users.save(user)
        Host.io { setLoginUser(user) }
        call.respondJson(Codec.json.encodeToJsonElement(User.serializer(), user))
    }
    post("/auth/logout") {
        Host.users.clear()
        Host.io { setLoginUser(null) }
        call.respond(HttpStatusCode.NoContent)
    }
    get("/auth/me") {
        val user = Host.io { getCurrentUser() }
        call.respondJson(user?.let { Codec.json.encodeToJsonElement(User.serializer(), it) } ?: JsonNull)
    }

    // ----- Settings -----
    get("/settings") {
        val items = Host.io { getSettingItems() }
        call.respond(items.map { settingDto(it) })
    }
    put("/settings/{key}") {
        val key = call.parameters["key"].orEmpty()
        val value = call.body()["value"]?.takeUnless { it is JsonNull }
        Host.settings.setRaw(key, value)
        Host.io { setSettings(Host.settings) }
        call.respond(HttpStatusCode.NoContent)
    }

    // ----- Media proxy (only URLs the extension issued) -----
    get("/proxy") {
        val url = call.request.queryParameters["url"] ?: throw BadRequestException("url is required")
        if (!IssuedUrls.contains(url)) {
            return@get call.respond(HttpStatusCode.Forbidden, ErrorDto("forbidden", "URL was not issued by the extension"))
        }
        val request = Request.Builder().url(url).apply {
            call.request.header(HttpHeaders.Range)?.let { header(HttpHeaders.Range, it) }
        }.build()
        val upstream = withContext(Dispatchers.IO) { http.newCall(request).execute() }
        upstream.use { response ->
            if (!response.isSuccessful && response.code != 206) {
                return@get call.respond(
                    HttpStatusCode.fromValue(response.code),
                    ErrorDto("upstream", "Upstream returned ${response.code}")
                )
            }
            response.header(HttpHeaders.ContentRange)?.let { call.response.header(HttpHeaders.ContentRange, it) }
            response.header(HttpHeaders.ContentLength)?.let { call.response.header(HttpHeaders.ContentLength, it) }
            call.response.header(HttpHeaders.AcceptRanges, "bytes")
            val type = response.header(HttpHeaders.ContentType)
                ?.let { runCatching { ContentType.parse(it) }.getOrNull() }
                ?: ContentType.Application.OctetStream
            val body = response.body
            call.respondOutputStream(type, HttpStatusCode.fromValue(response.code)) {
                val out = this
                withContext(Dispatchers.IO) { body.byteStream().use { it.copyTo(out) } }
            }
        }
    }

    get("{...}") { call.respond(HttpStatusCode.NotFound, ErrorDto("not_found")) }
}
