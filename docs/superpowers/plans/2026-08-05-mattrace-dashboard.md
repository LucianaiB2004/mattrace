# MatTrace Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, interactive MatTrace dashboard matching the supplied reference and safe for eventual GitHub Pages publication.

**Architecture:** A single Vinext/React route renders the dashboard. Focused client utilities own configuration, demo state, and exports; the page composes those units without persistence. Static assets live in `public/`, while the competition Skill remains independently runnable under `skills/`.

**Tech Stack:** React 19, Vinext, TypeScript, CSS, Node test runner, browser File API.

## Global Constraints

- Default gateway: `https://ai.chipcloud.cc`.
- Default model: `qwen3.8-max`.
- Never embed, persist, log, or export an API key.
- Keep one dashboard route and one competition Skill directory.
- Use the supplied screenshot as the visual reference without copying its sample model name.
- Make every primary control keyboard accessible and responsive.

---

### Task 1: Replace the starter with tested MatTrace foundations

**Files:**
- Create: `tests/mattrace-core.test.mjs`
- Create: `app/lib/mattrace-core.mjs`
- Modify: `package.json`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: `DEFAULT_PROVIDER`, `createDemoState()`, `advanceDemoState(state)`, `serializeExport(format, records)`.

- [ ] Write tests asserting the gateway/model defaults, six-stage progression, and JSON/CSV/Markdown exports.
- [ ] Run the focused test and verify it fails because `app/lib/mattrace-core.mjs` is missing.
- [ ] Implement the smallest pure module that satisfies those behaviors.
- [ ] Replace starter HTML expectations with MatTrace landmark expectations.
- [ ] Make package scripts Windows-compatible and remove starter-only dependencies.
- [ ] Run the focused tests and verify they pass.

### Task 2: Build the interactive dashboard

**Files:**
- Create: `app/MatTraceDashboard.tsx`
- Create: `app/MatTraceDashboard.css`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Delete: `app/_sites-preview/SkeletonPreview.tsx`
- Delete: `app/_sites-preview/preview.css`

**Interfaces:**
- Consumes: the Task 1 core exports.
- Produces: one responsive dashboard with upload, configuration, progress, evidence, alerts, and exports.

- [ ] Add a failing rendered-HTML test for the MatTrace page title, upload area, progress region, evidence table, and provider/model text.
- [ ] Run the rendered-HTML test and verify it fails against the starter.
- [ ] Implement the semantic page structure and metadata.
- [ ] Add client interactions for navigation, upload listing, model configuration, demo progress, evidence preview, and downloads.
- [ ] Add responsive styles matching the supplied visual hierarchy.
- [ ] Run the rendered-HTML and core tests and verify they pass.

### Task 3: Add the competition Skill skeleton

**Files:**
- Create: `skills/material-evidence-extractor/SKILL.md`
- Create: `skills/material-evidence-extractor/references/output-schema.md`
- Create: `tests/skill-structure.test.mjs`

**Interfaces:**
- Produces: a valid single Skill directory with explicit input, workflow, evidence, and output contracts.

- [ ] Write a failing structure test for one Skill directory and valid frontmatter.
- [ ] Run it and verify the missing Skill failure.
- [ ] Add the minimal Skill and output schema used by the dashboard copy.
- [ ] Run the structure test and verify it passes.

### Task 4: Generate and integrate project imagery

**Files:**
- Create: `public/mattrace-mascot.png`
- Create: `public/og.png`
- Modify: `app/MatTraceDashboard.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: an original mascot asset and social preview aligned to the finished site.

- [ ] Generate one compact research-robot mascot using the supplied screenshot only as style reference.
- [ ] Remove its chroma-key background and verify alpha coverage.
- [ ] Generate one social-preview image after site copy and palette are stable.
- [ ] Inspect both assets and integrate only validated outputs.

### Task 5: Verify the complete prototype

**Files:**
- Modify only files required by evidence-backed failures.

**Interfaces:**
- Consumes: the entire prototype.
- Produces: passing tests, a production build, and verified desktop/mobile interactions.

- [ ] Run all tests and record the pass count.
- [ ] Run the production build and confirm exit code 0.
- [ ] Open the local site and verify the requested desktop layout.
- [ ] Verify upload, settings, demo progress, evidence selection, and exports.
- [ ] Verify a mobile viewport and keyboard focus behavior.
- [ ] Review `git diff` for secrets and unrelated changes.

