package app.echo.data.repository

import app.echo.data.db.EchoDatabase
import app.echo.data.db.ReaderPrefsEntity
import app.echo.data.model.ReaderSettings
import app.echo.data.model.ReadingMode
import app.echo.data.model.ScaleType
import app.echo.data.model.TapZones
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * 2.8 "For this gallery": the reader settings one gallery overrides. A null field uses the default (S.10).
 * Only the five reader_prefs columns can be overridden; background, page number and screen-on stay global.
 */
data class GalleryReaderPrefs(
    val mode: ReadingMode? = null,
    val tapZones: TapZones? = null,
    val scaleType: ScaleType? = null,
    val cropBorders: Boolean? = null,
    val dualPage: Boolean? = null,
)

interface ReaderPrefsRepository {
    /** Null when the gallery has no overrides. */
    fun forGallery(galleryId: String): Flow<GalleryReaderPrefs?>
    suspend fun save(galleryId: String, prefs: GalleryReaderPrefs)
    /** "For this gallery" off: back to the defaults. */
    suspend fun reset(galleryId: String)
}

class RoomReaderPrefsRepository(db: EchoDatabase) : ReaderPrefsRepository {
    private val dao = db.readerPrefs()

    override fun forGallery(galleryId: String): Flow<GalleryReaderPrefs?> =
        dao.forGallery(galleryId).map { it?.toModel() }

    override suspend fun save(galleryId: String, prefs: GalleryReaderPrefs) = dao.save(
        ReaderPrefsEntity(
            galleryId = galleryId, mode = prefs.mode?.name, tapZones = prefs.tapZones?.name, scaleType = prefs.scaleType?.name,
            cropBorders = prefs.cropBorders, dualPage = prefs.dualPage,
        ),
    )

    override suspend fun reset(galleryId: String) = dao.reset(galleryId)

    private fun ReaderPrefsEntity.toModel() = GalleryReaderPrefs(
        mode = mode?.let { ReadingMode.valueOf(it) },
        tapZones = tapZones?.let { TapZones.valueOf(it) },
        scaleType = scaleType?.let { ScaleType.valueOf(it) },
        cropBorders = cropBorders,
        dualPage = dualPage,
    )
}

/** The reader settings this gallery sees: the defaults with its overrides on top. Pure, so it's unit-tested. */
fun ReaderSettings.withOverrides(prefs: GalleryReaderPrefs?): ReaderSettings {
    if (prefs == null) return this
    return copy(
        readingMode = prefs.mode ?: readingMode,
        tapZones = prefs.tapZones ?: tapZones,
        scaleType = prefs.scaleType ?: scaleType,
        cropBorders = prefs.cropBorders ?: cropBorders,
        dualPageLandscape = prefs.dualPage ?: dualPageLandscape,
    )
}
