# Delivery Exception Desk pilot plan

The [active UI and UX milestone](#ui-and-ux-improvement-plan) follows the original pilot phases below.

Build a local review workspace for missing deliveries and returns to sender. Use the 24 synthetic, prepaid, single-item cases in the working queue, with 12 tickets in each language.

Requirements come from the [pilot spec](SPEC.md), [delivery policy](delivery-exception-policy.md), [operations playbook](delivery-operations-playbook.md), and [brand guidance](BRAND.md). The [data reference](../data/README.md) defines the fixture and label formats.

## Implementation decisions

- Use the existing FastAPI and React entry points, SQLite via `sqlite3`, and the notebook's LangChain, Groq, and Pydantic setup. Prepare waiting cases in the background and prioritize cases opened by a handler. A handler confirms or revises a recommendation before the case proceeds.
- Keep evidence snapshots read-only. Save the recommendation, handler submission, and supervisor outcome as separate records in SQLite so reviewers can see what changed, who recorded it, and when. Use the fixture identities as a labeled staff selector for the local demo. Real sign-in belongs to a later deployment.
- The pilot ends at a recorded human decision. Refunds, replacements, carrier requests, and customer messages remain outside this milestone.
- Before coding each phase, check Context7 against the installed library versions used by that phase. Run Python through `uv run` on Python 3.12. After each phase, run its checks, mark verified items here, update [STATUS.md](STATUS.md), and commit the phase per [PROCESS.md](PROCESS.md).

## Phase 1 — Seed the queue and replay evidence

Add `backend/evidence.py` for fixture validation and case snapshots and `backend/database.py` for SQLite initialization. Extend `backend/main.py` with `GET /api/cases`, `GET /api/cases/{case_id}`, and `GET /api/handlers`. Return queue summaries and full case detail with ticket, matched order, shipment, history, and evidence cutoff. Use stable case IDs and keep `/api/health` available.

- [x] `uv run -m pytest backend/tests/test_cases.py -q` verifies that a fresh database returns 24 waiting cases. Seeding again preserves case IDs and saved state. Unknown case IDs return `404`. A mismatched order or tracking ID fails fixture validation before anything is seeded.
- [x] Replay uses `reported_at` with its time zone. Tests include an event exactly at the cutoff, exclude later events, and pick the latest eligible delivered scan. Treat proof as attached to the shipment's latest recorded delivered scan. Omit that proof when the scan is after the cutoff. Treat untimestamped fixture stock, address, and history as report-time snapshots.
- [x] `DED-2001` returns the original Arabic ticket and absent proof. `DED-2009` includes the verified completed same-issue refund. Filter history to the matching case and order. The seed allowlists business fixtures, and case responses contain no expected decisions or evaluation metadata.

## Phase 2 — Generate a policy-grounded recommendation

Add `backend/policy.py` for policy validation and `backend/recommendations.py` for the notebook's read-only lookup pattern and structured Groq response. Add `POST /api/cases/{case_id}/recommendation`. Use case-scoped tools for order, shipment, and verified history. Treat customer text as evidence. Return `action`, `refund_sar`, `requires_review`, `policy_ref`, and a short rationale citing decisive case facts. A valid recommendation is saved and leaves the case in `waiting` for handler review.

- [x] `uv run -m pytest backend/tests/test_policy.py backend/tests/test_recommendations.py -q` covers P1 precedence over proof mismatch, pending and unrelated history, P2 proof mismatch and the 24-hour boundary, P3 carrier-depot versus warehouse receipt, and all P4 branches.
- [x] P5 tests cover SAR 500.00 and 500.01 for both refunds and replacements. Use exact decimal amounts for policy comparisons. `DED-2003` refunds SAR 490.00 even though the customer requested SAR 520.00. Non-refund actions always carry zero.
- [x] Stubbed responses verify evidence scope and structured output. Validate prior-resolution precedence, investigation timing, warehouse receipt, compensation eligibility, refund amount, and supervisor routing before saving. A malformed or inconsistent response, timeout, or quota error leaves the case available for retry or manual decision. If the evidence cannot support a policy decision, show the missing evidence and keep the case waiting. Concurrent requests save at most one recommendation, and a late response cannot overwrite a handler decision.

## Phase 3 — Record handler and supervisor decisions

Add `backend/reviews.py` for state transitions. Expose `POST /api/cases/{case_id}/decision` with `handler_id`, `version`, `action`, and `rationale`. A handler can accept a valid recommendation, edit its rationale, or select a policy-valid action for a manual decision. Each evidence snapshot supports one policy action. Validate the submitted decision against P1–P4 and derive the amount, review flag, and reference on the server. Expose `POST /api/cases/{case_id}/supervisor-review` with `handler_id`, `version`, `outcome` (`approve` or `return_for_revision`), and `note`.

| Case state | Move out of the state |
| --- | --- |
| `waiting` | Handler records a valid decision. The case moves to `decided`, or to `awaiting_supervisor` for P5. |
| `awaiting_supervisor` | A supervisor approves and records the decision, or returns it to `waiting` with a reason. |
| `decided` | The detail view shows the final human decision and any supervisor outcome. |

- [x] `uv run -m pytest backend/tests/test_reviews.py -q` verifies a direct decision for `DED-2003` and a held replacement for `DED-2008`. A support agent cannot approve the held case. A supervisor can return it for revision or approve it. The outcome includes the actor and timestamp.
- [x] A handler can accept, revise, or record a manual decision when model generation fails. A policy-invalid edit returns `422` with a reason. The recorded submission preserves the original proposal and any earlier supervisor note.
- [x] State and history update in one transaction. A duplicate submission or a stale version returns `409` without adding a second decision. Case state and audit records survive restart and reseeding. Tests use a temporary database and stubbed model calls.

## Phase 4 — Build the bilingual review workspace

Extend `dashboard/src/App.tsx` with the queue and case view. Add typed requests in `dashboard/src/api.ts`. The queue shows status and opens case detail. Case detail puts the recommendation and decision controls alongside the ticket, matched order, carrier timeline, proof, and prior resolutions. Show the report-time cutoff and the final recorded decision when present.

- [x] `npm run check:ts` verifies the queue, API error states, and decision form. The UI supports Arabic and English labels, sets Arabic layout to RTL, isolates IDs and policy references for legibility, and displays amounts in SAR. Render ticket text in its original language and display it and the rationale as plain text. Status colors have text labels and the forms work by keyboard.
- [x] `npm run e2e` verifies a handler accepting an ordinary decision, editing its rationale, and sending a P5 case to supervisor review. A supervisor approves the held case and the decision is visible after reload. Use an isolated temporary database and a stubbed recommendation provider. Exercise the manual path with a stubbed provider failure.

## Phase 5 — Verify the pilot and measure recommendation quality

Reuse the scoring cells and evidence fixtures from [the baseline notebook](../labs/01-delivery-exception-baseline.ipynb). Its saved five-case working-queue run recorded 4/5 exact for one call and 5/5 for the agent. Freeze the candidate and comparator configurations before running evaluation. Budget provider calls and tokens before a live run.

- [x] `npm run check` passes. Walk through one Arabic missing-delivery case and one English return from queue to recorded decision. Confirm that the displayed rationale points to the decisive evidence, the P5 hold works, and an altered action or rationale is traceable.
- [x] Compare fixed configurations on the same cases. Pass both the same report-time evidence and document any information difference when citing the original baseline. Keep labels outside prompts and tool payloads. The [paired evaluation](PILOT_EVALUATION.md) reports all 66 cases across four separate groups.
- [x] Record per-field and four-field exact match as counts and denominators, with breakdowns by Arabic/English and routine/hard/manual difficulty. Count missing predictions as misses. Record model errors and withheld recommendations. The report reviews both languages and all 11 cases with a field mismatch.
- [x] Record completion and any live coverage limits in [STATUS.md](STATUS.md). The pilot is ready for a synthetic walkthrough when the workflow and policy checks pass. A quota-limited run remains a partial live benchmark, with attempted cases and total denominators reported.

## UI and UX improvement plan

The audit rated the pilot **7/10 overall**, with **8/10 for UI** and **6.5/10 for UX**. The current screen has a lot of pale gray space, equally prominent panels, and controls that feel visually disconnected. Redesign the workspace so it has a recognizable identity and a clear focal point. Handlers and supervisors should be able to find a case, check the decisive evidence, and record the right outcome without help in Arabic and English.

Follow the [product spec](SPEC.md), [brand guidance](BRAND.md), and [delivery policy](delivery-exception-policy.md). Use the existing React and FastAPI app and the 24 synthetic cases. The pilot records human decisions and supervisor outcomes. Use report-time evidence, preserve the original ticket and audit text, and use «الطلب المُعاد» for returned orders in Arabic UI copy.

### Phase 1 — Redesign the workspace

Use a compact deep-teal header, a warm off-white canvas, white reading surfaces, and slate text. Give the case workspace more room than the queue, and make the recommendation the focal point through type and spacing. Amber marks pending work and supervisor review. Status labels carry the same meaning in both languages.

- [x] Prototype the same `DED-2004` case at 1440px desktop and 390px mobile, in Arabic and English. On desktop, use a narrow queue with compact rows, a prominent case heading, and a wider evidence area beside the recommendation. On mobile, use a full-screen case with a compact header, decisive evidence, then the action. Use the same visual direction in both languages, with RTL-appropriate alignment and room for longer Arabic text.
- [x] In `dashboard/src/styles.css`, set a shared palette, type scale, spacing, borders, and control styles. Start with Inter for English and Noto Sans Arabic for Arabic. Make the case heading, recommended action, evidence headings, and metadata visibly distinct. Use readable line lengths and tabular numerals for IDs. Keep separators subtle and reserve strong color for selection, meaningful warnings, and the primary action.
- [x] In `dashboard/src/App.tsx` and `dashboard/src/CaseEvidence.tsx`, apply that hierarchy to the queue, case header, tracking timeline, and decision controls. Give selected queue rows a clear edge marker. Present tracking as a dated timeline, with a single highlight for the decisive event. Reduce repeated panel borders and labels. Keep the same button and input treatments in edit, supervisor, saved, and recovery states.
- [x] Compare before-and-after captures for `DED-2004` and `DED-2008`, including one recovery state on `DED-2002`. Check that the queue selection, current case, and next action are immediately identifiable. Inspect alignment, text wrapping, spacing, and button prominence in both languages at desktop and phone widths. Repeat the visual review after the workflow changes in later phases.

### Phase 2 — Keep unfinished work

If a handler edits the reason on `DED-2004`, they can check another case and pick up where they left off. Give supervisors the same protection for review notes.

- [x] Save changed handler action and reason, and changed supervisor notes, by case and staff identity in `dashboard/src/App.tsx`. Keep them in browser session storage so they survive navigation and reload in the same tab. Show a draft indicator and a **Discard draft** action that restores the case's current defaults. Clear the submitted draft after a confirmed save.
- [x] Keep the draft on a failed save. On a `409` conflict, reload the case and ask the staff member to review the latest state before resubmitting. If the case has moved to a state where they cannot act, keep their draft available to read or discard. Prevent double submits and late responses from replacing a newly selected case.
- [x] In `dashboard/src/App.test.tsx` and `e2e/pilot.spec.ts`, verify the edit survives opening another case, editing as another staff member, and reloading. Verify discard, successful save, failed save, and conflict recovery. Exercise the supervisor-note path using `DED-2008`.

### Phase 3 — Put the decisive evidence beside the decision

On `DED-2002`, show the mismatch in delivery proof before asking the handler to record an investigation. On `DED-2004`, show warehouse receipt, available stock, and the unconfirmed address next to the recommendation.

- [x] In `dashboard/src/casePresentation.ts`, build concise evidence summaries from the existing case snapshot. Link each decisive fact to its source in `dashboard/src/CaseEvidence.tsx`. Cover verified prior resolution, delivery proof and scan timing, warehouse versus carrier-depot scans, and stock and address status. Show the relevant facts during manual review and supervisor review too. Use policy order when highlighting competing evidence.
- [x] In `dashboard/src/App.tsx` and `dashboard/src/styles.css`, connect the redesigned mobile queue and case as separate views. Put decisive evidence before the submit action in both reading and keyboard order. Keep direct case links, an obvious **Back to cases** control, and one primary action per state.
- [x] In `e2e/pilot.spec.ts`, verify proof mismatch on `DED-2002`, address confirmation on `DED-2004`, and the completed refund on `DED-2009`. Check warehouse and carrier-depot examples from the working queue. At 360px and 390px, verify the action follows the evidence, source links work, and there is no horizontal overflow. Compare Arabic and English layouts at 1440px.

### Phase 4 — Find the next case and see who owns it

A handler can paste `DED-TRK-2004` to find the case. After sending `DED-2008` for review, the handler sees that a supervisor acts next. A supervisor opens their queue and finds the case ready for them.

- [x] Add `order_id` and `tracking_id` to `GET /api/cases` in `backend/main.py` and to `Summary` in `dashboard/src/api.ts`. Use existing snapshot fields. Keep the endpoint and current fields available. The queue in `dashboard/src/App.tsx` trims pasted IDs and matches by case, order, or tracking ID, regardless of letter case.
- [x] Default the handler queue to `waiting` and the supervisor queue to `awaiting_supervisor`. Keep status filters and **All cases**. A search with no results in the active filter offers **Search all cases**. Mobile **Back to cases** restores the current search and filter.
- [x] Show a confirmation using the resulting case state after each successful save. Use plain labels for decision recorded, awaiting supervisor review, and returned to handler. On a returned case, show the supervisor's reason above the handler's edit controls. Offer **Next case** from the role's actionable queue, with a clear message when that queue is empty. Keep the saved case visible until the staff member chooses to leave it.
- [x] In `backend/tests/test_cases.py`, verify the queue IDs match the corresponding case detail. In `e2e/pilot.spec.ts`, verify all three search keys, both role defaults, and both supervisor outcomes. Verify the updated status and next case after each outcome.

### Phase 5 — Make recovery clear in both languages

If the recommendation fails on `DED-2002`, the Arabic screen explains the problem at the recommendation panel. The handler can retry or continue manually with the evidence still visible.

- [x] Persist the selected language across reloads in `dashboard/src/App.tsx`. Map failures to localized messages and actions using operation and HTTP status in `dashboard/src/api.ts`. Keep errors next to the affected controls. Offer **Retry recommendation** for temporary errors, **Continue manually** when policy allows it, and **Reload case** for conflicts. Show a localized reason when evidence is insufficient and keep the case waiting.
- [x] Keep original evidence in its source language and direction. Review Arabic and English copy for status, next action, and recovery. Keep IDs, policy references, Riyadh times, and SAR amounts readable in RTL. Verify keyboard focus after navigation and errors. Announce pending, failed, and saved states to screen readers. Check ordinary text contrast at 4.5:1 and visible focus indicators at 3:1 against adjacent colors.
- [x] In `e2e/pilot.spec.ts`, using `backend/tests/pilot_server.py` and controlled response failures, verify the Arabic preference survives reload. Exercise a successful retry and a completed manual decision after a failed recommendation. Check an insufficient-evidence response, failed submission, and role or version conflict. Confirm that UI errors give the next step in the selected language.

### Phase 6 — Reassess with real walkthroughs

- [x] Run `npm run check` with the isolated pilot database and stubbed provider. Check all 24 cases in both UI languages at desktop and phone widths. Exercise keyboard navigation and inspect accessible names and reading order in Chromium.
- [x] Use a screen reader to find a case, review its evidence, and record a decision. Verified with NVDA in Chromium on the English recommendation path and Arabic manual fallback.
- [x] Compare old and new screens for visual consistency, typography, density, and RTL balance. Record the internal observations separately from participant feedback.

The [walkthrough guide](PILOT_WALKTHROUGHS.md) contains the four prompts, observer
checks, and an internal comparison of the desktop and phone captures.
