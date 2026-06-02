# Proplytic brand mark (Figma)

**Source:** [Team library — node 3312:5](https://www.figma.com/design/aJPG4JhiiegeXSUxskJwT8/Tiaan-De-Lange-s-team-library?node-id=3312-5&m=dev)

## In the app

| Asset | Location |
| --- | --- |
| React components | `frontend/src/components/brand/` |
| SVG mark (canonical) | `frontend/public/assets/brand/proplytic-mark.svg` (`viewBox="0 0 1500 1500"`) |
| SVG paths (React) | `proplyticLogoShared.tsx` |
| Favicon | `frontend/public/favicon.svg` |
| Apple touch icon | `frontend/public/apple-touch-icon.svg` |

Mark fill: **purple gradient** (`#6C4CFF` → `#A78BFA`) on UI logos; **solid `#7B5BE4`** on the 32×32 favicon for clarity.

Vector source: `proplyticLogoShared.tsx` (`PROPLYTIC_HOUSE_SHELL_PATH` + detail rects).

## Pixel-perfect sync from Figma

1. Open the link above and select the mark frame.
2. **Dev mode → Export → SVG**.
3. Send the `.svg` file or paste the `<path>` / `<svg>` body here — we can drop it into `proplyticLogoShared.tsx` and the public icons.

Optional: set `FIGMA_ACCESS_TOKEN` (personal access token with file read) so the agent can pull node geometry via the Figma API.
