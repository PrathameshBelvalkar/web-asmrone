package app.echo.data.model

/**
 * The local profile (DataStore `profile`): no account, saved on this device. Written by onboarding (O.5–O.9) and
 * S.12, read on launch to choose the start screen.
 *
 * @param avatar "initial" or the name of an avatar icon from the picker.
 * @param age null until O.7 is answered.
 */
data class Profile(
    val name: String = DEFAULT_NAME,
    val avatar: String = AVATAR_INITIAL,
    val age: Int? = null,
    val showAdultSources: Boolean = false,
    val enabledSections: Set<Section> = Section.entries.toSet(),
    val onboardingDone: Boolean = false,
    val firstRunTipShown: Boolean = false,
) {
    /** Adult content rule (O.7, S.12): 18+ and the switch on. */
    val adultAllowed: Boolean get() = (age ?: 0) >= ADULT_AGE && showAdultSources

    /** Sections offered in 0.1 / O.5 / Library. */
    val visibleSections: List<Section>
        get() = Section.entries.filter { it in enabledSections && (!it.adult || adultAllowed) }

    /** Sources offered in 0.1 Source switcher and O.5. */
    fun visibleSources(all: List<Source> = Sources.all): List<Source> =
        all.filter { it.section in visibleSections && (!it.adult || adultAllowed) }

    companion object {
        const val DEFAULT_NAME = "Pat"
        const val AVATAR_INITIAL = "initial"
        const val ADULT_AGE = 18
    }
}
