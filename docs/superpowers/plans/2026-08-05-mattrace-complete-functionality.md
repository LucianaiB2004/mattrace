# MatTrace Complete Functionality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert MatTrace from a visual demo into a complete static-first document extraction and evidence verification Agent whose visible controls all work.

**Architecture:** Pure domain modules define records, validation, conflicts, exports, and workflow state. Browser services parse files, call the OpenAI-compatible endpoint, and optionally save non-secret projects. Focused React components consume those interfaces while the dashboard coordinates state.

**Tech Stack:** React 19, TypeScript, Vinext, PDF.js, Mammoth, IndexedDB, Node test runner, Playwright-compatible browser verification.

## Global Constraints

- Default gateway is `https://ai.chipcloud.cc` and default model is `qwen3.8-max`.
- API keys stay in React memory only and must never enter storage, logs, exports, URLs, fixtures, or Git.
- The final app must remain usable as a static browser application and preserve the accepted MatTrace visual design.
- Real runs accept 3–10 supported files of at most 50 MB each; example mode needs no Key.
- Every visible primary control must have an observable, tested result.

---

### Task 1: Domain contracts, response validation, and workflow state

**Files:**
- Create: `app/domain/mattrace-types.ts`
- Create: `app/domain/analysis.ts`
- Create: `app/domain/workflow.ts`
- Test: `tests/analysis.test.mjs`
- Test: `tests/workflow.test.mjs`

**Interfaces:**
- Produces: `normalizeAnalysisResult(input)`, `extractJsonObject(text)`, `detectConflicts(records, threshold)`, `createWorkflowState()`, and `transitionWorkflow(state, event)`.

- [ ] Write failing tests for fenced/plain JSON, malformed results, stable ids, missing conditions, >30% conflicts, cancellation, retry, and stale-result replacement.
- [ ] Run focused tests and confirm failures name the missing modules.
- [ ] Implement pure validation, normalization, conflict detection, and state transitions without UI dependencies.
- [ ] Run focused tests and confirm all cases pass.
- [ ] Commit the domain layer.

### Task 2: Complete exports and privacy-safe project serialization

**Files:**
- Create: `app/domain/export-report.ts`
- Create: `app/domain/project-snapshot.ts`
- Test: `tests/export-report.test.mjs`
- Test: `tests/project-snapshot.test.mjs`

**Interfaces:**
- Produces: `buildExport(format, report)`, `createProjectSnapshot(state)`, and `assertSnapshotHasNoSecret(snapshot)`.

- [ ] Write failing tests for evidence-rich JSON, quoted CSV with BOM, structured Markdown, empty-result rejection, and recursive secret exclusion.
- [ ] Run tests and verify the expected failures.
- [ ] Implement export builders and a whitelist-based snapshot serializer that has no API-key field.
- [ ] Run the focused tests and commit the passing layer.

### Task 3: Browser file parsing and validation

**Files:**
- Create: `app/services/file-validation.ts`
- Create: `app/services/document-parser.ts`
- Create: `app/services/pdf-parser.ts`
- Create: `app/services/docx-parser.ts`
- Test: `tests/file-validation.test.mjs`
- Test: `tests/text-parser.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ParsedDocument`.
- Produces: `validateFiles(files, existing)`, `parseDocument(file, onProgress)`, and parser-specific page/text results.

- [ ] Write failing tests for type, size, duplicate, 10-file cap, UTF-8 TXT/MD, and empty-document errors.
- [ ] Add pinned PDF.js and Mammoth dependencies.
- [ ] Implement browser-only lazy parser adapters so initial render does not load parser bundles.
- [ ] Run parser tests with small committed fixtures and commit.

### Task 4: OpenAI-compatible API client

**Files:**
- Create: `app/services/ai-client.ts`
- Create: `app/domain/prompt.ts`
- Test: `tests/ai-client.test.mjs`

**Interfaces:**
- Produces: `testProvider(config, fetchImpl, signal)` and `analyzeDocuments(config, documents, fetchImpl, signal, onStage)`.

- [ ] Write failing fetch-mock tests for URL normalization, auth headers, strict response format, fallback connection test, HTTP errors, aborts, fenced JSON, and no secret leakage in errors.
- [ ] Implement prompt construction from the Skill schema and the minimal compatible chat request.
- [ ] Normalize/validate the response through Task 1 before returning it.
- [ ] Run tests and commit.

### Task 5: Optional IndexedDB project storage

**Files:**
- Create: `app/services/project-store.ts`
- Test: `tests/project-store.test.mjs`

**Interfaces:**
- Consumes: safe snapshots from Task 2.
- Produces: `saveProject(snapshot)`, `loadProject()`, and `deleteProject()`.

- [ ] Write failing tests against an injected in-memory IDB adapter.
- [ ] Implement a single-record `mattrace-projects` store and versioned snapshot migration guard.
- [ ] Prove through tests that API credentials cannot be accepted or stored.
- [ ] Commit.

### Task 6: Refactor dashboard into real functional sections

**Files:**
- Modify: `app/MatTraceDashboard.tsx`
- Modify: `app/MatTraceDashboard.css`
- Create: `app/components/DocumentWorkspace.tsx`
- Create: `app/components/AnalysisProgress.tsx`
- Create: `app/components/EvidenceWorkspace.tsx`
- Create: `app/components/DetailsDrawer.tsx`
- Create: `app/components/ExportWorkspace.tsx`
- Create: `app/components/SettingsDialog.tsx`
- Create: `app/components/ToastRegion.tsx`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: a complete single-page Agent with functional navigation, upload/drop/remove/clear, example and real run, cancel/retry, filters/details, settings, export preview/copy/download, project save/restore/delete, and privacy disclosure.

- [ ] Extend rendered-landmark tests for all functional regions and accessible dialog/drawer labels.
- [ ] Split the current oversized component by responsibility while preserving accepted layout.
- [ ] Wire every control to observable state and provide empty/loading/error/success states.
- [ ] Add focus management, Escape dismissal, live progress, toasts, and mobile responsive states.
- [ ] Run all unit/render tests and commit.

### Task 7: Browser-level acceptance suite

**Files:**
- Create: `tests/e2e/mattrace.spec.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: the finished application and a mocked OpenAI-compatible route.
- Produces: reproducible end-to-end evidence for every primary control.

- [ ] Add tests for upload/drop/remove, validation errors, example run, successful real run, malformed API response, cancellation, all nav destinations, record/evidence selection, filter drawers, settings dismissal, exports, copy, save/restore/delete, desktop, mobile, and keyboard access.
- [ ] Run the suite against a local production preview and fix only evidence-backed failures.
- [ ] Capture a final desktop and mobile screenshot.
- [ ] Commit the acceptance suite and fixes.

### Task 8: Final audit and static publication readiness

**Files:**
- Modify: `README.md`
- Modify only evidence-backed failures elsewhere.

**Interfaces:**
- Produces: a reviewer-runnable repository and verified static output.

- [ ] Run unit/integration tests, E2E tests, lint, production build, Skill validator, and recursive secret scan.
- [ ] Confirm the generated output contains no API Key and no server-only dependency for core operation.
- [ ] Update README with supported inputs, privacy behavior, real/example run instructions, test commands, and deployment limitations.
- [ ] Review every visible primary control against the design and record authoritative pass evidence.
- [ ] Commit final documentation and verified fixes.
