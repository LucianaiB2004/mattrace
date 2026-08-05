# MatTrace Remembered Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remember provider credentials in the current browser, remove duplicate top project actions, and complete a real three-paper browser analysis through a reliable local transport.

**Architecture:** A focused provider-storage module owns versioned localStorage validation and clearing. The dashboard initializes from it and SettingsDialog applies or clears persisted configuration. Local development request routing is isolated in the AI client/proxy boundary so the visible gateway remains unchanged.

**Tech Stack:** React 19, localStorage, Node HTTP proxy, vinext/Vite, Node test runner, Playwright.

## Global Constraints

- Never commit or compile the runtime API Key into the repository or static HTML.
- Key persistence is browser-local and explicitly described as unencrypted localStorage.
- Project snapshots, Skill ZIP, and report exports must remain credential-free.
- Remove only the two duplicate top actions; preserve project controls in the privacy card.
- A successful `/models` request is insufficient; acceptance requires a real three-paper completion.

---

### Task 1: Versioned provider persistence

**Files:**
- Create: `app/domain/provider-storage.mjs`
- Create: `tests/provider-storage.test.mjs`
- Modify: `app/MatTraceDashboard.tsx`
- Modify: `app/components/SettingsDialog.tsx`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- Produces `loadProvider(storage, defaults)`, `saveProvider(storage, config)`, and `clearProviderKey(storage, defaults)`.

- [ ] Write failing tests for defaults, save/reload, invalid JSON, and clearing only the Key.
- [ ] Run `node --test tests/provider-storage.test.mjs` and confirm missing exports fail.
- [ ] Implement the minimal versioned storage module and wire apply/clear behavior.
- [ ] Add E2E assertions for refresh refill and clear-then-refresh.
- [ ] Run focused unit/E2E tests and commit `feat: remember browser provider configuration`.

### Task 2: Remove duplicate project actions

**Files:**
- Modify: `app/MatTraceDashboard.tsx`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/e2e/mattrace.spec.ts`

**Interfaces:**
- Preserves existing `saveProject`, `restoreProject`, and `deleteProject` through the right privacy card only.

- [ ] Change tests to require zero topbar save/restore buttons while privacy-card controls remain operable.
- [ ] Run focused tests and confirm the old header fails.
- [ ] Remove the two header buttons and retarget project lifecycle E2E locators.
- [ ] Run focused tests and commit `refactor: remove duplicate project header actions`.

### Task 3: Reliable local real-analysis transport

**Files:**
- Modify: `scripts/local-ai-proxy.mjs`
- Create: `tests/local-ai-proxy.test.mjs`
- Modify when required: `app/services/ai-client.mjs`
- Modify: `README.md`

**Interfaces:**
- Proxy accepts only allowed local origins and `/v1/models` or `/v1/chat/completions`; forwards status/body without logging secrets.

- [ ] Add a failing proxy integration test with a delayed upstream response and exact request-body/header assertions.
- [ ] Reproduce the real gateway disconnect while comparing request headers to the working system client.
- [ ] Implement the smallest confirmed transport correction, keeping upstream injectable for tests.
- [ ] Run proxy tests, then use the provided runtime Key to complete a browser three-paper analysis.
- [ ] Verify output contract, exports, evidence navigation, refresh refill, and clear behavior.
- [ ] Run all lint/unit/dynamic/static suites, credential scan, and commit `fix: complete real browser analysis transport`.
