# Conditions Field Guide — design QA

**Findings**

No actionable P0, P1, or P2 findings remain in the reviewed homepage. The post-fix implementation preserves the selected design's hierarchy, proportions, palette, prominent Lower Deschutes entry point, and practical water directory.

- **[P3, expected] Fine landscape detail compresses inside the small fish mark.** Location: header, footer, and proposed-water row logos. Evidence: the approved weather-fish artwork remains recognizable in `artifacts/field-guide/home-1084.png` and `home-375.png`, while individual trees and weather strokes merge at small sizes. Impact: no loss of brand recognition or usable text. Fix: no acceptance fix required; any future optical small-size variant should preserve the approved silhouette, branching cream channel, and sun eye.

**Open Questions**

No unresolved visual-design questions. This is homepage fidelity QA, not a claim that fishing regulations, access, additional waters, or live provider coverage have completed editorial review.

The selected mock supplies a desktop state only. Responsive layouts and native proposed-water disclosure states therefore receive a usability and consistency review rather than a pixel-identical source comparison. The pilot badge is omitted at the constrained 768 px masthead breakpoint; the proposed-coverage and reach-review labels remain visible in the page. This is an acceptable responsive tradeoff.

**Comparison Target and Evidence**

Paths below are relative to `oregon-fish-forecast/` unless prefixed with `../`.

- Source visual truth: [selected Conditions Field Guide mock](../homepage-exploration/3-conditions-field-guide-landscape-v3.png), **1084 × 1451 px**.
- Implementation: local Chromium render of `http://127.0.0.1:8787/`, produced by [capture-field-guide.ts](scripts/capture-field-guide.ts). Chromium checks were explicitly authorized by the user.
- Matched comparison: **1084 CSS px wide**, browser viewport **1084 × 1000 CSS px**, `deviceScaleFactor: 1`; full-page capture [home-1084.png](artifacts/field-guide/home-1084.png) is **1084 × 1460 px**.
- Normalization: source treated as 1084 CSS px at 1× and implementation captured at 1×. Both appear at exactly 1084 px width in the combined comparison; no density resampling, device bezel, browser chrome, or aspect-ratio stretching. The 9 px difference in full-page height is approximately 0.6% and does not change section hierarchy.
- State: home route, paper/light theme, loaded DM Sans and all images, “The waters” selected, proposed-water disclosures collapsed, no authentication.
- Full-view evidence: [comparison-full.png](artifacts/field-guide/comparison-full.png), **2192 × 1600 px**, source and implementation together in the same image. Comparison-board labels and outer padding are excluded from judgments.
- Focused evidence: [comparison-hero.png](artifacts/field-guide/comparison-hero.png), **2192 × 530 px**, combines the header, headline, hero illustration, and top of the featured reach at matching scale.
- Additional state: [proposed-water-open.png](artifacts/field-guide/proposed-water-open.png), **335 × 232 px**, captures the expanded Crooked River row at a 375 CSS px viewport. The description, proposed status, rotated disclosure arrow, and methodology link remain aligned and readable.

| Additional viewport | Full-page capture | Document width | Review |
| --- | --- | --- | --- |
| 1440 × 1000 CSS px, 1× | [home-1440.png](artifacts/field-guide/home-1440.png), 1440 × 1958 px | 1440 px | Desktop spacing, large artwork, and directory/photo balance inspected |
| 768 × 1000 CSS px, 1× | [home-768.png](artifacts/field-guide/home-768.png), 768 × 1484 px | 768 px | Tablet columns and wrapping inspected |
| 375 × 1000 CSS px, 1× | [home-375.png](artifacts/field-guide/home-375.png), 375 × 2892 px | 375 px | Stacked layout, navigation, pilot badge, CTA, and coverage labels inspected |
| 320 × 1000 CSS px, 1× | [home-320.png](artifacts/field-guide/home-320.png), 320 × 2926 px | 320 px | Narrow layout and longer water names inspected |

[checks.json](artifacts/field-guide/checks.json) confirms no horizontal overflow at any recorded width, DM Sans loaded throughout, all recorded images loaded, and an empty console/page-error list.

**Five Required Fidelity Surfaces**

| Surface | Assessment |
| --- | --- |
| Fonts and typography | **Passed.** Computed family is DM Sans with Arial/sans-serif fallback; loaded-font checks pass at every width. Heavy blue display type, two-line hero wrapping, tighter heading tracking, legible body line-height, uppercase green labels, and white header wordmark reproduce the intended hierarchy. The headline retains the actual space in “know the water.” No truncation or collisions appear. Minor raster-reference antialiasing differences are expected. |
| Spacing and layout rhythm | **Passed after iteration.** The blue masthead, two-column hero, 44/56 featured reach, three-column information rail, ruled directory, and blue footer follow the source. At matched 1084 px, major section boundaries now align closely; the implementation is 1460 px tall against 1451 px. Card radii, thin borders, paper margins, and restrained separation remain consistent. Mobile stacks intentionally without clipping, overlap, or nested-card clutter. |
| Colors and visual tokens | **Passed.** Oregon blue `#002A86`, gold `#FFEA0F`, evergreen `#285D45`, warm paper `#F5F2E9`, and near-white `#FFFEF8` retain the selected balance. Active navigation and the primary CTA use gold consistently. Proposed states remain quiet green labels, not live-status indicators. The solid paper background is an acceptable implementation of the mock's slight raster texture. The improved mobile badge foreground/background separation is visibly clearer. This visual check is not a comprehensive measured WCAG contrast audit. |
| Image quality and asset fidelity | **Passed with intentional substitutions.** The mountains, pine forest, blue river, and gold sun are a built-in Image Gen extraction/recreation of the selected hero, saved as transparent artwork rather than recreated with CSS or hand-drawn SVG. Scale and composition match; no visible rectangular background, stretching, or distracting alpha halo appears. The approved fish artwork is used throughout. User-supplied real Deschutes and Metolius photographs intentionally replace synthetic scenery; their subject, crop, sharpness, and region captions work in the intended slots. Standard interface icons remain consistent in stroke, alignment, and purpose. |
| Copy and content | **Passed.** The headline, one Lower Deschutes CTA, exact “Warm Springs to Trout Creek” reach, and “Reach review in progress” remain prominent. All five additional waters are explicitly proposed. Updated source descriptions correctly limit claims to validated observations and reviewed forecast points. Captions identify regional scenery rather than access locations. No bite score, invented observation, catch guarantee, misleading live status, or claim of completed regulations review appears. |

**Comparison History**

1. **Initial visual pass — blocked by P2 differences.**
   - Intermediate desktop spacing made the 1084 px page approximately **1718 px** tall against the 1451 px reference, shifting the featured reach and directory too far down.
   - The Central Oregon pilot badge disappeared at 1084 px and on mobile.
   - Mobile proposed-coverage pills were too small and faint.
   - A headline text-space regression was identified and fixed during the browser test pass.
2. **Implementation fixes.**
   - Tightened intermediate-desktop typography, gaps, and component spacing in `src/field-guide.css`.
   - Restored the pilot badge at 1084 px and mobile widths.
   - Increased mobile proposed-coverage text to 10 px and darkened it.
   - Retained an explicit space in the headline's text content in `src/home.ts`.
3. **Post-fix comparison — passed.**
   - The combined full-view and focused hero evidence listed above replaces the earlier captures and was independently reopened and compared.
   - The revised 1084 px height is **1460 px**. The main page proportions and above-the-fold hierarchy now follow the reference.
   - The 375/320 px captures visibly show the pilot label and readable coverage badges. No new actionable P0/P1/P2 issue was found.
   - Earlier images were overwritten by the repeatable capture script; the earlier measurements and findings are recorded here rather than presented as retained screenshots.

**Intentional Implementation Differences**

- Real, user-supplied river photos and visible regional captions replace generated photographic geography.
- Source and coverage copy was adjusted to match the reviewed product scope.
- Proposed waters use native disclosures with explanatory content and a methodology link; they do not navigate to nonexistent conditions pages.
- The selected desktop composition adapts to mobile by stacking the hero, featured reach, information rail, directory, and supporting photo.

**Interaction and Regression Evidence**

The implementation agent reports that the full **24-test Chromium browser suite passed** after the headline-space correction. The suite in [site.spec.ts](tests/browser/site.spec.ts) includes keyboard primary navigation, the featured Lower Deschutes route, artwork loading, proposed-water keyboard expand/collapse, coverage-methodology navigation, and narrow-screen overflow. Provider fixtures in browser tests are synthetic and do not validate live conditions.

The final screenshot capture records image/font readiness, no console/page errors, and no overflow at 1084, 1440, 768, 375, and 320 px. The expanded-row visual state was inspected. After the hash-focus and shared-sidebar-logo adjustments, the implementation agent confirmed that `npm run build` passed and the focused Chromium command `npm run test:browser -- --grep 'primary navigation|proposed waters|homepage artwork'` passed **3/3 tests**, including the new back/forward `#coverage` focus assertion. The earlier full browser suite passed **24/24**, data tests passed **26/26**, and the Worker dry run passed. The final [conditions-sidebar-synthetic.png](artifacts/field-guide/conditions-sidebar-synthetic.png) and [methodology-sidebar.png](artifacts/field-guide/methodology-sidebar.png) were inspected by the implementation agent: logos remain constrained to 43 px and 50 px respectively, with adjacent text intact. This report does not claim a separate comprehensive screen-reader, zoom, every-browser, or real-provider audit.

**Asset Provenance and Reproducibility**

- Landscape source: `../homepage-exploration/3-conditions-field-guide-landscape-v3.png`.
- Transparent landscape master: [river-country-landscape.png](public/brand/river-country-landscape.png), **1717 × 916 px**; served derivative: `public/brand/river-country-landscape.webp`.
- Exact landscape generation prompt and preserved original-output path: [river-country-landscape.prompt.json](public/brand/river-country-landscape.prompt.json). Generated with the **built-in Image Gen edit tool**, `transparent_background: true`; the source screenshot was inspected and supplied as the reference.
- Fish source: `../logo-exploration/confluence-weather/lake-billy-chinook-sun-eye-v4.png`.
- Transparent fish master: [weather-fish.png](public/brand/weather-fish.png), **1804 × 872 px**; served derivative: `public/brand/weather-fish.webp`.
- Fish extraction prompt and source: [weather-fish.json](public/brand/weather-fish.json), also produced with the **built-in Image Gen tool**.
- Real photographs: `public/photos/deschutes-river.jpg` and `public/photos/metolius-river.jpg`.
- Rendering and paired comparison workflow: [capture-field-guide.ts](scripts/capture-field-guide.ts). Run against the local preview at port 8787; captures use 1× density and wait for fonts/images.

**Follow-up Polish**

Only the expected P3 small-logo detail compression remains. Keep the approved artwork for this handoff; a future small-size variant is optional design work, not a missing acceptance fix.

**Implementation Checklist**

- [x] Compare source and rendered homepage together at matching 1084 CSS px / 1×.
- [x] Inspect focused hero/header evidence and the open proposed-water state.
- [x] Review fonts, spacing, colors, image quality, and content explicitly.
- [x] Resolve and recapture the initial P2 spacing, pilot-label, and badge-legibility findings.
- [x] Inspect 1440, 768, 375, and 320 px responsive layouts and confirm captured overflow/error checks.
- [x] Preserve pilot truth, approved artwork, source photographs, and reproducible asset prompts.
- [x] Record final targeted hash-focus/shared-sidebar verification: build passed, focused Chromium tests 3/3 passed, sidebar captures inspected, and final capture checks passed at every recorded width.

final result: passed

