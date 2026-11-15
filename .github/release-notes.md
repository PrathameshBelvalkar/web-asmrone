<!-- Filled in by .github/scripts/release-notes.mjs. Placeholders: {{VERSION}} {{TAG}} {{REPO}} {{CHANGES}} {{CHECKSUMS}} -->
<p align="center">
  <img src="https://raw.githubusercontent.com/{{REPO}}/{{TAG}}/apps/desktop/build/icon.png" alt="Echo icon" width="96" height="96">
</p>

<p align="center">
  <a href="https://github.com/{{REPO}}/releases/tag/{{TAG}}"><img alt="Downloads" src="https://img.shields.io/github/downloads/{{REPO}}/{{TAG}}/total?label=downloads&labelColor=2B1D3F&color=7B3FC4"></a>
  <img alt="macOS" src="https://img.shields.io/badge/macOS-Apple%20chip%20%7C%20Intel-7B3FC4?logo=apple&logoColor=white&labelColor=2B1D3F">
</p>

## Highlights

<!-- Replace this with two or three lines about what's new before you publish. -->
_To be written._

## Download

| Your Mac | Installer | Also available |
|---|---|---|
| Apple chip (M1 or newer) | [**Echo-{{VERSION}}-mac-arm64.dmg**](https://github.com/{{REPO}}/releases/download/{{TAG}}/Echo-{{VERSION}}-mac-arm64.dmg) | [.zip](https://github.com/{{REPO}}/releases/download/{{TAG}}/Echo-{{VERSION}}-mac-arm64.zip) |
| Intel | [**Echo-{{VERSION}}-mac-x64.dmg**](https://github.com/{{REPO}}/releases/download/{{TAG}}/Echo-{{VERSION}}-mac-x64.dmg) | [.zip](https://github.com/{{REPO}}/releases/download/{{TAG}}/Echo-{{VERSION}}-mac-x64.zip) |

> [!TIP]
> Not sure which one? Open  → **About This Mac**. **Chip: Apple M…** means Apple chip; **Processor: Intel…** means Intel.

> [!IMPORTANT]
> Echo isn't signed by Apple yet. The first time you open it, macOS may block it: go to **System Settings →
> Privacy & Security** and click **Open Anyway**. Already have Echo? It will tell you about this update by itself.

{{CHANGES}}

<details>
<summary>SHA-256 checksums</summary>

```
{{CHECKSUMS}}
```

Check a download with `shasum -a 256 <file>`.

</details>
