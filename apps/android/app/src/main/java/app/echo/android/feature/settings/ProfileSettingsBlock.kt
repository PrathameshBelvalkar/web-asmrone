package app.echo.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import app.echo.android.R
import app.echo.data.model.Profile
import app.echo.designsystem.component.m3e.SegmentedList
import app.echo.designsystem.component.m3e.SwitchListItem
import app.echo.designsystem.component.m3e.ValueIndicatorSlider
import app.echo.designsystem.tokens.EchoSpacing

/**
 * The age and adult-sources part of S.12, early (until Phase 10 builds S.12): enough to check the adult content rule
 * and section switching before onboarding exists.
 */
@Composable
fun ProfileSettingsBlock(profile: Profile, onProfile: (Profile.() -> Profile) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(EchoSpacing.s)) {
        Text(
            stringResource(R.string.settings_age),
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(horizontal = EchoSpacing.screenMargin),
        )
        ValueIndicatorSlider(
            value = profile.age ?: 13,
            onValueChange = { age -> onProfile { copy(age = age) } },
            range = 13..80,
            marker = Profile.ADULT_AGE,
            maxLabel = "80+",
            modifier = Modifier.padding(horizontal = EchoSpacing.sectionPadding),
        )
        SegmentedList {
            item {
                SwitchListItem(
                    headline = stringResource(R.string.settings_adult_sources),
                    supporting = stringResource(R.string.settings_adult_sources_summary),
                    checked = profile.showAdultSources,
                    onCheckedChange = { on -> onProfile { copy(showAdultSources = on) } },
                    enabled = (profile.age ?: 0) >= Profile.ADULT_AGE,
                )
            }
        }
    }
}
