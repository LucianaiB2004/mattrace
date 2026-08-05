# MatTrace PDF Preview and Skill Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inspectable PDF previews, a persistent browser-based Skill manager, and a consistent typography scale to the competition demo.

**Architecture:** Keep document binary preview state in the dashboard and isolate Skill persistence/export in a small domain module. Reuse the existing right drawer so all new functionality works in both the dynamic app and static GitHub Pages build.

**Tech Stack:** React 19, TypeScript, browser Blob/Object URL APIs, localStorage, Playwright, Node test runner.

## Global Constraints

- No backend or account is required.
- API keys must never enter Skill storage, exports, logs, or URLs.
- User Skill edits persist in browser local storage and export as `SKILL.md`.
- Document cards and drawers must not describe bundled literature as examples.
- Preserve responsive layout and reduced-motion support.

---

### Task 1: Skill workspace domain

**Files:**
- Create: `app/domain/skill-workspace.mjs`
- Create: `tests/skill-workspace.test.mjs`

**Interfaces:**
- Produces: `loadSkill(storage)`, `saveSkill(storage, content)`, `resetSkill(storage)`, and `buildSkillDownload(content)`.

- [ ] Write tests proving default load, persistent save, reset, empty-content rejection, credential rejection, and Markdown download metadata.
- [ ] Run `node --test tests/skill-workspace.test.mjs` and verify the missing module fails.
- [ ] Implement the minimal pure storage and validation helpers.
- [ ] Run the focused test and verify it passes.
- [ ] Commit with `feat: add local Skill workspace`.

### Task 2: Skill management drawer

**Files:**
- Create: `app/components/SkillManager.tsx`
- Modify: `app/MatTraceDashboard.tsx`
- Modify: `app/MatTraceDashboard.css`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- Consumes: Skill workspace domain functions.
- Produces: second-position `Skill 管理` navigation and overview/preview/edit actions.

- [ ] Add a Playwright test that opens the second navigation item, edits the Skill, saves it locally, reloads, restores it, and downloads `SKILL.md`.
- [ ] Run the focused Playwright test and verify it fails before UI implementation.
- [ ] Implement the drawer with overview, preview, edit, save, restore, and download controls.
- [ ] Run the focused test and verify it passes.
- [ ] Commit with `feat: add Skill management workspace`.

### Task 3: Real PDF drawer preview

**Files:**
- Modify: `app/services/document-parser.mjs`
- Modify: `app/MatTraceDashboard.tsx`
- Modify: `app/MatTraceDashboard.css`
- Modify: `tests/text-parser.test.mjs`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- Parsed PDF documents gain optional `previewUrl`; non-PDF documents do not.
- The drawer exposes `PDF 原文` and `解析文本` tabs for PDF documents.

- [ ] Add unit and browser tests for object URL attachment, document wording, and PDF/text preview tab switching.
- [ ] Run focused tests and verify they fail.
- [ ] Retain PDF URLs in memory, render the PDF in an object/embed frame, and revoke URLs on removal/unmount.
- [ ] Remove “示例” wording from document cards, document manager, workflow footer, and completion notifications.
- [ ] Run focused tests and verify they pass.
- [ ] Commit with `feat: add real PDF document preview`.

### Task 4: Typography system and full verification

**Files:**
- Modify: `app/MatTraceDashboard.css`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- Produces CSS custom properties `--text-display`, `--text-drawer`, `--text-section`, `--text-card`, `--text-body`, `--text-support`, and `--text-meta`.

- [ ] Extend browser typography assertions to cover page, drawer, section, body, table, supporting, and metadata text.
- [ ] Run the focused test and verify current scattered sizes fail.
- [ ] Replace comprehension-critical 8-10px rules with the approved semantic scale while preserving responsive layout.
- [ ] Run `npm test`, `npm run lint`, `npm run test:e2e`, and `npm run test:e2e:static`.
- [ ] Inspect fresh desktop and mobile screenshots and commit with `style: standardize MatTrace typography`.

