"""Compare the pilot agent and single-call baseline on the same case snapshots."""

import argparse
import json
import time
from collections import defaultdict
from pathlib import Path

from groq import APIError, APIStatusError

from backend.evidence import (
    DATA,
    Order,
    Resolution,
    Shipment,
    Ticket,
    read_records,
    snapshot,
)
from backend.policy import Decision, expected
from backend.recommendations import MODEL, model_client, recommend

FIELDS = ("action", "refund_sar", "requires_review", "policy_ref")
DATASETS = (
    (
        "held_out",
        "held_out_cases.json",
        "held_out_decisions.json",
        "prior_resolutions.json",
    ),
    ("harder", "harder/cases.json", "harder/decisions.json", None),
    (
        "even_harder",
        "even_harder/cases.json",
        "even_harder/decisions.json",
        "evals/even_harder/resolution_history.json",
    ),
)


def load_cases():
    cases = []
    for tier, cases_path, labels_path, history_path in DATASETS:
        labels = {
            label["case_id"]: label
            for label in json.loads(
                (DATA / "evals" / labels_path).read_text(encoding="utf-8")
            )
        }
        history = read_records(history_path, Resolution) if history_path else []
        for row in json.loads(
            (DATA / "evals" / cases_path).read_text(encoding="utf-8")
        ):
            case = snapshot(
                Ticket.model_validate(
                    {
                        **row,
                        "order_id": row["order"]["order_id"],
                        "tracking_id": row["shipment"]["tracking_id"],
                    }
                ),
                Order.model_validate(row["order"]),
                Shipment.model_validate(row["shipment"]),
                history,
            )
            label = labels[case.ticket.case_id]
            group = (
                "development_smoke" if tier == "held_out" and label["tiny"] else tier
            )
            cases.append((group, case, label))
    return cases


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Maximum paired cases, up to four requests each.",
    )
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument(
        "--group", choices=["development_smoke", "held_out", "harder", "even_harder"]
    )
    parser.add_argument(
        "--interval", type=float, default=12, help="Seconds between paired cases."
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.limit < 1 or args.offset < 0 or args.interval < 0:
        parser.error("Use a positive limit and nonnegative offset and interval.")
    cases = [
        case for case in load_cases() if args.group is None or case[0] == args.group
    ]
    selected = cases[args.offset : args.offset + args.limit]
    if not selected:
        parser.error("No cases selected.")
    model = model_client()
    scores = defaultdict(
        lambda: dict.fromkeys(
            (*FIELDS, "exact", "attempted", "withheld", "errors", "n"), 0
        )
    )
    stopped = False
    with args.output.open("x", encoding="utf-8") as report:

        def write(record: dict):
            print(json.dumps(record, ensure_ascii=False), file=report, flush=True)

        write(
            {
                "model": MODEL,
                "configurations": ["single_call", "case_lookups"],
                "max_requests": 4 * len(selected),
                "available": len(cases),
            }
        )
        for index, (group, case, label) in enumerate(selected):
            attempted_case = not stopped
            for configuration in ("single_call", "case_lookups"):
                result: Decision | None = None
                error = None
                attempted = not stopped
                if attempted:
                    try:
                        result = recommend(
                            case, model, with_tools=configuration == "case_lookups"
                        )
                    except (APIError, ValueError) as failure:
                        error = type(failure).__name__
                        if isinstance(
                            failure, APIStatusError
                        ) and failure.status_code in {401, 403, 429}:
                            stopped = True
                predicted = result.model_dump() if result else {}
                matches = {
                    field: predicted.get(field) == label[field] for field in FIELDS
                }
                withheld = result is not None and result.fields() != expected(case)
                for bucket in (
                    group,
                    f"{group}/{case.ticket.language}",
                    f"{group}/{label['difficulty']}",
                ):
                    count = scores[configuration, bucket]
                    count["n"] += 1
                    count["attempted"] += int(attempted)
                    count["withheld"] += int(withheld)
                    count["errors"] += int(error is not None)
                    count["exact"] += int(all(matches.values()))
                    for field, match in matches.items():
                        count[field] += int(match)
                write(
                    {
                        "case_id": case.ticket.case_id,
                        "group": group,
                        "language": case.ticket.language,
                        "configuration": configuration,
                        "attempted": attempted,
                        "error": error,
                        "withheld": withheld,
                        "matches": matches,
                        "prediction": predicted,
                        "expected": {
                            field: label[field] for field in (*FIELDS, "rationale")
                        },
                    }
                )
            if attempted_case:
                print(
                    f"{case.ticket.case_id}: paired case {index + 1}/{len(selected)}",
                    flush=True,
                )
            if not stopped and index + 1 < len(selected):
                time.sleep(args.interval)
        for (configuration, bucket), totals in sorted(scores.items()):
            write({"configuration": configuration, "bucket": bucket, **totals})
    print(f"Wrote results to {args.output}")


if __name__ == "__main__":
    main()
