package echo.web

import dev.brahmkshatriya.echo.common.models.Feed
import dev.brahmkshatriya.echo.common.helpers.PagedData
import dev.brahmkshatriya.echo.common.models.User
import dev.brahmkshatriya.echo.common.settings.Settings
import kotlinx.serialization.json.Json
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
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.UUID

/** Settings persisted as one JSON object. Typed getters read the JSON primitive they need. */
class JsonSettings(private val file: File) : Settings {
    private val pretty = Json { prettyPrint = true }
    private val values: MutableMap<String, JsonElement> = load().toMutableMap()

    private fun load(): Map<String, JsonElement> = try {
        if (file.exists()) Json.parseToJsonElement(file.readText()).jsonObject.toMap() else emptyMap()
    } catch (e: Exception) {
        emptyMap()
    }

    @Synchronized
    private fun save() {
        file.parentFile?.mkdirs()
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeText(pretty.encodeToString(JsonObject.serializer(), JsonObject(values)))
        Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
    }

    @Synchronized
    fun raw(key: String): JsonElement? = values[key]

    @Synchronized
    fun setRaw(key: String, value: JsonElement?) {
        if (value == null || value is JsonNull) values.remove(key) else values[key] = value
        save()
    }

    @Synchronized
    override fun getString(key: String): String? = values[key]?.jsonPrimitive?.contentOrNull

    @Synchronized
    override fun putString(key: String, value: String?) = setRaw(key, value?.let { JsonPrimitive(it) })

    @Synchronized
    override fun getStringSet(key: String): Set<String>? =
        values[key]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull }?.toSet()

    @Synchronized
    override fun putStringSet(key: String, value: Set<String>?) =
        setRaw(key, value?.let { JsonArray(it.map { v -> JsonPrimitive(v) }) })

    @Synchronized
    override fun getInt(key: String): Int? = values[key]?.jsonPrimitive?.intOrNull

    @Synchronized
    override fun putInt(key: String, value: Int?) = setRaw(key, value?.let { JsonPrimitive(it) })

    @Synchronized
    override fun getBoolean(key: String): Boolean? = values[key]?.jsonPrimitive?.booleanOrNull

    @Synchronized
    override fun putBoolean(key: String, value: Boolean?) = setRaw(key, value?.let { JsonPrimitive(it) })
}

/** The one logged-in asmr.one user (token lives in `User.extras`). */
class UserStore(private val file: File) {
    private val json = Json { ignoreUnknownKeys = true }

    @Synchronized
    fun load(): User? = runCatching {
        if (file.exists()) json.decodeFromString(User.serializer(), file.readText()) else null
    }.getOrNull()

    @Synchronized
    fun save(user: User) {
        file.parentFile?.mkdirs()
        file.writeText(json.encodeToString(User.serializer(), user))
    }

    @Synchronized
    fun clear() {
        file.delete()
    }
}

/** Bounded map of opaque ids to live objects, with idle expiry. Expired ids return null. */
class ExpiringRegistry<T : Any>(private val maxSize: Int, private val ttlMillis: Long) {
    private class Entry<T>(val value: T, var lastAccess: Long)

    private val entries = LinkedHashMap<String, Entry<T>>()

    @Synchronized
    fun put(value: T): String {
        purge()
        val id = UUID.randomUUID().toString()
        entries[id] = Entry(value, now())
        while (entries.size > maxSize) entries.remove(entries.keys.first())
        return id
    }

    @Synchronized
    fun get(id: String): T? {
        purge()
        val entry = entries[id] ?: return null
        entry.lastAccess = now()
        return entry.value
    }

    private fun purge() {
        val cutoff = now() - ttlMillis
        val iterator = entries.entries.iterator()
        while (iterator.hasNext()) {
            if (iterator.next().value.lastAccess < cutoff) iterator.remove()
        }
    }

    private fun now() = System.currentTimeMillis()
}

object Store {
    private const val TTL = 30 * 60_000L
    val feeds = ExpiringRegistry<Feed<*>>(maxSize = 500, ttlMillis = TTL)
    val pages = ExpiringRegistry<PagedData<*>>(maxSize = 500, ttlMillis = TTL)
}

/**
 * URLs the extension has handed out (stream and cover URLs). The proxy only serves these,
 * so it can't be used as an open proxy.
 */
object IssuedUrls {
    private const val MAX = 20_000
    private val urls = object : LinkedHashMap<String, Boolean>(1024, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Boolean>?) = size > MAX
    }

    @Synchronized
    fun add(url: String) {
        urls[url] = true
    }

    @Synchronized
    fun contains(url: String): Boolean = urls.containsKey(url)
}
