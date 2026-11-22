package app.echo.data.repository

/** Every screen state from Figma: loading, content, empty (0.4 "Nothing … yet") and the errors (0.4, H.10). */
sealed interface Load<out T> {
    data object Loading : Load<Nothing>
    data class Content<T>(val value: T) : Load<T>
    data object Empty : Load<Nothing>
    data class Error(val kind: ErrorKind) : Load<Nothing>
}

enum class ErrorKind {
    /** 0.4 "You’re offline". */
    OFFLINE,

    /** 0.4 / H.10 "Page not found", "This title isn’t available in Echo". */
    NOT_FOUND,

    /** HTTP 451: blocked in this region. */
    BLOCKED,

    /** H.10 "The source is busy, try again later". */
    BUSY,

    /** H.10 "No video for this title". */
    NO_VIDEO,
}

/** Maps the content of a [Load]; loading, empty and error pass through unchanged. */
inline fun <T, R> Load<T>.map(transform: (T) -> R): Load<R> = when (this) {
    is Load.Content -> Load.Content(transform(value))
    Load.Loading -> Load.Loading
    Load.Empty -> Load.Empty
    is Load.Error -> this
}
