# Paired recommendation evaluation

## Method

Run date: 23 November 2026. The evaluated code and fixtures are pinned to
`fce8fa848329035242f1d1cd6d7217a2d062db65`.

| Workflow | Model and evidence | Provider calls per case |
| --- | --- | ---: |
| Single call | Groq `openai/gpt-oss-20b` with low reasoning effort. The final request receives the ticket and the report-time order, shipment, and verified resolution history. | 1 |
| Case lookups | Same model, reasoning effort, instruction, and structured decision schema. Two bounded lookups fetch the order and shipment, then the verified history. The final request receives the same evidence as the single call. | 3 |

Both final requests include elapsed seconds since the last delivery scan when
available. [The original notebook](../labs/01-delivery-exception-baseline.ipynb)
omitted verified resolution history from its single-call baseline. The paired
run here gives both workflows that history. The five development smoke cases
are reported separately from the other 45 held-out cases and the two eight-case
challenge sets.

The evaluator passes each workflow a validated evidence snapshot. A local
inspection captured the final model messages for all 66 pairs and verified
that they were identical. Lookup messages held only the case ID. The expected
decisions and difficulty labels are used for scoring and grouping after
inference. All 66 labels agree with the deterministic policy validator when
refund amounts are compared as decimals.

The budget was 264 planned calls, capped at 272 HTTP attempts including
transport retries, and 195,000 provider-reported tokens. Requests were paced
against the published limits for the selected model.
[Groq model rate limits](https://console.groq.com/docs/rate-limits)

## Scoring

Each fraction uses the entire slice as its denominator. Exact match requires
the action, SAR refund amount, supervisor review flag, and policy reference to
agree. Missing predictions count as misses. A withheld prediction means it
conflicted with the policy validator and would be suppressed in the dashboard.
The field scores still show which parts of a withheld prediction matched.

## Live results

Both workflows attempted all 66 cases and returned 132 structured predictions.
All 264 provider requests returned HTTP 200 and used 189,112 tokens. No model
generation errors or transport retries were recorded. The policy validator
would withhold six single-call predictions and eight case-lookup predictions.

The single call matched all four fields on 60/66 cases. Case lookups matched on
58/66. On the 45 held-out cases, the scores were 41/45 and 39/45, respectively.

### Development smoke (5)

| Slice | Workflow | Attempts | Action | Refund | Review | Policy | Exact | Errors | Withheld |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | Single call | 5/5 | 4/5 | 5/5 | 5/5 | 5/5 | 4/5 | 0 | 1 |
| All | Case lookups | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 0 | 0 |
| Arabic | Single call | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 2/3 | 0 | 1 |
| Arabic | Case lookups | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0 | 0 |
| English | Single call | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 0 | 0 |
| English | Case lookups | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 0 | 0 |
| Routine | Single call | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 0 | 0 |
| Routine | Case lookups | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 0 | 0 |
| Hard | Single call | 2/2 | 1/2 | 2/2 | 2/2 | 2/2 | 1/2 | 0 | 1 |
| Hard | Case lookups | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 0 | 0 |
| Manual | Single call | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0 | 0 |
| Manual | Case lookups | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 | 0 | 0 |

### Held-out (45)

| Slice | Workflow | Attempts | Action | Refund | Review | Policy | Exact | Errors | Withheld |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | Single call | 45/45 | 44/45 | 45/45 | 44/45 | 43/45 | 41/45 | 0 | 4 |
| All | Case lookups | 45/45 | 42/45 | 44/45 | 44/45 | 43/45 | 39/45 | 0 | 6 |
| Arabic | Single call | 22/22 | 22/22 | 22/22 | 22/22 | 21/22 | 21/22 | 0 | 1 |
| Arabic | Case lookups | 22/22 | 20/22 | 21/22 | 22/22 | 21/22 | 19/22 | 0 | 3 |
| English | Single call | 23/23 | 22/23 | 23/23 | 22/23 | 22/23 | 20/23 | 0 | 3 |
| English | Case lookups | 23/23 | 22/23 | 23/23 | 22/23 | 22/23 | 20/23 | 0 | 3 |
| Routine | Single call | 17/17 | 17/17 | 17/17 | 17/17 | 17/17 | 17/17 | 0 | 0 |
| Routine | Case lookups | 17/17 | 17/17 | 17/17 | 17/17 | 17/17 | 17/17 | 0 | 0 |
| Hard | Single call | 25/25 | 24/25 | 25/25 | 24/25 | 23/25 | 21/25 | 0 | 4 |
| Hard | Case lookups | 25/25 | 22/25 | 24/25 | 24/25 | 23/25 | 19/25 | 0 | 6 |
| Manual | Single call | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0 | 0 |
| Manual | Case lookups | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0 | 0 |

### Harder (8)

| Slice | Workflow | Attempts | Action | Refund | Review | Policy | Exact | Errors | Withheld |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | Single call | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 | 0 | 0 |
| All | Case lookups | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 | 0 | 0 |
| Arabic | Single call | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0 | 0 |
| Arabic | Case lookups | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0 | 0 |
| English | Single call | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0 | 0 |
| English | Case lookups | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0 | 0 |
| Hard | Single call | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 | 0 | 0 |
| Hard | Case lookups | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 | 0 | 0 |

### Even harder (8)

| Slice | Workflow | Attempts | Action | Refund | Review | Policy | Exact | Errors | Withheld |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | Single call | 8/8 | 8/8 | 8/8 | 8/8 | 7/8 | 7/8 | 0 | 1 |
| All | Case lookups | 8/8 | 6/8 | 7/8 | 7/8 | 6/8 | 6/8 | 0 | 2 |
| Arabic | Single call | 4/4 | 4/4 | 4/4 | 4/4 | 3/4 | 3/4 | 0 | 1 |
| Arabic | Case lookups | 4/4 | 3/4 | 4/4 | 4/4 | 3/4 | 3/4 | 0 | 1 |
| English | Single call | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0 | 0 |
| English | Case lookups | 4/4 | 3/4 | 3/4 | 3/4 | 3/4 | 3/4 | 0 | 1 |
| Hard | Single call | 4/4 | 4/4 | 4/4 | 4/4 | 3/4 | 3/4 | 0 | 1 |
| Hard | Case lookups | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0 | 0 |
| Manual | Single call | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 4/4 | 0 | 0 |
| Manual | Case lookups | 4/4 | 2/4 | 3/4 | 3/4 | 2/4 | 2/4 | 0 | 2 |

### All 66 cases

| Slice | Workflow | Attempts | Action | Refund | Review | Policy | Exact | Errors | Withheld |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | Single call | 66/66 | 64/66 | 66/66 | 65/66 | 63/66 | 60/66 | 0 | 6 |
| All | Case lookups | 66/66 | 61/66 | 64/66 | 64/66 | 62/66 | 58/66 | 0 | 8 |
| Arabic | Single call | 33/33 | 32/33 | 33/33 | 33/33 | 31/33 | 30/33 | 0 | 3 |
| Arabic | Case lookups | 33/33 | 30/33 | 32/33 | 33/33 | 31/33 | 29/33 | 0 | 4 |
| English | Single call | 33/33 | 32/33 | 33/33 | 32/33 | 32/33 | 30/33 | 0 | 3 |
| English | Case lookups | 33/33 | 31/33 | 32/33 | 31/33 | 31/33 | 29/33 | 0 | 4 |
| Routine | Single call | 19/19 | 19/19 | 19/19 | 19/19 | 19/19 | 19/19 | 0 | 0 |
| Routine | Case lookups | 19/19 | 19/19 | 19/19 | 19/19 | 19/19 | 19/19 | 0 | 0 |
| Hard | Single call | 39/39 | 37/39 | 39/39 | 38/39 | 36/39 | 33/39 | 0 | 6 |
| Hard | Case lookups | 39/39 | 36/39 | 38/39 | 38/39 | 37/39 | 33/39 | 0 | 6 |
| Manual | Single call | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 | 8/8 | 0 | 0 |
| Manual | Case lookups | 8/8 | 6/8 | 7/8 | 7/8 | 6/8 | 6/8 | 0 | 2 |

## Rationale and disagreement review

The Arabic single-call rationale for DED-1031 identified the unavailable proof
and applied the under-24-hour waiting window. Both English rationales for
DED-1004 cited warehouse receipt, available stock, and the unconfirmed address.
On DED-1001, both workflows matched all four fields and explained them in
English for an Arabic ticket. The field score does not measure language choice.

The table covers every case with a field mismatch in either workflow.

| Case | Single call | Case lookups | Grounding review |
| --- | --- | --- | --- |
| DED-1003 | Withheld | Exact | The single call acknowledged the mismatched proof and then applied the waiting period. The lookup workflow used the mismatch to justify immediate investigation. |
| DED-1006 | Exact | Withheld | The signature was inconclusive and only 23 hours 59 minutes had elapsed. The lookup workflow rounded this to 24 hours and opened an investigation early. |
| DED-1008 | Withheld | Withheld | Both rationales identified warehouse receipt, stock, the confirmed address, and the P5 threshold. The structured policy reference was P4 for the SAR 500.01 replacement in both. |
| DED-1012 | Withheld | Exact | The single call treated missing proof as a mismatch. The lookup workflow used the most recent delivered scan and the under-24-hour waiting period. |
| DED-1031 | Exact | Withheld | The lookup rationale treated unavailable proof and conflicting customer notices as a confirmed mismatch. The elapsed time was 27 minutes. The single call used the waiting window. |
| DED-1037 | Exact | Withheld | Both recognized warehouse receipt, the superseding refund request, and the SAR 529.50 review threshold. The lookup workflow emitted P4 as the structured reference. |
| DED-1041 | Withheld | Withheld | The single call chose the requested same-size replacement and flagged review at SAR 648, but emitted P4. The lookup workflow switched the requested replacement to a full refund without supporting evidence. |
| DED-1044 | Withheld | Withheld | Both correctly cited warehouse receipt, stock, and the missing address confirmation. Both flagged the address request for review because the order was SAR 573. P5 applies at a later refund or replacement decision. |
| DED-4003 | Exact | Withheld | The lookup workflow applied P1 to a pending same-issue refund. P1 requires completion. The inconclusive proof and elapsed time over 24 hours support investigation. |
| DED-4004 | Exact | Withheld | The lookup workflow asserted a new refund request that the ticket did not make. The prior refund was unrelated. Warehouse receipt and stock supported address confirmation before replacement. |
| DED-4005 | Withheld | Exact | Both used the warehouse receipt and the explicit refund request. The single call emitted P4 despite identifying the P5 review requirement for SAR 500.01 in its rationale. |

## Raw results

The workspace run wrote its per-case predictions, rationale text, field
comparisons, and withholding flags to `pilot-eval-2026-11-23.jsonl`.
Provider usage and status codes are in `pilot-eval-2026-11-23-requests.jsonl`.
Both are local run artifacts. The committed report preserves counts and the
case-by-case review.
