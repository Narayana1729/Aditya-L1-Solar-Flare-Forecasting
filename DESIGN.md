# Design System: Aditya-L1 Solar Flare Forecasting Cockpit

This document establishes the UI/UX design tokens, typography, component behaviors, and spatial layout principles for the **Aditya-L1 Solar Flare Forecasting System**.

---

## 1. Visual Theme & Atmosphere

The interface is structured as a **Mission Control Cockpit (Density: 8.5/10)**, balancing high-density solar telemetry streams with a clean, dark-mode gallery aesthetic. The environment is designed to feel highly clinical, high-integrity, and operationally critical.

*   **Density**: Cockpit Dense. Information is organized via tight structural grids, thin borders, and clean alignment—maximizing screen real estate without causing cognitive fatigue.
*   **Variance**: Left-Aligned, asymmetric splits. Telemetry charts occupy the primary visual field, flanked by a dense sidebar containing alert decks and checklists.
*   **Motion**: Fluid, spring-physics micro-interactions. Alerts, countdowns, and active dials exhibit subtle, perpetual animations to indicate live telemetry connections.

---

## 2. Color Palette & Roles

To ensure high readability and maintain professional cockpit standards, the palette employs a single high-contrast solar accent over absolute neutral Slate/Zinc surfaces. The generic neon-purple/blue glow is strictly banned.

*   **Deep Canvas** (`#09090B`) — Primary background surface (Zinc-950)
*   **Pure Surface** (`#18181B`) — Panels, cards, and container fill
*   **High-Contrast Text** (`#FAFAFA`) — Primary titles, critical numbers, and headers
*   **Muted Steel** (`#A1A1AA`) — Secondary descriptions, captions, and units
*   **Whisper Border** (`rgba(255, 255, 255, 0.08)`) — Structural 1px division lines
*   **Solar Amber** (`#F97316`) — Accent color for active warnings, primary buttons, and highlight rings
*   **Safety Emerald** (`#10B981`) — Indicators representing "Quiet" solar conditions
*   **Threat Crimson** (`#EF4444`) — Indicators representing active solar flares (C, M, X-class)

---

## 3. Typography Rules

*   **Display & Headers**: `Outfit` — Track-tight, controlled scale. Hierarchy is achieved using font weights (`SemiBold` or `Medium`) and contrast rather than oversized text.
*   **Body & Descriptions**: `Satoshi` — Clear readability with relaxed leading. Paragraph lines are restricted to a maximum of 65 characters.
*   **Telemetry & Numbers**: `JetBrains Mono` — High-density, tabular numbers. All timestamps, raw flux values, count rates, and coordinates must use monospace formatting to prevent layout jitter during data updates.
*   **Banned**: `Inter` and generic system fonts (Times New Roman, Georgia, Arial) are banned. Generic serifs are strictly prohibited.

---

## 4. Component Stylings

### Buttons
*   **Styling**: Flat borders with zero outer glows.
*   **Interaction**: $-1\text{px}$ vertical translate on active click for tactile feel.
*   **Variants**: Accent fill (`#F97316`) for primary actions (e.g. manual shutter override), outline/ghost for secondary filters.

### telemetry Cards
*   **Styling**: Rounded corners (`0.75rem`), with fine borders (`rgba(255,255,255,0.08)`) instead of heavy shadows to maintain a flat, screen-level dashboard.
*   **Grouping**: Replace card nesting with simple border-top dividers or negative spacing.

### Inputs & Selectors
*   **Styling**: Labels placed strictly above inputs. Active focus states apply a thin `$1\text{px}$` border in `Solar Amber`. No floating labels are permitted.

### Loading & Skeletal States
*   **Styling**: Flat skeletal shimmer blocks matching the exact dimensions of telemetry charts. Bounces and circular spinners are banned.

---

## 5. Layout Principles

*   **Containment**: Full viewport layouts use `min-h-[100dvh]` to avoid mobile Safari layout jumps.
*   **Structure**: CSS Grid is used for multi-channel charts to maintain alignment. Absolute stacking or overlapping of text/telemetry labels is prohibited.
*   **Responsive Collapse**: All dashboard segments collapse to a single column below `768px`. Horizontal scrolling on mobile is treated as a layout failure.
*   **Touch Targets**: Tap targets for button controls and dropdown overrides are a minimum of `44px`.

---

## 6. Motion & Interaction

*   **Spring Physics**: Transitions use natural weight damping:
    ```javascript
    stiffness: 100, damping: 20
    ```
*   **Live Feeds**: The streaming ticker and prediction probability indicators display a slow, hardware-accelerated pulse or shimmer loop to indicate active data ingestion.
*   **Performance**: Animations are restricted to `transform` and `opacity` to maintain 60 FPS on low-power devices.

---

## 7. Anti-Patterns (Banned)

*   **No Emojis**: Forbidden in titles, labels, or badges. Use clean vector icons.
*   **No Inter**: Forbidden. Use `Outfit` and `JetBrains Mono`.
*   **No Pure Black**: Never use `#000000`. Use `#09090B`.
*   **No Neon/Glow Shadows**: Forbidden.
*   **No Fabricated Data**: If telemetry is missing, display `[no connection]` or `N/A`. Do not invent dummy placeholder values.
*   **No Copywriting Clichés**: Avoid words like "Seamless", "Unleash", or "Next-Gen". Use exact, operational space weather terminology.
