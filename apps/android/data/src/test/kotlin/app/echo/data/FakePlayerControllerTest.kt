package app.echo.data

import app.echo.data.fake.FakePlayerController
import app.echo.data.model.Track
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** design.md §12.1 › Player: queue, next / previous, seek, speed, sleep timer. */
class FakePlayerControllerTest {
    private val queue = (1..3).map { Track("t$it", "w", "asmrone", "Track $it", "A", null, durationMs = 10_000) }

    private fun TestScope.player() = FakePlayerController(backgroundScope, tickMs = 1_000) { testScheduler.currentTime }

    @Test
    fun `position ticks while playing and stops when paused`() = runTest {
        val p = player()
        p.play(queue)
        advanceTimeBy(3_001); runCurrent()
        assertEquals(3_000, p.state.value.positionMs)
        p.playPause()
        advanceTimeBy(5_000); runCurrent()
        assertEquals(3_000, p.state.value.positionMs)
        assertFalse(p.state.value.isPlaying)
    }

    @Test
    fun `speed makes the position move faster`() = runTest {
        val p = player()
        p.setSpeed(2f)
        p.play(queue)
        advanceTimeBy(2_001); runCurrent()
        assertEquals(4_000, p.state.value.positionMs)
    }

    @Test
    fun `end of a track moves to the next, end of the queue stops`() = runTest {
        val p = player()
        p.play(queue, startIndex = 2)
        advanceTimeBy(10_001); runCurrent()
        assertFalse(p.state.value.isPlaying)
        p.play(queue)
        advanceTimeBy(10_001); runCurrent()
        assertEquals(1, p.state.value.index)
    }

    @Test
    fun `previous restarts the track after 3 seconds, otherwise goes back`() = runTest {
        val p = player()
        p.play(queue, startIndex = 1)
        p.seekTo(5_000)
        p.previous()
        assertEquals(1, p.state.value.index)
        assertEquals(0, p.state.value.positionMs)
        p.previous()
        assertEquals(0, p.state.value.index)
    }

    @Test
    fun `repeat wraps the queue`() = runTest {
        val p = player()
        p.play(queue, startIndex = 2)
        p.toggleRepeat()
        p.next()
        assertEquals(0, p.state.value.index)
    }

    @Test
    fun `moving and removing keep the current track`() = runTest {
        val p = player()
        p.play(queue, startIndex = 1)
        p.move(from = 1, to = 2)
        assertEquals("t2", p.state.value.current?.id)
        p.remove(0)
        assertEquals("t2", p.state.value.current?.id)
    }

    @Test
    fun `sleep timer pauses playback`() = runTest {
        val p = player()
        p.play(queue.map { it.copy(durationMs = 10 * 60_000L) })
        p.setSleepTimer(1)
        advanceTimeBy(61_001); runCurrent()
        assertFalse(p.state.value.isPlaying)
        assertNull(p.state.value.sleepAt)
    }

    @Test
    fun `stop clears everything`() = runTest {
        val p = player()
        p.play(queue)
        p.stop()
        assertTrue(p.state.value.queue.isEmpty())
        assertNull(p.state.value.current)
    }
}
