# MatTrace Evidence Coverage Auditor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select any 1–20 workspace documents, analyze every selected document independently, and deliver reviewer-visible coverage and comparability audit outputs powered by the actual Skill contract.

**Architecture:** Selection is stable document-ID state owned by the dashboard. A batch-analysis service runs document-scoped model requests with concurrency two and returns explicit per-document outcomes; a pure audit domain merges successful records, derives coverage/passports/scores, and feeds UI/export. Runtime prompt rules are exported from the Skill workspace contract so the displayed Skill and model behavior share one source.

**Tech Stack:** React 19, TypeScript, ESM domain modules, OpenAI-compatible chat API, Node tests, Playwright, vinext/Vite.

## Global Constraints

- Workspace capacity is exactly 20 documents; analysis accepts exactly 1–20 selected documents.
- No selected document may be silently omitted: each outcome is `extracted`, `no_evidence`, `failed`, or `cancelled`.
- Model calls run with maximum concurrency 2 and share one AbortSignal.
- Skill core rules must be included in each model request without API credentials.
- Scores are deterministic from record/outcome fields, never model self-scores.
- Existing PDF preview, rename provenance, provider memory, project privacy, and static hosting must continue working.

---

### Task 1: 20-document capacity and stable selection

**Files:**
- Modify: `app/services/file-validation.mjs`
- Modify: `app/MatTraceDashboard.tsx`
- Modify: `app/MatTraceDashboard.css`
- Modify: `tests/file-validation.test.mjs`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- Produces dashboard `selectedDocumentIds: Set<string>` and selected `ParsedDocument[]`.

- [ ] Write failing capacity tests asserting 20 accepted and item 21 rejected.
- [ ] Run `node --test tests/file-validation.test.mjs` and verify the old cap fails.
- [ ] Change `MAX_FILES` to 20 and pass focused tests.
- [ ] Add failing E2E coverage for selected count, card checkbox, select-all/clear-all, preview independence, and only selected documents reaching mocked API requests.
- [ ] Implement selection state, cleanup on delete/clear/restore, default selection on load/upload, and `已添加 N/20 · 已选择 M 篇` UI.
- [ ] Run focused E2E and commit `feat: select up to twenty analysis documents`.

### Task 2: Skill-backed per-document analysis pipeline

**Files:**
- Modify: `app/domain/skill-workspace.mjs`
- Modify: `app/domain/prompt.mjs`
- Create: `app/services/batch-analysis.mjs`
- Modify: `app/services/ai-client.mjs`
- Modify: `tests/prompt.test.mjs`
- Create: `tests/batch-analysis.test.mjs`
- Modify: `tests/ai-client.test.mjs`

**Interfaces:**
- Produces `RUNTIME_SKILL_CONTRACT`, `buildDocumentAnalysisMessages(document)`, `analyzeDocument(config, document, fetch, signal)`, and `analyzeDocumentBatch(config, documents, options)`.
- Batch outcome shape: `{ documentId, documentName, pageCount, status, records, checkedPages, reason }`.

- [ ] Write failing prompt tests requiring Skill rules, one document only, all-record extraction, and no “representative one record” language.
- [ ] Implement compact runtime Skill contract and document-scoped prompt; pass prompt tests.
- [ ] Write failing batch tests for concurrency two, input-order outcomes, `no_evidence`, partial failure, cancellation, and no omission.
- [ ] Implement `analyzeDocument` and a two-worker batch queue using one AbortSignal.
- [ ] Run focused service tests and commit `feat: analyze every selected document`.

### Task 3: Deterministic coverage and comparability audit

**Files:**
- Create: `app/domain/evidence-audit.mjs`
- Create: `tests/evidence-audit.test.mjs`
- Modify: `app/domain/analysis.mjs`
- Modify: `app/domain/export-report.mjs`
- Modify: `tests/export-report.test.mjs`

**Interfaces:**
- Produces `buildEvidenceAudit(outcomes)` returning `{ records, coverageMatrix, passports, scores, missingConditions, conflicts, summary }`.
- Produces export formats `coverage-csv` and `passports-jsonl` alongside existing report formats.

- [ ] Write failing tests for all four outcome statuses, coverage rate, condition completeness, traceability, comparability grouping/reasons, and review counts.
- [ ] Implement deterministic audit calculations and pass focused tests.
- [ ] Write failing export tests for exact coverage CSV columns and one passport JSON object per line.
- [ ] Implement exports and pass report regression tests.
- [ ] Commit `feat: add evidence coverage and comparability audit`.

### Task 4: Reviewer-visible workflow and upgraded Skill artifact

**Files:**
- Modify: `app/MatTraceDashboard.tsx`
- Create: `app/components/EvidenceCoveragePanel.tsx`
- Modify: `app/MatTraceDashboard.css`
- Modify: `skills/material-evidence-extractor/SKILL.md`
- Modify: `skills/material-evidence-extractor/references/output-schema.md`
- Create: `skills/material-evidence-extractor/examples/coverage-matrix.csv`
- Create: `skills/material-evidence-extractor/examples/comparability-passports.jsonl`
- Modify: `app/domain/skill-workspace.mjs`
- Modify: `tests/skill-structure.test.mjs`
- Modify: `tests/skill-workspace.test.mjs`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- Consumes Task 2 outcomes and Task 3 audit.
- Produces per-document progress, coverage matrix, passport view, four score cards, retry-visible errors, and two download actions.

- [ ] Add failing structure/workspace tests for 1–20 wording, new identity, and two new example files in ZIP.
- [ ] Update Skill artifact and canonical UI manifest; pass focused tests.
- [ ] Add failing E2E that selects three papers, observes three model calls and three coverage rows, verifies no omission, score cards, passport, and both downloads.
- [ ] Replace `runRealAnalysis` with batch hydration/analysis/audit and render `EvidenceCoveragePanel`.
- [ ] Run focused E2E and real API browser analysis; verify every selected paper has an explicit status.
- [ ] Run `npm run lint`, `npm test`, `npm run test:e2e`, `npm run test:e2e:static`, credential scan, and `git diff --check`.
- [ ] Commit `feat: deliver evidence coverage auditor`.
