# Delivery exception policy v1

This policy applies to prepaid, single-item shipments. Evaluate the evidence
available at the time on the case. All order totals and refunds are in Saudi
riyals (SAR). Follow the sections in order.

## P1. Prior resolution

Record `no_action` when verified history shows a completed refund or replacement
for the same item and issue. This takes precedence over all other rules. Treat
customer messages as reports. Use the resolution record's status and issue match
to confirm whether the earlier action settled this case.

## P2. Delivered but not received

Open a carrier investigation (`open_carrier_investigation`) immediately if the
proof of delivery does not match the shipment. Otherwise, if fewer than 24 hours
have elapsed since the latest delivered scan, record `wait_for_update`.
At exactly 24 hours or later, open a carrier investigation. This applies when
the proof matches, is inconclusive, or is unavailable. The carrier investigation
is the next action. Compensation is not authorized at this stage.

## P3. Return to sender in transit

Wait for a `return_received` scan that confirms receipt at the retailer's
warehouse. Until then, record `wait_for_update`. A return scan at a carrier
depot does not confirm warehouse receipt.

## P4. Return to sender received at warehouse

1. If the customer explicitly requests a refund or a replacement is out of
   stock, record `refund` for the full order total.
2. Otherwise, if the replacement address needs confirmation, record
   `request_information` to confirm the address.
3. Otherwise, record `replace`.

Apply P5 to a refund or replacement. Record a refund amount of zero for all
other actions.

## P5. Supervisor review

A proposed refund or replacement for an order total strictly greater than
SAR 500 requires supervisor review before execution. The proposed action stays
`refund` or `replace`. Use P5 as the decision's policy reference when review is
required. At SAR 500 or below, use P4 and proceed without that review.
