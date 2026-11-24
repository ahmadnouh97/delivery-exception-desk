# Pilot walkthroughs

Run four individual sessions with the synthetic pilot. Give each participant
their task prompt and observe without guiding them. Ask consent before taking
notes. Use participant IDs and avoid collecting names or customer data.

## Set up each session

Start a fresh instance of the test backend for each session. It seeds a temporary
database and uses a stubbed recommendation provider. Leave the participant’s
normal case database untouched.

```powershell
uv run -m uvicorn backend.tests.pilot_server:app --host 127.0.0.1 --port 8001
```

In a second terminal, start the dashboard.

```powershell
$env:DELIVERY_API_URL = 'http://127.0.0.1:8001'
npm run dev:dashboard -- --port 5174
```

For a phone on the same trusted local network, replace the dashboard command
with the command below. Substitute the workstation's private IPv4 address for
`192.168.1.20`. Open `http://192.168.1.20:5174` on the phone, using the same
address. The backend stays on loopback. Stop the dashboard after the session.
[Vite host option](https://vite.dev/config/server-options#server-host)

```powershell
npm exec -- vite dashboard --host 192.168.1.20 --port 5174 --strictPort
```

Start at the case queue with the language and demo role shown below. Record the
device used. Label desktop mobile emulation as a dry run. For supervisor tasks,
prepare the relevant case first as a demo handler. Review its recommendation
and send it for supervisor review. Use a brief handler reason for S1 that gives
no evidence for the shipping address.

## Prompts to read to participants

| Session | Setup | Task prompt |
| --- | --- | --- |
| H1 | Handler, English, desktop | Find the case for tracking ID DED-TRK-2004. Review the recommendation and draft your reason. Open another case, then return and finish your decision. Say what evidence supports it. |
| H2 | Handler, Arabic, phone | ابحث عن الشحنة برقم التتبع DED-TRK-2002 وافتح الحالة. راجع الأدلة، ثم سجّل الإجراء المناسب. اشرح ما الذي اعتمدت عليه. |
| S1 | Supervisor, English, phone | Find DED-2008 in your queue. The team needs the handler to explain how they verified the shipping address. Send the case back with a note that tells the handler what to add. |
| S2 | Supervisor, Arabic, desktop | افتح الحالة DED-2011 من قائمة المراجعة. راجع المبلغ والأدلة، واتخذ قرارك. اشرح سبب القرار ومن عليه اتخاذ الخطوة التالية. |

After each task, ask what caught their eye first, where the screen felt crowded
or unfinished, which evidence drove the decision, and who acts next.

## Observer checks

| Session | Expected outcome | Evidence to hear or see |
| --- | --- | --- |
| H1 | Address confirmation is recorded under P4. The draft survives the interruption. | Warehouse receipt, in-stock replacement, unconfirmed address. |
| H2 | Carrier investigation is recorded under P2 from the manual path after the service error. | The delivery photo shows a label for a different shipment. |
| S1 | Case returns to the handler with the written review note. | The note requests an explanation of address verification. The case is waiting for a handler decision. |
| S2 | SAR 536 refund is approved and the decision is recorded. | Warehouse receipt, refund eligibility, and the order exceeds the SAR 500 review threshold. |

After a session, inspect the case status and decision history. Count any lost
draft, duplicate record, or unintended decision. Record whether the participant
finished without help and could describe the evidence and the next actor.

| Session | Device | Unassisted completion | Evidence cited | Next actor identified | Errors or help | Visual feedback |
| --- | --- | --- | --- | --- | --- | --- |
| H1 |  |  |  |  |  |  |
| H2 |  |  |  |  |  |  |
| S1 |  |  |  |  |  |  |
| S2 |  |  |  |  |  |  |

Keep visual comments and workflow results separate. Review each workflow against
the [pilot plan](PLAN.md#phase-6--reassess-with-real-walkthroughs) before assigning
a new score. Use the case history to resolve discrepancies between observation
and the recorded decision.

## Internal visual comparison

Compared DED-2004 before and after the redesign at 1440 × 900 in English and
390 × 844 in Arabic.

| Area | Observation |
| --- | --- |
| Visual consistency | The dark teal header, selected row, and recommendation accent repeat across views. The case title and proposed action have distinct weights. |
| Typography and density | The desktop queue remains compact, with more space devoted to the proposed action. On the Arabic phone capture, the two-row staff header still takes space while the case occupies the rest of the viewport. |
| RTL balance | The Arabic case mirrors the desktop queue and controls. IDs retain their reading order. English source evidence remains readable in its original direction. |
| Ease of use | The earlier phone layout placed the queue above the selected case. The revised case opens on its own and shows linked evidence before the action. |

This comparison is an internal review of screenshots. The four usability
sessions and the participant-based rating are open.
