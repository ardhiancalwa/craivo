---
name: SELA Smart QR Menu
colors:
  surface: '#fbf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#fbf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ef'
  surface-container: '#efeeea'
  surface-container-high: '#eae8e4'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c1a'
  on-surface-variant: '#544339'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f0ed'
  outline: '#877367'
  outline-variant: '#dac2b4'
  surface-tint: '#954a08'
  primary: '#924805'
  on-primary: '#ffffff'
  primary-container: '#b05f20'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb787'
  secondary: '#655d59'
  on-secondary: '#ffffff'
  secondary-container: '#e9ddd8'
  on-secondary-container: '#69615d'
  tertiary: '#615b52'
  on-tertiary: '#ffffff'
  tertiary-container: '#7b736a'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdcc7'
  primary-fixed-dim: '#ffb787'
  on-primary-fixed: '#311300'
  on-primary-fixed-variant: '#733600'
  secondary-fixed: '#ece0db'
  secondary-fixed-dim: '#d0c4bf'
  on-secondary-fixed: '#201a17'
  on-secondary-fixed-variant: '#4d4542'
  tertiary-fixed: '#ebe1d6'
  tertiary-fixed-dim: '#cec5ba'
  on-tertiary-fixed: '#1f1b14'
  on-tertiary-fixed-variant: '#4c463e'
  background: '#fbf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2de'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  price-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

### Brand Personality
The design system embodies modern artisanal hospitality: intentional, quiet, and warm. It eschews the loud, hyper-promotional patterns of mass-market food ordering apps in favor of the calm pacing of a curated editorial menu. The user interface prioritizes clarity, respect for visual stillness, and effortless digital hospitality for dine-in guests navigating on mobile viewports.

### Target Audience & Emotional Tone
Tailored for coffee enthusiasts, solo remote workers, and casual dining patrons sitting at a table scanning a physical QR code. The interface evokes a sense of grounded comfort—like handling tactile textured paper under warm pendant lighting—while executing instantaneous, frictionless browsing and table-side ordering.

### Design Movement
**Minimalist Artisanal with Warm Tonal Layers**. The design uses clean structural lines, abundant breathing room, deliberate micro-interactions, subtle borders, and an understated amber accent (`#C26D2D`) derived from extracted espresso and raw terracotta.

## Colors

### Palette System
The palette draws from roasted coffee, ceramic stoneware, and neutral gallery backgrounds to produce an atmosphere of tactile warmth.

- **Primary Accent (`#C26D2D`):** Rich amber-tan. Used with restraint for action indicators, active tab badges, price highlights, and primary bottom CTA actions.
- **Secondary Charcoal (`#241E1B`):** Deep espresso-black. Serves as the high-contrast text color, iconography tone, and selected chip state.
- **Warm Canvas Neutral (`#FBF9F5`):** Soft, unbleached stone background preventing screen glare under indoor cafe lighting.
- **Surface Elevated (`#FFFFFF`):** Pure warm white for product cards, bottom action sheets, and modal drawers.
- **Subtle Outline (`#E7E2DA`):** Low-contrast architectural divider line replacing heavy drop shadows.
- **Tertiary Muted (`#766F66`):** Balanced neutral-grey for secondary item descriptions, volume annotations (e.g., 250ml), and helper text.
- **Status & Sold Out (`#A8A29E` / `#E5E0DA`):** Desaturated warm grey used to systematically step down disabled and sold-out items without visually breaking menu rhythm.

## Typography

### Hierarchy & Pairing Strategy
The typographic pairing balances modern humanist character with rigorous mobile legibility:
- **Headlines (Plus Jakarta Sans):** Offers geometric structure softened by open apertures, lending warmth to product names, category headings, and editorial coffee descriptions.
- **Body & Metadata (Inter):** Highly legible, neutral sans-serif designed for micro-reading on small displays. Used for product tasting notes, portion descriptions, dietary badges, and configuration steps.
- **Tabular Numerals (`font-variant-numeric: tabular-nums`):** Mandatory for all pricing figures to ensure strict visual alignment across stacked item listings and bottom checkout tallies.

## Layout & Spacing

### Mobile-First Constraint
The design system is tuned specifically around a 390px baseline mobile viewport (iPhone standard width) with graceful fluidity between 360px and 430px.

- **Canvas Container:** Anchored with an outer horizontal margin of `16px` (`margin`).
- **Gutter Rhythm:** A continuous `12px` (`gutter`) spacing separates cards, horizontal tag carousels, and dual-column promotional modules.
- **Vertical Flow:** Standard element spacing uses `space-md` (`12px`) for related groups and `space-xl` (`32px`) between disparate menu categories.
- **Safe Area Bottom Insets:** The canvas guarantees a persistent vertical buffer (`88px`) above the physical viewport bottom to ensure zero overlap with the sticky ordering tray and iOS Home Indicator.

## Elevation & Depth

### Low-Contrast Structural Definition
This design system avoids heavy shadows, instead employing subtle tactile boundaries and soft surface differentiation:

- **Level 0 (Base Canvas):** `#FBF9F5` flat surface.
- **Level 1 (Card & Row Item):** `#FFFFFF` surface enclosed by a 1px border (`#E7E2DA`). Zero box shadow to preserve editorial cleanliness.
- **Level 2 (Sticky Chrome & Floating Bars):** `#FFFFFF` with a 92% alpha blur (`backdrop-filter: blur(12px)`), backed by a hairline 1px border (`#E7E2DA`) and an ambient, whisper-light drop shadow: `0 8px 24px rgba(36, 30, 27, 0.06)`.
- **Level 3 (Modal Bottom Sheets):** `#FFFFFF` with an ambient shadow `0 -12px 32px rgba(36, 30, 27, 0.10)` on top of an espresso backdrop overlay tinted to `rgba(36, 30, 27, 0.45)`.

## Shapes

### Corner Geometry
The system uses `roundedness: 2` (0.5rem / 8px baseline) to evoke softly tumbled stone and smooth tableware:
- **Base Components (Inputs, Small Badges, Thumbnails):** `rounded` (8px / `0.5rem`).
- **Cards, Order Banners & Bottom Sheets:** `rounded-lg` (16px / `1rem`).
- **Category Filter Pills & Floating Action Counters:** Fully curved ends (`rounded-full` / pill) for instant thumb-press affordance.

## Components

### 1. Sticky Bottom Order Bar
- **Structure:** Floating dock pinned to the screen bottom with `margin: 16px` horizontal spacing, suspended over menu content.
- **Surface:** Solid `#241E1B` (Espresso) background with `rounded-lg` (16px) corners.
- **Content:** Left side displays an interactive item count badge (`#C26D2D`) with tabular subtotal in pure white (`#FFFFFF`). Right side displays a high-contrast action text ("Review Order" or "Pesan") accompanied by a minimal directional chevron.

### 2. Category Navigation Tabs
- **Structure:** Horizontally scrollable single row with sticky positioning (`top: 0`) under the cafe identity header.
- **Default State:** Transparent background, text colored in `#766F66`, 1px border in `#E7E2DA`.
- **Active State:** `#241E1B` background, white text, pill-shaped contour. Smooth auto-centering on active selection.

### 3. Product List Items & Cards
- **Structure:** Horizontal layout pairing an 88x88px product photo on the left with a flexible typography block on the right.
- **Imagery:** Aspect ratio 1:1, object-fit cover, `rounded` (8px), shot against warm neutral earthenware setups.
- **Price Treatment:** Displayed in tabular numerals (`price-tabular`), right-aligned or baseline-aligned with the product title in `#241E1B`.

### 4. Sold-Out State
- **Visual Rule:** The card drops to 45% opacity. The image receives a grayscale filter (`filter: grayscale(80%)`).
- **Badge:** A quiet stone-colored label (`#766F66`) over `#E5E0DA` stating "Habis / Sold Out" in `label-sm`. The quick-add button is replaced by a disabled flat icon.

### 5. Taste Preference Quiz Prompt
- **Context:** Compact editorial recommendation card placed between menu sections.
- **Style:** Light warm clay surface (`#F4EFEA`) with an amber left-accent bar (3px, `#C26D2D`).
- **Copy & Action:** Conversational, unhurried typography ("Bingung memilih beans hari ini? Coba kurasi 30 detik") with an inline, low-friction text trigger.

### 6. Interactive Stepper & Add Buttons
- **Default Add:** 32x32px circular border button (`#E7E2DA`) containing a clean terracotta-tinted plus icon (`#C26D2D`).
- **Selected Stepper:** Expands horizontally into a pill capsule containing minus, tabular digit counter, and plus, enclosed in a `#241E1B` shell.