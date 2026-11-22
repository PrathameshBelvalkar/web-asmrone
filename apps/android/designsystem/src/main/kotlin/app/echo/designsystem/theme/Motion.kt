package app.echo.designsystem.theme

import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.material3.MotionScheme

/*
 * Figma DS · Motion (21:28988). Springs, not durations: screens read specs from MaterialTheme.motionScheme
 * and never write tween(300).
 *
 *   fastSpatialSpec     buttons, chips, toggles, shape morph
 *   defaultSpatialSpec  mini player ↔ full player sheet, screen navigation
 *   slowSpatialSpec     shared-element cover transitions, hero carousel
 *   *EffectsSpec        colour and opacity (theme switch, player colour). Never overshoots.
 */

val EchoMotionScheme: MotionScheme = MotionScheme.expressive()

/** Animations off (S.8 or system animator scale 0): spatial changes snap, effects become short fades. */
object ReducedMotionScheme : MotionScheme {
    private const val FADE_MS = 100
    override fun <T> defaultSpatialSpec(): FiniteAnimationSpec<T> = snap()
    override fun <T> fastSpatialSpec(): FiniteAnimationSpec<T> = snap()
    override fun <T> slowSpatialSpec(): FiniteAnimationSpec<T> = snap()
    override fun <T> defaultEffectsSpec(): FiniteAnimationSpec<T> = tween(FADE_MS)
    override fun <T> fastEffectsSpec(): FiniteAnimationSpec<T> = tween(FADE_MS)
    override fun <T> slowEffectsSpec(): FiniteAnimationSpec<T> = tween(FADE_MS)
}
