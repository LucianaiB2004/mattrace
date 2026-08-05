# MatTrace Complete Functionality Design

## Goal

Turn the current visual prototype into a fully operable static-first materials-literature Agent. Every visible primary control must perform a real action, and uploaded documents must be parseable locally and analyzable through the configured OpenAI-compatible API.

## Runtime boundary

- The deployed artifact remains a browser application suitable for GitHub Pages.
- PDF, DOCX, TXT, and Markdown parsing happens in the browser; files are never uploaded anywhere except their extracted text is sent to the model after the user starts analysis.
- The default API gateway is `https://ai.chipcloud.cc`; the default model is `qwen3.8-max`.
- The API Key exists only in React memory. It is never persisted, logged, exported, placed in a URL, or included in committed files.
- The verified gateway CORS policy permits browser POST requests. Network and model errors remain visible and recoverable.
- A complete built-in example mode remains available without an API Key so judges can evaluate the whole workflow immediately.

## Functional areas

### Document workspace

Users can add files by picker or drag-and-drop, see file type/size/status, remove individual files, clear the workspace, and inspect extracted text. The app accepts 3–10 files for a real batch, limits each file to 50 MB, rejects unsupported or duplicate files, and reports parser errors per file without destroying the rest of the batch.

TXT and Markdown use UTF-8 text decoding. DOCX uses Mammoth browser extraction. PDF uses PDF.js text extraction with page boundaries retained. Parsing produces a normalized `ParsedDocument` containing id, name, type, size, page count, full text, and page text segments.

### Agent execution

The run control offers two explicit paths:

1. `使用示例运行` loads deterministic example documents/results and animates all six stages.
2. `开始真实分析` validates files, Key, gateway, and model, then submits compact document text to the chat-completions endpoint.

The model is instructed to return a strict JSON object matching the Skill schema. The client handles plain JSON and fenced JSON, validates/coerces the response, assigns stable row identifiers, and surfaces malformed-response errors with a retry action. The user can cancel an in-flight request through `AbortController`.

### Evidence model

Each extracted record includes material, process, property, numeric value, unit, normalized value/unit when available, conditions, source document, page locator, evidence quote, and confidence. Missing conditions and conflicts are first-class collections linked to record ids. Conflict detection also runs deterministically in the client for records with the same material/property/unit and more than 30% numeric difference.

### Navigation and detail views

The single-page layout exposes working sections for Dashboard, Documents, Extraction, Evidence, Conflicts, Export, and Settings. Navigation filters or focuses the relevant workspace rather than acting as decorative selection. Summary cards open filtered data views. Table rows and evidence tabs select a record and update its quote/source. “View all” controls open accessible drawers for records and evidence. Missing-condition and conflict cards open their linked details.

### Configuration

The settings dialog edits gateway, model, and API Key. Connection testing calls `/v1/models`; if that endpoint is unsupported, it makes a minimal chat-completions request. Successful configuration can be applied for the current page session. Clearing the Key immediately removes it from memory. Closing via button, backdrop, or Escape works and keyboard focus returns to the opener.

### Export

JSON exports the complete structured report including provenance and alerts. CSV exports flattened record rows with correct escaping and UTF-8 BOM for spreadsheet compatibility. Markdown exports a human-readable report with summary, records, missing conditions, conflicts, and source notes. The Export view lets users choose the format, preview its contents, copy it, and download it. Empty results disable export with a clear reason.

### Session behavior and privacy

Non-sensitive workspace state (parsed document metadata/text and analysis result) may be saved only when the user explicitly clicks `保存当前项目`; it uses IndexedDB and excludes the API Key. Users can restore or delete the saved project. A privacy panel lists exactly what is in memory and what would be sent to the configured API.

## Architecture

- `app/domain/`: pure types, validation, normalization, conflict detection, and export formatting.
- `app/services/`: browser file parsers, API client, and optional IndexedDB project store.
- `app/components/`: focused dashboard sections, dialogs, drawers, notices, and reusable controls.
- `app/MatTraceDashboard.tsx`: top-level orchestration only.
- `tests/`: pure unit tests plus browser-level end-to-end tests against a deterministic mocked API.

All domain and service boundaries use explicit result objects instead of throwing uncaught errors into the UI. The existing visual language and mascot remain unchanged.

## Error and state model

The application has explicit `idle`, `parsing`, `ready`, `analyzing`, `success`, `cancelled`, and `error` phases. Each asynchronous action exposes progress and a human-readable error. Re-running does not mix old and new results. Failed files can be removed or retried. Network failures preserve parsed documents and configuration so the user can retry.

## Verification

- Unit tests cover file validation, JSON extraction, result validation, normalization, conflict detection, exports, state transitions, and secret exclusion.
- Integration tests mock file parsing and fetch to prove connection testing, real analysis, cancellation, and malformed-response handling.
- Browser tests exercise file upload/drop, removal, example run, settings, navigation, filters, drawers, copy/download controls, saved-project behavior, desktop/mobile layout, and keyboard dismissal.
- Production build, lint, Skill validation, secret scan, and a static-host compatibility check must all pass.

## Explicit non-goals

- No account system, shared cloud database, billing, or server-side credential vault.
- No OCR for scanned PDFs in this release; the parser reports when a PDF has no extractable text.
- No fabricated extraction when the real API call fails; example data is visibly labeled as example mode.
