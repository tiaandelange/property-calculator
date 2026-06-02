# Proplytic brand mark (Figma)

**Source:** [Team library — node 3312:5](https://www.figma.com/design/aJPG4JhiiegeXSUxskJwT8/Tiaan-De-Lange-s-team-library?node-id=3312-5&m=dev)

## In the app

| Asset | Location |
| --- | --- |
| React components | `frontend/src/components/brand/` |
| PNG mark (canonical) | `frontend/public/assets/brand/proplytic-mark.png` (`1000×1000`) |
| PNG source (same file) | `proplytic-mark-source.png` |
| SVG export (legacy) | `proplytic-mark.svg` |
| SVG paths (React fallback) | `proplyticLogoShared.tsx` |
| Favicon (PNG) | `frontend/public/favicon-32.png`, `favicon-16.png` |
| Favicon (SVG) | `frontend/public/favicon.svg` (embeds the 32×32 PNG) |
| Apple touch icon | `frontend/public/apple-touch-icon.png` (180×180) |

UI and PDFs prefer **PNG**; tab favicons are scaled from the same source.

Vector fallback paths: `proplyticLogoShared.tsx` (`PROPLYTIC_HOUSE_SHELL_PATH` + detail rects).

## Pixel-perfect sync from Figma

1. Open the link above and select the mark frame.
2. **Dev mode → Export → SVG**.
3. Send the `.svg` file or paste the `<path>` / `<svg>` body here — we can drop it into `proplyticLogoShared.tsx` and the public icons.

Optional: set `FIGMA_ACCESS_TOKEN` (personal access token with file read) so the agent can pull node geometry via the Figma API.
