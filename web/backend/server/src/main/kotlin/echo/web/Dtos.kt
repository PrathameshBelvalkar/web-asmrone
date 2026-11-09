package echo.web

import dev.brahmkshatriya.echo.common.models.Tab
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class ErrorDto(val type: String, val message: String? = null)

@Serializable
data class ShelfDto(
    val kind: String,
    val id: String,
    val title: String,
    val subtitle: String? = null,
    val horizontal: Boolean = true,
    val moreFeedId: String? = null,
    val items: List<JsonElement>? = null,
    val item: JsonElement? = null,
    val categories: List<CategoryDto>? = null,
    val category: CategoryDto? = null,
)

@Serializable
data class CategoryDto(
    val id: String,
    val title: String,
    val subtitle: String? = null,
    val image: JsonElement? = null,
    val backgroundColor: String? = null,
    val feedId: String? = null,
)

/** A feed opened at one tab. [pagedId] is null when the extension returned no feed. */
@Serializable
data class FeedDto(
    val feedId: String? = null,
    val pagedId: String? = null,
    val tabs: List<Tab> = emptyList(),
    val selectedTab: String? = null,
    val showSearch: Boolean = true,
    val showSort: Boolean = true,
    val showPlayAndShuffle: Boolean = false,
    val background: JsonElement? = null,
    val customTracks: List<JsonElement>? = null,
)

@Serializable
data class PageDto(val items: List<JsonElement>, val continuation: String?)

@Serializable
data class RadioDto(val radio: JsonElement, val feed: FeedDto)

@Serializable
data class EditableDto(val playlist: JsonElement, val contains: Boolean)

@Serializable
data class UrlDto(val url: String)

@Serializable
data class LikeStatusDto(val liked: Boolean)

@Serializable
data class SettingDto(
    val kind: String,
    val key: String,
    val title: String,
    val summary: String? = null,
    val options: List<OptionDto>? = null,
    val value: JsonElement? = null,
    val min: Int? = null,
    val max: Int? = null,
    val steps: Int? = null,
    val children: List<SettingDto>? = null,
)

@Serializable
data class OptionDto(val title: String, val value: String)

@Serializable
data class FormDto(val key: String, val label: String, val fields: List<FieldDto>)

@Serializable
data class FieldDto(val key: String, val label: String, val type: String, val required: Boolean)
