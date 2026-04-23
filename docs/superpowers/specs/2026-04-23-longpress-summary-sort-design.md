# Long-Press Summary, Sorting, and Timeline Design

## Goal

Make the long-press view feel immediate and useful for daily classroom use by showing only the current summary note and the still-unorganized memo timeline, while simplifying editing and making roster order controllable without polluting child names.

## Approved Product Decisions

- Long-press view should prioritize:
  1. summary note
  2. pending memo timeline
- Summary note shows a short preview first, then opens a full view/editor on tap.
- Individual AI actions are removed from the person-level flow. Bulk AI becomes the only AI organization path.
- Person-level folder assignment UI is removed from the long-press flow.
- Name edits happen inline in the long-press view and save automatically when focus leaves or the sheet closes.
- Ordering uses an internal sort order field, not visible numbering in names.
- Reordering must work from both the full list and folder-scoped views.
- Reordering interaction should be drag-based, with a low-friction fallback action to normalize visible rows into gojuon order.
- AI organization should preserve chronology better by sending stronger timeline-oriented guidance and more date-aware payload structure.

## UX Structure

### Board

Keep the board header focused on:
- search
- bulk AI
- add person / folder tools
- reorder mode controls

Add a reorder mode with:
- `並び替え` to enter mode
- `50音順にする` for the current visible set
- `完了` to leave mode

When reorder mode is active:
- normal tap-to-record and long-press preview are disabled for tiles
- each visible tile becomes draggable through a dedicated handle
- dragging only reorders the current visible subset, while hidden rows preserve relative order

### Long-Press Preview

The preview sheet should show only:
- editable name row at the top
- summary note section
- pending memo timeline section
- quick record action

Remove from preview:
- folder assignment controls
- individual AI actions
- copy-to-AI actions

Summary section:
- compact preview (4-5 lines)
- explicit `全文を見る / 直す` action
- full editor opens in a dedicated summary sheet

Pending memo timeline:
- only memos still pending since the last summary update
- date-first layout for scanability
- oldest-to-newest ordering so temporal flow is easier to understand
- keep visual weight low; no giant combined block by default

### Inline Name Editing

At the top of preview, replace static title-only treatment with an editable name field.

Rules:
- debounce saves while typing
- blur saves immediately
- closing the sheet flushes pending edits
- lightweight toast confirms rename

## Data and Ordering Model

Reuse `person.sortOrder` as the canonical hidden ordering field.

New helper behavior:
- derive visible people from existing filters/search
- reorder only the visible subset
- merge reordered visible ids back into the full list while preserving hidden members' relative positions
- rewrite `sortOrder` densely after each reorder / gojuon normalization

This keeps one stable order model while supporting both all-board and folder-scoped management.

## AI Timeline Improvement

Bulk AI export should add clearer chronology signals:
- keep pending memos sorted oldest-to-newest
- add month-grouped timeline metadata per person
- include explicit writing guidance that asks for:
  - approximate month/time period references
  - changes over time
  - recent state vs earlier state

No response schema changes are needed for import; improvements are purely on the outbound guidance side.

## Files Expected to Change

- `index.html`
  - simplify preview sheet structure
  - add inline name editor affordance
  - add reorder mode controls
- `app.js`
  - preview rendering changes
  - inline rename autosave
  - reorder mode + drag logic
  - visible-subset ordering helpers
  - bulk AI guidance improvements
- `ui-logic.mjs`
  - bulk AI export payload improvements
  - pending timeline helper(s) if needed
- `styles.css`
  - lighter preview structure
  - reorder mode styles and drag feedback
- `app-flow.test.mjs`
  - preview simplification
  - summary open/edit flow
  - inline rename autosave
  - reorder behavior and gojuon action
- `ui-logic.test.mjs`
  - timeline-aware bulk AI payload assertions

## Validation

- `node --test *.test.mjs`
- targeted Playwright checks for preview, rename autosave, reorder mode, and bulk AI result flow
- publish and verify public site exposes the new build label and markup
