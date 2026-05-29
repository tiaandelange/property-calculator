# Universal icon system (Proplytic)

Central icon registry for the frontend. Import from `frontend/src/components/icons`.

## Audit summary

| Item | Result |
|------|--------|
| Icon library | **lucide-react** v1.16.0 (only library; no react-icons / heroicons) |
| Inline SVGs | Brand logos only (`ProplyticLogo*`) — not UI icons |
| UI .webp/.png | **None** for icons; calculator WebPs already replaced. Homepage uses WebP for hero/marketing photos only |
| Duplicate systems | Consolidated into `components/icons/`; domain maps in `src/icons/` re-export semantic names |

## Registry location

`frontend/src/components/icons/iconRegistry.ts` — `iconMap`, `IconName`, `getIconComponent()`

## API

```tsx
import { AppIcon, IconButton, IconContainer, type IconName } from "@/components/icons";

<AppIcon name="dashboard" size="md" />
<IconContainer icon="wallet" accent="purple" size="md" />
<IconButton icon="edit" aria-label="Edit invoice" variant="outline" />
```

### Sizes (`iconSizes.ts`)

| Token | px |
|-------|-----|
| xs | 14 |
| sm | 16 |
| md | 18 (default) |
| lg | 20 |
| xl | 24 |

### Container sizes

| Token | px |
|-------|-----|
| sm | 32 |
| md | 40 |
| lg | 44 |
| xl | 48 |

### Accent aliases → theme tokens

| Alias | Token |
|-------|-------|
| purple | `--primary-soft` / `--primary` |
| green | `--success-soft` / `--success` |
| blue | `--info-soft` / `--info` |
| amber | `--warning-soft` / `--warning` |
| red | `--danger-soft` / `--danger` |
| neutral | `--surface-muted` / `--text-secondary` |

### IconButton variants

`ghost` | `outline` | `primary` | `danger` | `subtle`

- **aria-label required** (TypeScript enforced)
- Min tap target **44px**
- Optional hover tooltip (defaults to aria-label)

## Semantic icon names

See `ICON_NAMES` in `iconRegistry.ts`. Includes all names from the product spec plus app-specific aliases (`open`, `email`, `portfolio`, `verified`, `info`, `maintenance`, etc.).

## Domain maps (use registry underneath)

- `src/icons/calculatorIcons.ts` — calculator slug → Lucide + accent
- `src/icons/dashboardStatIcons.ts` — stat presets → IconName + accent
- `src/icons/featureIcons.ts` — homepage features
- `src/icons/trustIcons.ts` — homepage trust strip

## Migrated areas

- Desktop sidebar, mobile drawer, bottom nav, shell menu button
- Statement row actions, invoice table actions, financial statement actions
- Lease / tenant row actions, property lease card actions
- Settings cards, dashboard metric cards (portfolio, invoice, lease, tenant)
- Property financial metric cards, field info tips
- Calculator hub icons (via `CalculatorIconDisplay`)

## Still using lucide-react directly

Some low-traffic or inline contexts (invoice editor toolbar, workspace rail, pagination chevrons, status picker chevrons). Migrate incrementally via `AppIcon` — do not add new direct lucide imports in feature code.

## Rules

1. No hardcoded icon colours — use `currentColor` / theme tokens
2. Icon-only buttons: **no text labels**, always `aria-label`
3. Do not install a second icon library
4. Logos / property photos / OG images stay as image assets
