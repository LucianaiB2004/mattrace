# MatTrace Dashboard Design

## Goal

Build an initial, reviewer-ready MatTrace dashboard that closely follows the supplied visual reference while remaining a real interactive web prototype. The page demonstrates how `material-evidence-extractor` turns 3-10 materials documents into traceable structured records.

## Product boundary

- The competition artifact remains one reusable Skill under `skills/material-evidence-extractor/`.
- The web app is a demonstration surface for that Skill, not a replacement for it.
- Version one is a single responsive dashboard route.
- The public site never embeds or persists an API key.
- The API gateway defaults to `https://ai.chipcloud.cc`, and the model defaults to `qwen3.8-max`.

## Experience

The dashboard contains a fixed navigation rail, a greeting and model status header, a document upload area, a six-stage Agent progress strip, extraction summary cards, a realistic evidence table, evidence preview, missing-condition and conflict alerts, and export controls.

Users can open the model configuration dialog, enter an API key for the current page session, change the compatible endpoint and model, and run a connection check. Uploaded document names appear immediately. A demonstration run advances through the six Skill stages and updates the dashboard without requiring a real API call. JSON, CSV, and Markdown export buttons download the current sample result.

## Visual direction

- White and pale lavender workspace with soft glass-like cards.
- Deep ink typography, violet primary actions, mint status accents, amber missing-field warnings, and coral conflict warnings.
- An original small 3D research robot mascot provides personality in the left rail.
- Icons are code-native and accessible; generated imagery is limited to the mascot and social preview.
- The mobile layout collapses the rail and stacks the evidence panels.

## Security and API behavior

- The HTML and repository contain no real credential.
- The API key field is blank on first load and stored only in React memory.
- It is never written to localStorage, sessionStorage, URL parameters, analytics, console output, or exported files.
- The UI explains that browser-direct requests require a CORS-enabled OpenAI-compatible endpoint.
- Initial API integration is a connection-test surface; the deterministic demo remains usable without a key.

## Verification

- Server-rendered HTML includes the MatTrace identity and core dashboard landmarks.
- Unit tests cover config defaults, secret non-persistence, upload acceptance, progress transitions, and export serialization.
- The production build must succeed.
- Browser verification covers desktop layout, mobile layout, keyboard focus, upload interaction, settings dialog, demo run, and export controls.

