package app.echo.android.feature.manga

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Box
import app.echo.android.ui.ErrorState
import app.echo.android.ui.LoadingState
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ContainedLoadingIndicator
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.data.repository.ErrorKind
import app.echo.data.model.Tag
import app.echo.data.repository.Load
import app.echo.designsystem.component.echo.EmptyState
import app.echo.designsystem.component.echo.EmptyStateAction
import app.echo.designsystem.component.m3e.ButtonStyle
import app.echo.designsystem.icon.EchoIcons
import app.echo.designsystem.tokens.EchoSpacing

/** The language filter on 2.1 and 2.2. [code] is the language code the catalogue uses; null = all. */
enum class MangaLanguage(val code: String?, @StringRes val label: Int) {
    ALL(null, R.string.manga_all_languages),
    JAPANESE("JP", R.string.manga_lang_japanese),
    ENGLISH("EN", R.string.manga_lang_english),
    CHINESE("ZH", R.string.manga_lang_chinese),
    ;

    fun matches(language: String) = code == null || code == language
}

/** A letter group of tags or artists (2.3, 2.11). [letter] is empty for the "Popular" sort, which has no groups. */
data class LetterGroup<T>(val letter: String, val items: List<T>)

/**
 * Loading, empty and error states for a [Load] (Figma 0.4 and the Manga screens). Content draws nothing here: the
 * screen draws it. Works inside a grid as an item with a full span.
 */
@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun LoadFallback(load: Load<*>, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    // The shared states (app/ui/LoadContent.kt): same copy and Try again everywhere.
    when (load) {
        Load.Loading -> LoadingState(modifier.padding(top = EchoSpacing.xxl))
        Load.Empty -> EmptyState(
            EchoIcons.Search, stringResource(R.string.state_empty_title), stringResource(R.string.state_empty_body),
            modifier.padding(top = EchoSpacing.xxl),
        )
        is Load.Error -> ErrorState(load.kind, onRetry, modifier.padding(top = EchoSpacing.xxl))
        is Load.Content -> Unit
    }
}

/** The items of a loaded list, or nothing while it isn't loaded. */
fun <T> Load<List<T>>.itemsOrEmpty(): List<T> = (this as? Load.Content)?.value.orEmpty()

/** "1,204 galleries" style count for a number. */
fun formatCount(count: Int): String = "%,d".format(count)

/** Page numbers as rows of [columns] for a lazy list of thumbnails. */
fun pageRows(pageCount: Int, columns: Int): List<List<Int>> = (1..pageCount).chunked(columns)

/** "JP" → "Japanese", as the gallery meta line shows it. */
@Composable
fun languageName(code: String): String = when (code) {
    "JP" -> stringResource(R.string.manga_lang_japanese)
    "EN" -> stringResource(R.string.manga_lang_english)
    "ZH" -> stringResource(R.string.manga_lang_chinese)
    else -> code
}

/** The sort on 2.3 and 2.11: A–Z groups by letter, Popular is one list by gallery count. */
enum class TagSort { AZ, POPULAR }

/** Filters by name, then sorts: A–Z gives letter groups, Popular one group with no letter. */
fun groupTags(tags: List<Tag>, query: String, sort: TagSort): List<LetterGroup<Tag>> {
    val matching = tags.filter { query.isBlank() || it.name.contains(query, ignoreCase = true) }
    return when (sort) {
        TagSort.AZ -> matching.sortedBy { it.name }
            .groupBy { it.name.first().uppercaseChar().toString() }
            .map { (letter, items) -> LetterGroup(letter, items) }
        TagSort.POPULAR -> listOf(LetterGroup("", matching.sortedByDescending { it.count }))
    }
}

/** The gallery's page on 3hentai (2.5 Share / Open, 2.6 ⋮). */
fun galleryUrl(id: String): String = "https://3hentai.net/d/$id"

/** A tag's or artist's list on 3hentai (2.4 Open). */
fun tagUrl(tagId: String): String = "https://3hentai.net/search?q=${android.net.Uri.encode(tagId)}"
