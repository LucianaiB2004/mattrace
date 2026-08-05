# MatTrace Complete Skill Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an inspectable, editable, ZIP-exportable `material-evidence-extractor` Skill folder and validate the complete app with a real browser API run.

**Architecture:** A domain module owns the canonical browser-visible Skill file manifest, editable overrides, safety checks, and ZIP generation. The React manager renders that manifest as a file tree with focused overview/example/code views, while the repository mirrors the same required folder contract. Automated tests cover data, structure, UI, dynamic hosting, and static hosting before a temporary in-memory API credential is used for live browser acceptance.

**Tech Stack:** React 19, TypeScript, browser localStorage, JSZip, Node test runner, Playwright, vinext/Vite.

## Global Constraints

- The final deliverable is a complete reusable Skill folder, not an isolated Markdown file.
- The Skill accepts 3–10 papers, patents, or TDS files and produces traceable structured evidence outputs.
- API credentials must never enter localStorage, project snapshots, Skill files, ZIP files, repository files, logs, or screenshots.
- Example and script files are read-only in the manager; `SKILL.md`, `references/output-schema.md`, and `agents/openai.yaml` are editable.
- Browser and ZIP views must use one canonical file manifest.

---

### Task 1: Complete the repository Skill artifact

**Files:**
- Modify: `skills/material-evidence-extractor/SKILL.md`
- Create: `skills/material-evidence-extractor/examples/records.jsonl`
- Create: `skills/material-evidence-extractor/examples/comparison.csv`
- Create: `skills/material-evidence-extractor/examples/evidence-report.md`
- Create: `skills/material-evidence-extractor/examples/missing-and-conflicts.md`
- Create: `skills/material-evidence-extractor/examples/review-queue.csv`
- Create: `skills/material-evidence-extractor/scripts/extract-evidence.mjs`
- Create: `skills/material-evidence-extractor/scripts/normalize-record.mjs`
- Create: `skills/material-evidence-extractor/scripts/build-deliverables.mjs`
- Modify: `tests/skill-structure.test.mjs`

**Interfaces:**
- Produces: the exact 12-file folder contract used by judging and UI fixtures.

- [ ] **Step 1: Extend the structure test to assert the exact required relative paths and required task/output language.**
- [ ] **Step 2: Run `node --test tests/skill-structure.test.mjs` and verify missing examples/scripts fail.**
- [ ] **Step 3: Add concise, executable ESM helpers and internally consistent LLZTO example outputs with document/page/evidence/confidence fields.**
- [ ] **Step 4: Run `node --test tests/skill-structure.test.mjs` and verify it passes.**
- [ ] **Step 5: Commit with `feat: complete reusable material evidence skill`.**

### Task 2: Build the canonical Skill workspace domain

**Files:**
- Modify: `app/domain/skill-workspace.mjs`
- Modify: `tests/skill-workspace.test.mjs`

**Interfaces:**
- Produces: `SKILL_FILES`, `loadSkillWorkspace(storage)`, `saveSkillFile(storage, path, content)`, `resetSkillWorkspace(storage)`, `buildSkillFileDownload(workspace, path)`, and async `buildSkillZip(workspace)`.
- A workspace is `{ files: Array<{ path, content, category, editable, language }> }`.

- [ ] **Step 1: Add failing tests for exact file paths, editable boundaries, per-file persistence, secret rejection, reset, single file download, and ZIP content.**
- [ ] **Step 2: Run `node --test tests/skill-workspace.test.mjs` and verify the new API fails.**
- [ ] **Step 3: Implement the manifest and storage migration from the existing `SKILL.md` key; use JSZip for a root-folder ZIP.**
- [ ] **Step 4: Run the focused tests and inspect the ZIP entries and credential scan assertions.**
- [ ] **Step 5: Commit with `feat: add complete skill workspace domain`.**

### Task 3: Upgrade the Skill manager UI

**Files:**
- Modify: `app/components/SkillManager.tsx`
- Modify: `app/MatTraceDashboard.css`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- Consumes: Task 2 workspace APIs.
- Produces: overview, complete file tree, output-example shortcuts, core-code shortcuts, preview/edit controls, reset, individual download, and ZIP download.

- [ ] **Step 1: Add an E2E test that opens Skill 管理, asserts all directory groups, previews JSONL and core code, edits and persists `SKILL.md`, verifies read-only examples, and downloads the ZIP.**
- [ ] **Step 2: Run the focused Playwright test and verify it fails against the old three-tab UI.**
- [ ] **Step 3: Implement the two-pane responsive workspace with semantic tabs, selected-file state, explicit edit mode, save/revert actions, and ZIP progress/error feedback.**
- [ ] **Step 4: Run the focused E2E test at desktop and existing mobile viewport.**
- [ ] **Step 5: Commit with `feat: present complete skill folder workspace`.**

### Task 4: Full automated and live browser acceptance

**Files:**
- Modify only when a failing acceptance test identifies a product defect.

**Interfaces:**
- Consumes: the completed application and the user-provided runtime gateway/model/key.
- Produces: verified real analysis results without credential persistence.

- [ ] **Step 1: Run `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run test:e2e:static`; require zero failures.**
- [ ] **Step 2: Open `http://localhost:3000/`, enter the gateway, model, and API Key without exposing the key in tool output, and test connection.**
- [ ] **Step 3: Run analysis on all three bundled papers and verify every record has material, property, value/unit, test condition state, source page, evidence, and confidence.**
- [ ] **Step 4: Verify evidence navigation, missing/conflict drawers, JSON/CSV/Markdown output, rename cascade, project save/clear/restore, and complete Skill ZIP download.**
- [ ] **Step 5: Refresh and inspect settings/project data through visible UI to verify the Key is gone; do not inspect browser storage directly.**
- [ ] **Step 6: Run `git diff --check`, scan tracked content for credential patterns, commit any acceptance fix, and report model-output limitations separately from application defects.**
