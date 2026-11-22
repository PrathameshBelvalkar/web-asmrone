package app.echo.designsystem.preview

/** Placeholder content copied from the Figma frames, for previews and screenshot tests only. */
object PreviewData {
    const val SOURCE = "asmr.one"
    const val TRACK = "Whispered bedtime story"
    const val ARTIST = "Circle Aoi"
    const val PROFILE_INITIAL = "P"
    val tabs = listOf("For you", "Popular", "New", "Recommended")
    val heroTitles = listOf("Rainy night library", "Ear cleaning", "Soft tapping", "Train at dusk")
    val continueItems = listOf(
        Triple("Whispered bedtime story", "42 min left", 0.6f),
        Triple("Rain on a tin roof", "1h 10m left", 0.25f),
        Triple("Soft tapping", "8 min left", 0.85f),
    )
    val tracks = listOf(
        Triple("01 · Opening, whispered", "Circle Aoi", "4:12"),
        Triple("02 · Ear cleaning", "Circle Aoi", "12:40"),
        Triple("03 · Rain and heartbeat", "Studio Komorebi", "22:05"),
    )
}
