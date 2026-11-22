package app.echo.designsystem.component.m3e

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.echo.designsystem.tokens.EchoSizes
import app.echo.designsystem.tokens.EchoSpacing

/**
 * Modal bottom sheet (Figma "M3E · Bottom sheet (Modal)", 9 screens): 32 × 4 drag handle, 28 dp top corners,
 * surfaceContainerLow, 32% scrim, then a title and optional subtitle with 24 dp side padding.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EchoSheet(
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    title: String? = null,
    subtitle: String? = null,
    skipPartiallyExpanded: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    // SheetState is experimental: it stays inside :designsystem, callers only choose partial expansion.
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = skipPartiallyExpanded)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        modifier = modifier,
        sheetState = sheetState,
        shape = MaterialTheme.shapes.extraLarge.copy(
            bottomStart = androidx.compose.foundation.shape.CornerSize(0),
            bottomEnd = androidx.compose.foundation.shape.CornerSize(0),
        ),
        containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
        scrimColor = MaterialTheme.colorScheme.scrim.copy(alpha = EchoSizes.SCRIM_ALPHA),
    ) {
        if (title != null) {
            SheetHeader(title, subtitle)
        }
        content()
    }
}

/** The title block at the top of a sheet. Public so previews and dialogs can reuse it. */
@Composable
fun SheetHeader(title: String, subtitle: String? = null) {
    Column(Modifier.padding(start = EchoSpacing.sectionPadding, end = EchoSpacing.sectionPadding, bottom = EchoSpacing.l)) {
        Text(title, style = MaterialTheme.typography.titleLarge)
        if (subtitle != null) {
            Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
