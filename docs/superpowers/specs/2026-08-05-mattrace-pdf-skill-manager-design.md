# MatTrace PDF Preview, Skill Manager, and Typography Design

## Goal

Turn the competition demo into an inspectable Skill product: literature cards behave as real PDF documents, the Skill has a first-class management workspace, and typography follows one consistent hierarchy.

## Approved approach

- Uploaded PDFs retain an in-memory browser object URL. Clicking a PDF opens the right drawer with `PDF 原文` and `解析文本` tabs. Object URLs are revoked when documents are removed or the page is closed.
- Bundled literature is presented as PDF literature without “示例” labels. Its PDF preview uses public project PDF assets; extracted text remains available as the second tab.
- `Skill 管理` is the second sidebar destination. It opens a real editor for `material-evidence-extractor`, with overview, Markdown preview, edit, restore-default, local save, and `SKILL.md` download actions.
- Skill edits persist only in browser local storage. They never mutate the repository or contain the API key. Static GitHub Pages remains fully functional.
- Typography uses semantic tokens instead of one-off sizes: page title 32px, drawer title 28px, section title 18px, card title 15px, body/table 13px, supporting text 12px, metadata 11px. Decorative microcopy may remain 10px only where it is not needed for comprehension.

## Components and data flow

`MatTraceDashboard` owns the active document, PDF/text tab, and Skill drawer state. `document-parser.mjs` attaches a preview URL only to PDF documents. `SkillManager` owns its view/edit mode and delegates persistence/export to a focused `skill-workspace.mjs` module. The drawer remains the common right-side inspection surface.

## Error handling

- Non-PDF documents show parsed text only.
- A missing bundled PDF shows an explicit unavailable state rather than a fake page image.
- Invalid or empty Skill content cannot be saved; restore default is always available.
- Storage failures keep the edited text in memory and show an actionable toast.

## Verification

- Unit tests cover Skill load/save/reset and secret rejection.
- Browser tests cover sidebar ordering, Skill view/edit/save/export, absence of “示例” document labels, PDF/text tab switching, and typography token sizes.
- Full dynamic and static browser suites must pass at desktop and mobile widths.

