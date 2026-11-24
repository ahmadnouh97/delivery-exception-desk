export type Status = "waiting" | "awaiting_supervisor" | "decided";
export type Action =
  | "no_action"
  | "wait_for_update"
  | "open_carrier_investigation"
  | "request_information"
  | "replace"
  | "refund";
export type Language = "ar" | "en";
export type Summary = {
  case_id: string;
  language: Language;
  exception_type: "delivered_not_received" | "return_to_sender";
  status: Status;
  item: string;
  order_id: string;
  tracking_id: string;
};
export type Handler = {
  handler_id: string;
  display_name: string;
  role: "support_agent" | "supervisor";
};
export type Decision = {
  action: Action;
  refund_sar: number;
  requires_review: boolean;
  policy_ref: string;
  rationale: string;
};
type Audit = {
  handler_id: string;
  display_name: string;
  recorded_at: string;
};
export type Entry = Audit &
  (
    | { kind: "submission"; decision: Decision }
    | {
        kind: "supervisor";
        outcome: "approve" | "return_for_revision";
        note: string;
      }
  );
export type CaseDetail = {
  case_id: string;
  version: number;
  status: Status;
  recommendation: Decision | null;
  history: Entry[];
  evidence: {
    ticket: {
      language: Language;
      exception_type: Summary["exception_type"];
      customer_message: string;
      reported_at: string;
      requested_refund_sar: string | null;
    };
    order: {
      order_id: string;
      total_sar: string;
      item: string;
      replacement_in_stock: boolean;
      replacement_address_status: "confirmed" | "needs_confirmation";
    };
    shipment: {
      tracking_id: string;
      events: { at: string; status: string; detail: string }[];
      proof_of_delivery: {
        kind: string;
        assessment: string;
        detail: string;
      } | null;
    };
    history: { resolution: string; status: string; same_issue: boolean }[];
  };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch("/api" + path, options);
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    const detail =
      error && typeof error === "object" && "detail" in error
        ? error.detail
        : null;
    throw new ApiError(
      response.status,
      typeof detail === "string" ? detail : String(response.status),
      Number(response.headers.get("Retry-After")) || 0,
    );
  }
  return (await response.json()) as T;
}

export function post<T>(path: string, body?: object): Promise<T> {
  return request<T>(path, {
    method: "POST",
    ...(body && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
}
