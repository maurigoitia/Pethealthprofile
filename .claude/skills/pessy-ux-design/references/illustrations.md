# Pessy Illustration Guide

## Style Reference: Pumpkin Pet Insurance

The illustration style is warm, playful, and rounded — inspired by Pumpkin's pet insurance brand.

### Color Palette for Illustrations
(Separate from UI palette — these are for SVG artwork only)

| Color | Hex | Usage |
|-------|-----|-------|
| Deep purple | `#392FB4` | Outlines, eyes, spots, detail elements |
| Violet | `#6256EA` | Cork's body, ears, accent shapes |
| Coral | `#FC6B4D` | Warm fills, bodies, organic shapes |
| Salmon | `#E36045` | Darker coral for shadows, depth |
| Pink | `#C34EAB` / `#DB66C3` | Accent shapes, playful elements |
| Peach | `#FDC5A6` | Skin tones, paws, bellies, highlights |
| Cream | `#FBF2EB` | Faces, light areas, eyes background |

### Character: Cork (Main Mascot)
- Purple cat with oversized head
- Big round white eyes with purple (#6256EA) pupils
- Pink/coral nose
- Surprised/curious expression
- Round ears that stick up
- Body color: #DB66C3 or #6256EA depending on mood

### Drawing Rules
1. **Simple silhouettes** — Shapes should read clearly at 44px
2. **No outlines** — Use color contrast, not strokes
3. **Chunky proportions** — Head is 40-50% of total height
4. **Expressive faces** — Eyes and mouth carry all emotion
5. **Organic shapes** — No perfect circles or sharp angles

### Usage by Context

| Context | Illustration | Size |
|---------|-------------|------|
| Empty state | Cork looking curious + action text | 120-160px |
| Onboarding | Full scene with pet + human | 200-280px |
| Error/404 | Cork surprised/confused | 100-140px |
| Success | Cork celebrating | 80-120px |
| Loading (>3s) | Cork waiting/sleeping | 80-100px |

### SVG Assets Available
The uploaded SVGs show the target style:
- `fishbowl.svg` — Cork (purple cat) with goldfish bowl, full character reference
- `dark_top_surprised_cork_head.svg` — Cork head only, surprised expression
- `annual_limit.svg`, `deductible.svg`, `case_and_vet_bill.svg` — Financial/service icons in the brand style
- `oval_cork_*.svg` — Rounded vignettes with Cork in different contexts
- `oval_customer_success.svg`, `oval_physical_therapy.svg` — Service category illustrations

### Integration Rules
- SVGs should be optimized (SVGO) before committing
- Inline small SVGs (<2KB) as React components
- Lazy-load larger illustrations (>5KB)
- Always provide alt text: `aria-label="Cork the cat looking curious"`
- Place in `public/illustrations/` for static assets or `src/assets/` for bundled
