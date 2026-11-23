# Delivery Exception Desk pilot plan

Build a local review workspace for missing deliveries and returns to sender. Use the 24 synthetic, prepaid, single-item cases in the working queue, with 12 tickets in each language.

Requirements come from the [pilot spec](SPEC.md), [delivery policy](delivery-exception-policy.md), [operations playbook](delivery-operations-playbook.md), and [brand guidance](BRAND.md). The [data reference](../data/README.md) defines the fixture and label formats.

## Implementation decisions

- Use the existing FastAPI and React entry points, SQLite via `sqlite3`, and the notebook's LangChain, Groq, and Pydantic setup. Generate recommendations on demand for one case at a time. A handler confirms or revises a recommendation before the case proceeds.
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
- [ ] Compare fixed configurations on the same cases. Pass both the same report-time evidence and document any information difference when citing the original baseline. Keep labels outside prompts and tool payloads. Report the five development smoke cases separately from the 45 other held-out cases, plus the 8 harder and 8 even-harder cases.
- [ ] Record per-field and four-field exact match as counts and denominators, with breakdowns by Arabic/English and routine/hard/manual difficulty. Count missing predictions as misses. Record raw model errors and withheld recommendations so the displayed score cannot hide failures. Review at least one rationale from each language and each disagreement for grounding.
- [x] Record completion and any live coverage limits in [STATUS.md](STATUS.md). The pilot is ready for a synthetic walkthrough when the workflow and policy checks pass. A quota-limited run remains a partial live benchmark, with attempted cases and total denominators reported.
