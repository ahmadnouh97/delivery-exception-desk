# Delivery Exception Desk data

The JSON files contain synthetic cases. All amounts are in Saudi riyals (SAR).
Join cases, expected decisions, and resolution history by `case_id`.

## Working queue

[`cases.json`](cases.json) is the development queue and can seed the application.
Its tickets use the case fields below and reference the order and shipment by ID.
The notebook uses this queue by default.

| File | Fields |
| --- | --- |
| [`cases.json`](cases.json) | The ticket fields through `requested_refund_sar`, plus `order_id`, `tracking_id`, and `status`. All seed tickets start as `waiting`. |
| [`orders.json`](orders.json) | Fields from the embedded `order` object, plus `customer_id` for the customer who placed the order. |
| [`shipments.json`](shipments.json) | Fields from the embedded `shipment` object, plus `order_id` for the order the parcel belongs to. |
| [`customers.json`](customers.json) | `customer_id` identifies the customer across orders. `display_name` is a synthetic name. `preferred_language` is the preferred support language (`ar` or `en`). `city` is the customer's city. |
| [`evals/decisions.json`](evals/decisions.json) | Expected decisions for the working queue, keyed by `case_id`. |

## Business settings and reference data

| File | Fields |
| --- | --- |
| [`company.json`](company.json) | `retailer_name`, `carrier_name`, `currency`, and `timezone` set the business context. `missing_delivery_wait_hours` is the waiting period in P2. `supervisor_review_threshold_sar` is the order value above which P5 requires review. |
| [`handlers.json`](handlers.json) | `handler_id` identifies a staff record. `display_name` is a synthetic name. `role` is `support_agent` or `supervisor`. `languages` lists the languages the handler supports. |
| [`knowledge.json`](knowledge.json) | Each entry has a `topic` and a short operational `fact`. |
| [Delivery operations playbook](../docs/delivery-operations-playbook.md) | Steps for gathering evidence, handling investigations and returns, and recording decisions for review. |

## Evaluation and security sets

- **Held-out** uses [cases](evals/held_out_cases.json) and [expected decisions](evals/held_out_decisions.json) for comparing a fixed prompt or agent. The five cases exercised during development are smoke tests.
- **Harder** uses [cases](evals/harder/cases.json) and [expected decisions](evals/harder/decisions.json) for testing tricky timing, wording, or refund amounts.
- **Even harder** uses [cases](evals/even_harder/cases.json), [expected decisions](evals/even_harder/decisions.json), and [resolution history](evals/even_harder/resolution_history.json) for testing conflicting evidence and prior actions.
- **Security** uses [customer text checks](security/customer_text_checks.json) for a separate input guard evaluation. `fixture_id` identifies the example. `language` and `customer_message` are inputs. `expected_flag` marks text that addresses the assistant with an unrelated instruction. `reason` explains the label. Ordinary customer requests serve as controls.

Each decision set marks five tickets with `tiny: true` for quick runs.
Keep expected decisions and security labels outside model inputs.

## Cases

[`held_out_cases.json`](evals/held_out_cases.json) shows the case format with order and shipment evidence embedded in each ticket.

| Field | Meaning |
| --- | --- |
| `case_id` | Unique ID for the support case. |
| `language` | Language of the customer message. `ar` is Arabic and `en` is English. |
| `exception_type` | `delivered_not_received` means the carrier marked the parcel delivered, but the customer reports it missing. `return_to_sender` means the parcel is going back or has already arrived at the retailer. |
| `reported_at` | When the customer reported the issue, including the time zone offset. |
| `customer_message` | What the customer wrote. |
| `requested_refund_sar` | Amount the customer asks to get back. An unconditional refund request with no stated amount uses the order total. `null` means there is no unconditional refund request. |
| `order` | Details of the original order. |
| `order.order_id` | Unique ID for the order. |
| `order.item` | Product on the order. |
| `order.total_sar` | Total the customer paid for the order. |
| `order.replacement_in_stock` | Whether another unit is available. |
| `order.replacement_address_status` | Whether support can use the address for a replacement. Values are `confirmed` and `needs_confirmation`. |
| `shipment` | Tracking history and proof of delivery. |
| `shipment.tracking_id` | Unique tracking ID for the parcel. |
| `shipment.events` | Carrier events ordered from oldest to newest. |
| `shipment.events[].at` | When the event occurred, including the time zone offset. |
| `shipment.events[].status` | Tracking status at that event. |
| `shipment.events[].detail` | Short note about what happened. |
| `shipment.proof_of_delivery` | Evidence that the parcel was delivered. `null` means no proof is available. |
| `shipment.proof_of_delivery.kind` | Type of proof. Values are `photo`, `signature`, and `recipient_code`. |
| `shipment.proof_of_delivery.assessment` | Whether the proof `matches` the expected parcel, location, or recipient. `mismatch` means it points somewhere else or to someone or something else. `inconclusive` means there is too little evidence to tell. |
| `shipment.proof_of_delivery.detail` | What the proof shows and any limits on what it establishes. |

Tracking statuses include `out_for_delivery`, `delivery_attempted`, `awaiting_pickup`, and `delivered`.
On a return, `return_in_transit` means the parcel is on its way back.
`return_at_carrier_depot` means the carrier still has it.
`return_received` means the retailer's warehouse received it.

## Expected decisions

[`held_out_decisions.json`](evals/held_out_decisions.json) is the answer key used to score the model and agent.

| Field | Meaning |
| --- | --- |
| `case_id` | ID of the case this decision belongs to. |
| `action` | What the analyst should do next. See the list below. |
| `refund_sar` | Expected refund amount. It is zero for actions other than `refund`. |
| `requires_review` | Whether a supervisor must approve the proposed action before it can go ahead. |
| `policy_ref` | Section `P1`–`P5` of the [delivery exception policy](../docs/delivery-exception-policy.md) that governs the decision. |
| `rationale` | Short explanation of the decision and the evidence behind it. |
| `difficulty` | `routine` follows a straightforward rule. `hard` involves tricky timing, evidence, or rules. `manual` requires verified resolution history. |
| `needs` | Extra evidence the analyst needs. `["resolution_history"]` means a history lookup is required. An empty list means the ticket, order, and shipment details are enough. |
| `tiny` | `true` includes this case in the notebook's five-case quick run. |

| Action | Meaning |
| --- | --- |
| `no_action` | The issue has already been resolved. |
| `wait_for_update` | Wait for more time to pass or for a new tracking event. |
| `open_carrier_investigation` | Ask the carrier to investigate the missing parcel. |
| `request_information` | Ask the customer to confirm the address before sending a replacement. |
| `replace` | Propose sending a replacement item. |
| `refund` | Propose returning the order payment. |

## Resolution history

[`prior_resolutions.json`](prior_resolutions.json) contains earlier refund and replacement records for the working queue and held-out cases. A record settles the issue when it is completed and applies to the same issue.

| Field | Meaning |
| --- | --- |
| `case_id` | ID of the case linked to the earlier resolution. |
| `order_id` | ID of the original order. |
| `resolution` | Type of action. Values are `refund` and `replacement`. |
| `status` | Whether the action is `pending` or `completed`. |
| `same_issue` | Whether the action applies to the issue in the current ticket. |
