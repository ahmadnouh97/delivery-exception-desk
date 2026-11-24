# Status

The local pilot supports the [review workflow](SPEC.md) over 24 synthetic cases. Run
`npm run dev` and open `http://127.0.0.1:5173`. The backend seeds `delivery.sqlite3`
on startup. Set `DELIVERY_DB` to use another file. Existing decisions survive restart.

- The backend prepares recommendations for waiting cases in the background and
  saves them in SQLite. Opening a case early starts or joins its preparation.
  Groq uses
  `GROQ_API_KEY` from the environment or the repository's `.env`.
- Search by case, order, or tracking ID. The queue opens on work for the
  selected role. On a phone, the queue and case open as separate views.
- Review the key facts next to the proposed action. Each fact links to its
  evidence. Accept the recommendation or edit its rationale. If the provider
  fails, retry or continue manually. The report-time evidence determines the
  valid action.
- Unsubmitted reasons and supervisor notes survive case changes and reloads in
  the same tab. Drafts are scoped to each case and staff member. Reload restores
  the selected staff member, and the language preference persists across visits.
- Refunds and replacements over SAR 500 go to supervisor review. Switch to a
  demo supervisor to approve or return the case with a note. The case header
  names the handler who last submitted a decision. The decision history shows
  who submitted or reviewed it and when. Save confirmations identify the next
  role and offer the next actionable case when one is available.
- Run `npm run check` to verify the workflow. Browser and API tests use temporary
  databases and can run without a Groq key.

The [UI and UX milestone](PLAN.md#ui-and-ux-improvement-plan) passed the full
test suite and a Chromium layout check across all 24 cases, in both interface
languages, at desktop and phone widths. NVDA 2026.3.1 announced search results,
decisive evidence, and save confirmations in the English recommendation and
Arabic manual workflows. Each run recorded one decision in the isolated database.
The four [staff walkthroughs](PILOT_WALKTHROUGHS.md) and participant-based rating
remain pending.

## Recommendation evaluation

Run the [paired evaluator](../labs/evaluate_pilot.py) from the repository root.

```powershell
uv run -m labs.evaluate_pilot --group development_smoke --output pilot-eval-smoke.jsonl
```

The evaluator writes per-field matches, exact matches, errors, and withheld
recommendations by dataset, language, and difficulty. Use `--group`, `--offset`,
and `--limit` to run bounded batches. Each paired case uses up to four requests.
Both configurations receive the same report-time evidence and verified history.
The [original notebook](../labs/01-delivery-exception-baseline.ipynb) omitted
verified history from its single-call baseline.

The [paired live evaluation](PILOT_EVALUATION.md) completed on 23 November 2026.
Both workflows attempted all 66 cases. All 264 requests succeeded, and the
policy validator flagged six single-call predictions and eight case-lookup
predictions for withholding.

| Exact match | Development smoke | Held-out | Harder | Even harder | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Single call | 4/5 | 41/45 | 8/8 | 7/8 | 60/66 |
| Agent with case lookups | 5/5 | 39/45 | 8/8 | 6/8 | 58/66 |

The report includes per-field scores, language and difficulty breakdowns,
and a grounding review of every case with a field mismatch.

On 24 November, both workflows received explicit facts about the elapsed wait,
proof assessment, completed same-issue resolutions, and order value threshold.
A focused Groq replay matched all four decision fields on DED-1006, DED-1031,
DED-4003, and DED-4005 in both workflows (8/8 predictions). The 66-case scores
above are from the 23 November run. Run the offline regressions with
`uv run -m pytest backend/tests/test_recommendations.py -k november_policy_facts`.
