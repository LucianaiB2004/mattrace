# MatTrace Document Workflow Completion Design

## Goal

Complete the document lifecycle so PDF reading, full-text extraction, renaming, AI analysis, evidence provenance, export, and project persistence all use one consistent document identity and page dataset.

## Root cause

Uploaded PDFs already pass through `parsePdf` and produce text for every page. Bundled competition PDFs currently bypass that path: `EXAMPLE_DOCUMENTS` contains only one short manually entered page, even though the original PDFs are present. Bundled documents are also excluded from `realDocuments`, so they cannot be sent through the user-configured AI analysis. The short parsed-text view is therefore a document bootstrap defect, not an AI response defect.

The current preview is a browser PDF iframe. Its thumbnail rail, page width, and zoom behavior belong to Chromium and cannot be styled by MatTrace. Resizing the iframe alone cannot guarantee the requested layout.

## PDF reader

Create a focused `PdfReader` component using `pdfjs-dist`.

- The document drawer width is `min(1100px, 76vw)` on desktop and 100% below the existing mobile breakpoint.
- The reader has a 104px thumbnail rail and a flexible main-page viewport.
- The main page fits the available width by default and supports zoom out, zoom in, reset-to-fit, previous page, next page, direct page selection, and current/total page status.
- Selecting a thumbnail scrolls and renders that page in the main viewport.
- Loading, rendering failure, and missing-source states are explicit.
- Rendering uses the same PDF source URL already retained for bundled and uploaded documents. It does not send the PDF to the AI provider.
- Canvas rendering is cancelled when the selected page, zoom, document, or drawer changes so stale work cannot overwrite the current page.

## Full-text extraction

- Add a reproducible Node script that extracts every page from the three public PDFs into generated JSON assets.
- Bundled document metadata uses the PDF's actual page count and full extracted text rather than a one-page summary.
- The browser loads the companion JSON when a bundled document is opened or selected for analysis, caches it in state, and exposes every page in the parsed-text view.
- Uploaded PDFs continue using the existing browser parser and already contain their complete page array.
- The parsed-text view includes a page list, text search, matching-page count, and jump-to-page behavior. Empty pages remain visible with an explicit message.
- AI analysis receives all currently loaded supported documents, including bundled public PDFs. Before analysis, any bundled document without full text is hydrated from its companion JSON. The API receives parsed text, document name, and page numbers only—not the PDF binary.

## Document rename

- Double-clicking the drawer title enters inline edit mode.
- `Enter` saves, `Escape` cancels, and blur saves a valid changed name.
- Empty names are rejected. PDF documents always retain a `.pdf` suffix; duplicate names are rejected case-insensitively.
- A successful rename updates the document, active preview, report record `sourceDocument` fields, evidence cards, issue drawers, exports, and later project snapshots in one state transition.
- Rename does not change the stable document ID, parsed pages, PDF source URL, or evidence page numbers.
- Restored projects preserve the renamed display name. Bundled documents keep their stable companion-text asset identity separately from the editable display name.

## State boundaries

`document-workspace.mjs` owns pure rename validation and provenance cascading. `literature-loader.mjs` owns companion JSON loading and normalization. `PdfReader.tsx` owns PDF rendering only. `DocumentTextViewer.tsx` owns page search and navigation only. `MatTraceDashboard` coordinates these units and retains existing notifications and drawer behavior.

Project snapshots continue storing metadata, parsed pages, reports, and public provider configuration. Blob URLs and PDF binary data are stripped because they are session-local. Restoring an uploaded PDF project shows its extracted text and explains that the original PDF must be re-uploaded for visual preview.

## Error handling

- Companion JSON fetch failure keeps the PDF reader available and reports that full text could not be loaded.
- PDF canvas failure offers retry and parsed-text fallback.
- Rename validation leaves edit mode open and displays the actionable reason.
- AI analysis cannot start until three documents have full parsed text; hydration failure names the affected document.
- Object URLs are revoked only when the associated uploaded document is removed, replaced, or the dashboard unmounts.

## Verification

- Unit tests cover rename validation, extension preservation, duplicate rejection, report-source cascading, snapshot removal of blob URLs, and literature page normalization.
- Browser tests cover double-click rename with Enter/Escape/blur, propagation into evidence and exports, custom reader layout and controls, full bundled page text, search/jump behavior, and bundled documents entering a mocked real AI request.
- Existing dynamic and static browser suites must remain green at desktop and mobile sizes.
- Fresh visual inspection must confirm the narrow thumbnail rail, enlarged page viewport, wider drawer, and readable full-text view.

