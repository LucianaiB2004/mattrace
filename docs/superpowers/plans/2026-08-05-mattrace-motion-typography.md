# MatTrace Motion and Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade MatTrace with lively, presentation-oriented motion and larger, more readable body typography without changing application behavior.

**Architecture:** Keep motion entirely in the existing CSS presentation layer and use the current component classes as stable hooks. Browser acceptance tests verify computed typography, hover transforms, persistent mascot animation, mobile overflow, and reduced-motion behavior; no animation library or new runtime state is introduced.

**Tech Stack:** React 19, CSS animations/transitions, Vinext, Playwright.

## Global Constraints

- Preserve all existing functionality, data flow, API behavior, exports, and accepted layout.
- Use only transform, opacity, filter, box-shadow, background-position, and existing CSS properties; add no animation dependency.
- Keep the mascot image and current brand palette.
- All persistent motion must stop under `prefers-reduced-motion: reduce`.
- Desktop body text becomes visibly larger while the 390px mobile layout remains free of page-level horizontal overflow.

---

### Task 1: Typography and motion acceptance contract

**Files:**
- Modify: `tests/e2e/mattrace.spec.ts`
- Modify: `app/MatTraceDashboard.css`

**Interfaces:**
- Consumes: existing `.section-heading`, table, `.evidence-card`, `.mode-banner`, `.session-card`, and `.alert-card` DOM hooks.
- Produces: computed desktop body text of at least 12px for core content, with mobile page overflow at most 1px.

- [ ] **Step 1: Add a failing browser test for readable computed typography**

Add a test that opens `/`, waits for hydration, and asserts literal minimum computed font sizes for the main section description, table body cell, evidence quote, mode banner, and session copy. Keep the existing 390px overflow assertion.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx playwright test tests/e2e/mattrace.spec.ts --grep "body typography"`

Expected: FAIL because current table, banner, and session text compute below 12px.

- [ ] **Step 3: Increase the body typography scale minimally**

Update existing selectors in `MatTraceDashboard.css`: section descriptions to 13px, table cells to 12px, table headers to 11px, evidence quote to 13px, alert/session/mode copy to 11–12px, and supporting buttons to at least 11px. Adjust padding and line-height only where required to prevent crowding.

- [ ] **Step 4: Run focused desktop and mobile tests**

Run: `npx playwright test tests/e2e/mattrace.spec.ts --grep "body typography|mobile layout"`

Expected: PASS with no page-level overflow.

- [ ] **Step 5: Commit**

```powershell
git add app/MatTraceDashboard.css tests/e2e/mattrace.spec.ts
git commit -m "style: improve MatTrace body readability"
```

### Task 2: Mascot and sidebar presentation motion

**Files:**
- Modify: `tests/e2e/mattrace.spec.ts`
- Modify: `app/MatTraceDashboard.css`

**Interfaces:**
- Consumes: `.mascot-zone`, `.mascot-zone img`, `.mascot-zone p`, `.nav-item`, `.nav-icon`, and `.skill-pill`.
- Produces: persistent mascot float animation, hover tilt, nav lift/glow, active-item sheen, and animated skill status.

- [ ] **Step 1: Add failing interaction assertions**

Add browser assertions that the mascot image has a non-`none` animation name, a sidebar item changes transform and box shadow when hovered, and the mascot hover changes its computed transform. Assert using computed styles before and after real Playwright `hover()` calls.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx playwright test tests/e2e/mattrace.spec.ts --grep "mascot and sidebar motion"`

Expected: FAIL because the mascot has no animation and the current nav hover lacks vertical lift/glow.

- [ ] **Step 3: Implement lively sidebar motion**

Add `mascotFloat`, `mascotGlow`, `handwritingDrift`, `activeSheen`, and `statusPing` keyframes. Apply a 3.6-second float/sway cycle to the mascot, hover tilt/scale to the mascot image, glow breathing to its pseudo-element, a sheen pseudo-element to active nav, and `translate3d(5px,-2px,0)` plus shadow and icon scale to nav hover.

- [ ] **Step 4: Verify the focused test passes**

Run: `npx playwright test tests/e2e/mattrace.spec.ts --grep "mascot and sidebar motion"`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/MatTraceDashboard.css tests/e2e/mattrace.spec.ts
git commit -m "style: animate mascot and sidebar interactions"
```

### Task 3: Cards, progress, upload, and table micro-interactions

**Files:**
- Modify: `tests/e2e/mattrace.spec.ts`
- Modify: `app/MatTraceDashboard.css`

**Interfaces:**
- Consumes: `.card`, `.summary-card`, `.alert-card`, `.drop-zone`, `.upload-art`, `.stage-icon`, `.stage-top`, and table rows.
- Produces: card lift, icon pop, upload float, active progress pulse, completed-track sheen, and table-row movement.

- [ ] **Step 1: Add failing hover behavior test**

After an example run, measure a summary card and alert card before/after hover and assert both change transform and shadow. Hover a data row and assert its transform is not `none`. Assert `.upload-art` has a non-`none` animation name.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx playwright test tests/e2e/mattrace.spec.ts --grep "workspace micro interactions"`

Expected: FAIL because these elements currently lack the required lift and persistent upload animation.

- [ ] **Step 3: Implement interaction styles**

Add shared transition timing, card `translateY(-4px)` lift, summary icon spring transform, alert icon rotation/scale, `uploadFloat` animation, stronger drag pulse, table-row `translateX(3px)`, and a subtle gradient motion on active/completed workflow connectors.

- [ ] **Step 4: Verify focused and existing workflow tests**

Run: `npx playwright test tests/e2e/mattrace.spec.ts --grep "workspace micro interactions|example mode"`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add app/MatTraceDashboard.css tests/e2e/mattrace.spec.ts
git commit -m "style: add workspace micro interactions"
```

### Task 4: Reduced motion, visual review, and full regression

**Files:**
- Modify: `tests/e2e/mattrace.spec.ts`
- Modify: `app/MatTraceDashboard.css`
- Update: `docs/mattrace-complete-preview.png`
- Update: `docs/mattrace-mobile-preview.png`

**Interfaces:**
- Consumes: all motion introduced in Tasks 2–3.
- Produces: animation-safe reduced-motion mode and reviewer-visible desktop/mobile evidence.

- [ ] **Step 1: Add a failing reduced-motion assertion**

Use `page.emulateMedia({ reducedMotion: "reduce" })`, reload, and assert the mascot, upload icon, stage icon, active navigation sheen, and status dot all compute to `animation-name: none`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx playwright test tests/e2e/mattrace.spec.ts --grep "reduced motion"`

Expected: FAIL until every new persistent animation is covered by the existing reduced-motion media query.

- [ ] **Step 3: Complete reduced-motion CSS**

Extend `@media (prefers-reduced-motion: reduce)` so all animations are disabled, transforms remain stable, and transitions become effectively instantaneous.

- [ ] **Step 4: Run full verification**

Run: `npm test`

Run: `npm run lint`

Run: `npm run test:e2e`

Run: `npm run test:e2e:static`

Expected: all unit/render tests, all browser tests, and both builds pass.

- [ ] **Step 5: Inspect desktop and mobile screenshots**

Capture the accepted desktop and 390px mobile views, inspect them for clipping, crowding, broken card alignment, and page-level overflow, then update the two committed preview images only after visual acceptance.

- [ ] **Step 6: Commit**

```powershell
git add app/MatTraceDashboard.css tests/e2e/mattrace.spec.ts docs/mattrace-complete-preview.png docs/mattrace-mobile-preview.png
git commit -m "test: verify lively MatTrace presentation"
```
