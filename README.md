# Table Exporter

Grab any web table and export it to CSV, Excel, JSON, TSV, or Markdown.

## Features
- Detects tables across iframes and embedded content.
- Export formats: CSV, TSV, XLSX, JSON, Markdown.
- Clean preview with table metadata.

## Install (Unpacked)
1. Open `chrome://extensions` and enable Developer mode.
2. Click **Load unpacked** and select this folder.

## Permissions
- `activeTab`: Access the current page when you click the extension.
- `scripting`: Needed for content scripts.
- `downloads`: Save exported files.
- `webNavigation`: Scan all frames for tables.
- `host_permissions`: `<all_urls>` for table detection on any site.

## Privacy
This extension does not collect or transmit any data. It only reads tables in the active tab when you open the popup.

## Chrome Web Store Assets
- `marketing/promo-440x280.png`
- `marketing/hero-1400x560.png`

## Development
- `manifest.json`
- `content.js`
- `popup.html` / `popup.js` / `popup.css`

## License
MIT. See `LICENSE`.
