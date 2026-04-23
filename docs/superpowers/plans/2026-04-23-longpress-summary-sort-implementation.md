# Long-Press Summary, Sorting, and Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the long-press flow around summary review, add hidden-order drag sorting, and improve bulk AI chronology guidance.

**Architecture:** Keep the existing static-web structure, but split new behavior into focused render/helpers inside `app.js` and `ui-logic.mjs`. Reuse the existing `sortOrder` field as the hidden canonical ordering model so drag sorting and folder-scoped sorting stay consistent.

**Tech Stack:** Vanilla JS modules, static HTML/CSS, Playwright-based app-flow tests, Node test runner.

---

### Task 1: Write regression tests for the new preview model

**Files:**
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\app-flow.test.mjs`

- [ ] **Step 1: Write failing tests for preview simplification**
- [ ] **Step 2: Run `node --test app-flow.test.mjs` and confirm the new expectations fail**
- [ ] **Step 3: Cover summary full-view entry, removed individual AI/folder controls, and inline rename autosave**
- [ ] **Step 4: Add a reorder behavior regression test**
- [ ] **Step 5: Re-run the targeted app-flow tests and confirm only implementation gaps remain**

### Task 2: Implement long-press preview simplification

**Files:**
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\index.html`
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\app.js`
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\styles.css`

- [ ] **Step 1: Remove per-person folder and AI controls from the preview sheet markup**
- [ ] **Step 2: Add inline editable name UI plus explicit summary full-view affordance**
- [ ] **Step 3: Render only pending memo timeline rows in preview**
- [ ] **Step 4: Implement autosave-on-blur/close for preview renaming**
- [ ] **Step 5: Run targeted app-flow tests for preview and rename**

### Task 3: Implement hidden-order sorting mode

**Files:**
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\index.html`
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\app.js`
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\styles.css`
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\app-flow.test.mjs`

- [ ] **Step 1: Add reorder mode controls to the board**
- [ ] **Step 2: Implement visible-subset reorder helpers using `sortOrder`**
- [ ] **Step 3: Implement drag interaction for reorder mode**
- [ ] **Step 4: Add `50音順にする` for the current visible set**
- [ ] **Step 5: Run targeted and full UI tests**

### Task 4: Improve outbound bulk AI chronology guidance

**Files:**
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\ui-logic.mjs`
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\ui-logic.test.mjs`

- [ ] **Step 1: Write failing assertions for timeline-aware export metadata**
- [ ] **Step 2: Run `node --test ui-logic.test.mjs` and confirm failure**
- [ ] **Step 3: Add month grouping / chronology guidance without changing import schema**
- [ ] **Step 4: Re-run `node --test ui-logic.test.mjs` and confirm pass**

### Task 5: Final verification and publish

**Files:**
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\.gitignore`
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\docs\superpowers\specs\2026-04-23-longpress-summary-sort-design.md`
- Modify: `C:\Users\gan12\OneDrive\ドキュメント\kizuki-memo-ios-web-beta-site\.worktrees\longpress-summary-sort\docs\superpowers\plans\2026-04-23-longpress-summary-sort-implementation.md`

- [ ] **Step 1: Add `.worktrees/` to tracked `.gitignore` in this branch**
- [ ] **Step 2: Run `node --test *.test.mjs`**
- [ ] **Step 3: Inspect `git diff --stat` and sanity-check no unrelated regressions**
- [ ] **Step 4: Commit with a focused message**
- [ ] **Step 5: Push the branch and merge/publish to `main`, then verify the public site**
