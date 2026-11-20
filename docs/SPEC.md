# Delivery exception pilot

## How the team works today

E-commerce support handlers investigate missing deliveries and parcels returned
to sender. They read tickets in Arabic and English, match them to orders and
shipments, and check carrier events, proof of delivery, and prior resolutions.
They apply the delivery policy to decide the next action.

## The pilot

Delivery Exception Desk gives handlers a workspace to review recommendations.
The pilot covers prepaid, single-item shipments and uses synthetic case records.

For each case, the decision engine should:

- Match the ticket to its order and shipment.
- Check carrier events, proof of delivery, and prior resolution history. In
  case replays, use the report time as the evidence cutoff.
- Propose the next action under the [delivery exception policy](delivery-exception-policy.md).
- Return the proposed action, refund amount in SAR, supervisor review flag,
  policy reference, and a short rationale grounded in the evidence.

The [operations playbook](delivery-operations-playbook.md) defines what
evidence to gather and how to handle each exception.

## What handlers need to see

- A queue showing which cases need a decision, which await supervisor review,
  and which have a recorded decision.
- A case view showing the ticket, order, shipment, prior resolutions, and the
  evidence behind the recommendation.
- The proposed action, refund amount, review flag, policy reference, and
  rationale alongside that evidence.

Handlers can accept or revise a recommendation. Cases requiring supervisor
review go to a supervisor. The workspace records the human decision.

## How we measure quality

Compare the proposed action, refund amount, review flag, and policy reference
with the expected decision. An exact match requires all four fields to agree.
Report results across Arabic and English and the supported difficulty tiers.
The [data reference](../data/README.md) describes the fixtures and labels.

## Outside the pilot

Executing refunds or replacements, submitting carrier investigations, and
sending messages to customers are separate milestones.
