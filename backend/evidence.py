import json
from decimal import Decimal
from pathlib import Path
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field, JsonValue, TypeAdapter

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


class Ticket(BaseModel):
    case_id: str
    language: Literal["ar", "en"]
    exception_type: Literal["delivered_not_received", "return_to_sender"]
    reported_at: AwareDatetime
    customer_message: str
    requested_refund_sar: Decimal | None
    order_id: str
    tracking_id: str


class Order(BaseModel):
    order_id: str
    item: str
    total_sar: Decimal = Field(gt=0, decimal_places=2)
    replacement_in_stock: bool
    replacement_address_status: Literal["confirmed", "needs_confirmation"]


class CarrierEvent(BaseModel):
    at: AwareDatetime
    status: str
    detail: str


class Proof(BaseModel):
    kind: str
    assessment: Literal["matches", "mismatch", "inconclusive"]
    detail: str


class Shipment(BaseModel):
    tracking_id: str
    order_id: str | None = None
    events: list[CarrierEvent]
    proof_of_delivery: Proof | None


class Resolution(BaseModel):
    case_id: str
    order_id: str
    resolution: Literal["refund", "replacement"]
    status: Literal["pending", "completed"]
    same_issue: bool


class Handler(BaseModel):
    handler_id: str
    display_name: str
    role: Literal["support_agent", "supervisor"]


class Evidence(BaseModel):
    ticket: Ticket
    order: Order
    shipment: Shipment
    history: list[Resolution]


def snapshot(
    ticket: Ticket, order: Order, shipment: Shipment, history: list[Resolution]
) -> Evidence:
    if (
        ticket.order_id != order.order_id
        or ticket.tracking_id != shipment.tracking_id
        or (shipment.order_id is not None and shipment.order_id != order.order_id)
    ):
        raise ValueError(f"Mismatched order or shipment for {ticket.case_id}")
    events = sorted(shipment.events, key=lambda event: event.at)
    delivered = [event for event in events if event.status == "delivered"]
    shipment = shipment.model_copy(
        update={
            "events": [event for event in events if event.at <= ticket.reported_at],
            "proof_of_delivery": (
                shipment.proof_of_delivery
                if delivered and delivered[-1].at <= ticket.reported_at
                else None
            ),
        }
    )
    return Evidence(
        ticket=ticket,
        order=order,
        shipment=shipment,
        history=[
            entry
            for entry in history
            if entry.case_id == ticket.case_id and entry.order_id == order.order_id
        ],
    )


def read_records[T: BaseModel](name: str, model: type[T], data: Path = DATA) -> list[T]:
    records = TypeAdapter(list[JsonValue]).validate_json((data / name).read_bytes())
    return [model.model_validate(record) for record in records]


def load_queue(data: Path = DATA) -> list[Evidence]:
    orders = {
        order.order_id: order for order in read_records("orders.json", Order, data)
    }
    shipments = {
        shipment.tracking_id: shipment
        for shipment in read_records("shipments.json", Shipment, data)
    }
    history = read_records("prior_resolutions.json", Resolution, data)
    cases = []
    ids: set[str] = set()
    for ticket in read_records("cases.json", Ticket, data):
        order = orders.get(ticket.order_id)
        shipment = shipments.get(ticket.tracking_id)
        if (
            order is None
            or shipment is None
            or shipment.order_id != order.order_id
            or ticket.case_id in ids
        ):
            raise ValueError(f"Invalid fixture references for {ticket.case_id}")
        ids.add(ticket.case_id)
        cases.append(snapshot(ticket, order, shipment, history))
    return cases


def encode(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)
