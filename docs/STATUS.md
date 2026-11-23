# Status

The local pilot supports the [review workflow](SPEC.md) over 24 synthetic cases. Run
`npm run dev` and open `http://127.0.0.1:5173`. The backend seeds `delivery.sqlite3`
on startup. Set `DELIVERY_DB` to use another file. Existing decisions survive restart.

- Select a demo handler, open a case, and generate a recommendation. Groq uses
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

| Live development smoke | Arabic | English | Routine | Hard | Manual | Exact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Agent with case lookups | 3/3 | 2/2 | 2/2 | 2/2 | 1/1 | 5/5 |
| Single call | 2/3 | 2/2 | 2/2 | 1/2 | 1/1 | 4/5 |

The single-call run got 4/5 actions and 5/5 on each other field. It recommended
waiting despite a confirmed proof mismatch in DED-1003. The policy check withheld
that suggestion. The English agent rationale for DED-1004 cited warehouse receipt,
stock, and the unconfirmed address. The agent explained the evidence for the
Arabic DED-1003 ticket in English despite the language instruction.

The broader 66-case run stopped at a Groq rate limit. Both configurations attempted
four of five smoke cases and one of 45 other held-out cases. The agent withheld one
additional smoke suggestion that cited P4 instead of P5. Each challenge set has
eight cases and zero attempts in that run. The full evaluation remains pending.
