# MatTrace Document Workflow Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete PDF reading, full-text extraction, rename propagation, AI input, export, and persistence around one stable document identity.

**Architecture:** Pure document mutations live in `document-workspace.mjs`; bundled full text is generated as static JSON and loaded through `literature-loader.mjs`. React components isolate PDF canvas rendering and text search while the dashboard only coordinates state and notifications.

**Tech Stack:** React 19, TypeScript, pdfjs-dist, Canvas API, Node test runner, Playwright, Vinext static export.

## Global Constraints

- The custom reader uses a 104px thumbnail rail and a flexible main viewport.
- Document rename preserves stable IDs, extensions, pages, and preview sources while cascading provenance names.
- Bundled and uploaded PDFs can both enter real AI analysis after complete text hydration.
- API requests contain parsed text, names, and page numbers, never PDF binary data.
- Blob URLs and PDF binaries remain session-local and are excluded from project snapshots.
- Dynamic and static builds must preserve desktop, mobile, keyboard, and reduced-motion behavior.

---

### Task 1: Document identity and rename cascade

**Files:**
- Create: `app/domain/document-workspace.mjs`
- Create: `tests/document-workspace.test.mjs`
- Modify: `app/domain/project-snapshot.mjs`
- Modify: `tests/project-snapshot.test.mjs`

**Interfaces:**
- Produces: `renameDocument({ documents, report }, documentId, requestedName)` returning updated documents/report and `stripSessionDocumentFields(document)`.

- [ ] Write tests using two literal documents and a report to assert `.pdf` preservation, duplicate and empty rejection, matching `sourceDocument` updates, stable IDs/pages/URLs, and snapshot removal of `blob:` preview URLs.
- [ ] Run `node --test tests/document-workspace.test.mjs tests/project-snapshot.test.mjs`; verify missing exports fail.
- [ ] Implement exact-name validation, case-insensitive duplicate detection, immutable cascade, and snapshot sanitization.
- [ ] Re-run the focused tests and verify all pass.
- [ ] Commit with `feat: connect document rename provenance`.

### Task 2: Complete bundled literature text and AI hydration

**Files:**
- Create: `scripts/extract-literature.mjs`
- Create: `app/services/literature-loader.mjs`
- Create: `tests/literature-loader.test.mjs`
- Generate: `public/literature/2103.08718.json`
- Generate: `public/literature/2202.06763.json`
- Generate: `public/literature/2404.13858.json`
- Modify: `app/domain/example-data.mjs`
- Modify: `app/MatTraceDashboard.tsx`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- Produces: `loadLiteraturePages(document, fetchImpl)` returning the document with normalized `pages`, `text`, and actual `pageCount`; each bundled document has immutable `contentUrl` separate from editable `name`.

- [ ] Add unit tests with literal companion JSON and an E2E test that searches text beyond page 1 and observes all three bundled documents in a mocked AI request.
- [ ] Run the focused tests; verify one-page bundled data and filtered AI inputs fail.
- [ ] Implement the extraction script, generate companion JSON, normalize fetch results, hydrate before opening/analyzing, and remove the `!example` analysis filter.
- [ ] Run focused unit/E2E tests and verify they pass.
- [ ] Commit with `feat: hydrate full bundled literature`.

### Task 3: Custom PDF reader and searchable text viewer

**Files:**
- Create: `app/components/PdfReader.tsx`
- Create: `app/components/DocumentTextViewer.tsx`
- Modify: `app/MatTraceDashboard.tsx`
- Modify: `app/MatTraceDashboard.css`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- `PdfReader({ source, name })` renders thumbnails, current page, zoom, page navigation, loading, retry, and fallback states.
- `DocumentTextViewer({ pages })` renders page navigation, search results, and all normalized page text.

- [ ] Add Playwright assertions for a 104px thumbnail rail, main canvas, next/previous page, zoom status, page selection, full-text search, and mobile drawer width.
- [ ] Run the focused test and verify the iframe/current text card cannot satisfy it.
- [ ] Implement cancellable pdf.js canvas rendering and the searchable text viewer, then widen the desktop drawer to `min(1100px, 76vw)`.
- [ ] Run the focused browser test and verify it passes without runtime console errors.
- [ ] Commit with `feat: add integrated PDF research reader`.

### Task 4: Inline rename UI and end-to-end verification

**Files:**
- Modify: `app/components/DetailsDrawer.tsx`
- Modify: `app/MatTraceDashboard.tsx`
- Modify: `app/MatTraceDashboard.css`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- `DetailsDrawer` accepts optional `editableTitle`, `onRenameTitle`, and `titleValidationMessage`; the dashboard delegates mutation to `renameDocument`.

- [ ] Add Playwright tests for double-click edit, Enter save, Escape cancel, blur save, invalid/duplicate errors, and renamed provenance in evidence/export/project restore.
- [ ] Run the focused test and verify the static title fails.
- [ ] Implement an accessible inline title editor and dashboard cascade notification.
- [ ] Run focused tests, then run `npm test`, `npm run lint`, `npm run test:e2e`, and `npm run test:e2e:static`.
- [ ] Inspect fresh desktop/mobile screenshots and commit with `feat: complete document workflow`.

