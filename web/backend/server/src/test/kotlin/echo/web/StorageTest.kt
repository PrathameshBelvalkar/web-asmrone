package echo.web

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import java.io.File
import java.nio.file.Files

class StorageTest {
    private fun tempFile(name: String): File {
        val dir = Files.createTempDirectory("echo-web-test").toFile()
        dir.deleteOnExit()
        return File(dir, name)
    }

    @Test
    fun settingsReturnNullForMissingKeysAndRemoveOnNull() {
        val settings = JsonSettings(tempFile("settings.json"))
        assertNull(settings.getBoolean("onlyShowSfw"))
        settings.putBoolean("onlyShowSfw", true)
        assertEquals(true, settings.getBoolean("onlyShowSfw"))
        settings.putBoolean("onlyShowSfw", null)
        assertNull(settings.getBoolean("onlyShowSfw"))
    }

    @Test
    fun settingsPersistAcrossInstances() {
        val file = tempFile("settings.json")
        JsonSettings(file).apply {
            putInt("sliderValue", 7)
            putString("siteMirror", "asmr-300")
            putStringSet("showTags", setOf("ASMR", "Ear"))
        }
        val reloaded = JsonSettings(file)
        assertEquals(7, reloaded.getInt("sliderValue"))
        assertEquals("asmr-300", reloaded.getString("siteMirror"))
        assertEquals(setOf("ASMR", "Ear"), reloaded.getStringSet("showTags"))
    }

    @Test
    fun registryReturnsValuesUntilTheyExpire() {
        val registry = ExpiringRegistry<String>(maxSize = 10, ttlMillis = 60_000)
        val id = registry.put("feed")
        assertEquals("feed", registry.get(id))
        assertNull(registry.get("missing"))

        val shortLived = ExpiringRegistry<String>(maxSize = 10, ttlMillis = -1)
        val expired = shortLived.put("gone")
        assertNull(shortLived.get(expired))
    }

    @Test
    fun registryEvictsOldestWhenFull() {
        val registry = ExpiringRegistry<Int>(maxSize = 2, ttlMillis = 60_000)
        val first = registry.put(1)
        registry.put(2)
        registry.put(3)
        assertNull(registry.get(first))
    }

    @Test
    fun issuedUrlsOnlyContainWhatWasAdded() {
        IssuedUrls.add("https://example.test/a.wav")
        assertTrue(IssuedUrls.contains("https://example.test/a.wav"))
        assertFalse(IssuedUrls.contains("https://example.test/other.wav"))
    }
}
