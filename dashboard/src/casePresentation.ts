import type { Action, CaseDetail, Language, Status } from "./api";

export type Translate = (en: string, ar: string) => string;

export const actions: Record<Action, [string, string]> = {
  no_action: ["No action", "لا إجراء"],
  wait_for_update: ["Wait for update", "انتظار التحديث"],
  open_carrier_investigation: [
    "Open carrier investigation",
    "فتح تحقيق مع الناقل",
  ],
  request_information: [
    "Request confirmation of the new delivery address",
    "طلب تأكيد عنوان الشحن الجديد",
  ],
  replace: ["Replace item", "استبدال المنتج"],
  refund: ["Refund order", "استرداد مبلغ الطلب"],
};

export const statuses: Record<Status, [string, string]> = {
  waiting: ["Waiting for decision", "بانتظار القرار"],
  awaiting_supervisor: ["Awaiting supervisor review", "بانتظار مراجعة المشرف"],
  decided: ["Decided", "تم تسجيل القرار"],
};

export const eventNames: Record<string, [string, string]> = {
  out_for_delivery: ["Out for delivery", "خرجت للتوصيل"],
  delivery_attempted: ["Delivery attempted", "محاولة توصيل"],
  delivered: ["Delivered", "تم التسليم"],
  awaiting_pickup: ["Awaiting pickup", "بانتظار الاستلام"],
  return_in_transit: ["Return in transit", "الطلب المُعاد في الطريق"],
  return_at_carrier_depot: ["At carrier depot", "في مركز الناقل"],
  return_received: ["Received at warehouse", "وصل إلى المستودع"],
};

export function readableRecommendation(rationale: string) {
  const firstLetter = rationale.match(/\p{L}/u)?.[0] ?? "";
  const arabic = /\p{Script=Arabic}/u.test(firstLetter);
  return rationale.replace(
    /\x60?\b([a-z]+(?:_[a-z]+)+)\b\x60?(?: (?:event|scan|status)\b)?/g,
    (match: string, code: string) => {
      if (!Object.hasOwn(eventNames, code)) return match;
      if (code === "return_received")
        return arabic ? "استلام الطلب المُعاد في المستودع" : "warehouse receipt";
      return arabic ? eventNames[code][1] : eventNames[code][0].toLowerCase();
    },
  );
}

export function formatCount(count: number, language: Language) {
  return count.toLocaleString(language === "ar" ? "ar-SA" : "en");
}

export const proofKinds: Record<string, [string, string]> = {
  photo: ["Photo", "صورة"],
  signature: ["Signature", "توقيع"],
  recipient_code: ["Recipient code", "رمز المستلم"],
};

export const proofAssessments: Record<string, [string, string]> = {
  matches: ["Proof matches the shipment", "إثبات التسليم مطابق للشحنة"],
  mismatch: [
    "Proof does not match the shipment",
    "إثبات التسليم لا يطابق الشحنة",
  ],
  inconclusive: ["Proof is inconclusive", "إثبات التسليم غير حاسم"],
};

export const policyRules: Record<string, [string, string]> = {
  P1: ["Check prior resolutions", "التحقق من الحلول السابقة"],
  P2: ["Delivered but not received", "تم التسليم والعميل لم يستلم"],
  P3: ["Return still in transit", "الطلب المُعاد لا يزال في الطريق"],
  P4: ["Return received at the warehouse", "استلام الطلب المُعاد في المستودع"],
  P5: [
    "Supervisor approval for high-value orders",
    "موافقة المشرف للطلبات مرتفعة القيمة",
  ],
};

export function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(
    language === "ar" ? "ar-SA-u-ca-gregory" : "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Riyadh",
    },
  ).format(new Date(value));
}

export function money(amount: string | number, language: Language) {
  return new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-GB", {
    style: "currency",
    currency: "SAR",
    currencyDisplay: "code",
  }).format(Number(amount));
}

export type EvidenceSource =
  "tracking" | "ticket" | "order" | "proof" | "prior-resolutions";
type EvidenceFact = { text: string; source: EvidenceSource };

export function decisionEvidence(
  evidence: CaseDetail["evidence"],
  language: Language,
  t: Translate,
): EvidenceFact[] {
  const { ticket, shipment, order, history } = evidence;
  const fact = (source: EvidenceSource, text: string): EvidenceFact => ({
    source,
    text,
  });
  const prior = history.find(
    (entry) => entry.status === "completed" && entry.same_issue,
  );
  if (prior) {
    return [
      fact(
        "prior-resolutions",
        prior.resolution === "replacement"
          ? t(
              "A replacement was already completed for this issue.",
              "تم استبدال المنتج سابقاً لنفس المشكلة.",
            )
          : t(
              "A refund was already completed for this issue.",
              "تم استرداد المبلغ سابقاً لنفس المشكلة.",
            ),
      ),
    ];
  }
  if (ticket.exception_type === "delivered_not_received") {
    if (shipment.proof_of_delivery?.assessment === "mismatch") {
      return [fact("proof", t(...proofAssessments.mismatch))];
    }
    const delivered = shipment.events.findLast(
      (event) => event.status === "delivered",
    );
    const proof = shipment.proof_of_delivery
      ? proofAssessments[shipment.proof_of_delivery.assessment]
      : undefined;
    return [
      ...(delivered
        ? [
            fact(
              "tracking",
              t(
                "The latest delivery scan was " +
                  formatDate(delivered.at, language) +
                  ".",
                "أحدث تسجيل للتسليم كان " +
                  formatDate(delivered.at, language) +
                  ".",
              ),
            ),
          ]
        : [
            fact(
              "tracking",
              t(
                "No delivered scan was available at report time.",
                "لم يكن هناك تسجيل للتسليم وقت البلاغ.",
              ),
            ),
          ]),
      fact(
        "proof",
        proof
          ? t(...proof)
          : t("No delivery proof is available.", "لا يتوفر إثبات تسليم."),
      ),
    ];
  }
  if (!shipment.events.some((event) => event.status === "return_received")) {
    const lastReturn = shipment.events.findLast((event) =>
      event.status.startsWith("return_"),
    );
    return [
      fact(
        "tracking",
        lastReturn?.status === "return_at_carrier_depot"
          ? t(
              "The last return scan was at the carrier depot.",
              "آخر تحديث للطلب المُعاد كان في مركز الناقل.",
            )
          : t(
              "There is no scan confirming warehouse receipt.",
              "لا يوجد تسجيل يؤكد استلام الطلب المُعاد في المستودع.",
            ),
      ),
    ];
  }
  const warehouse = fact(
    "tracking",
    t("The warehouse received the return.", "استلم المستودع الطلب المُعاد."),
  );
  if (ticket.requested_refund_sar !== null) {
    return [
      fact(
        "ticket",
        t("The customer requested a refund.", "العميل طلب استرداد المبلغ."),
      ),
      warehouse,
    ];
  }
  if (!order.replacement_in_stock) {
    return [
      fact("order", t("A replacement is out of stock.", "البديل غير متوفر.")),
      warehouse,
    ];
  }
  return [
    fact(
      "order",
      order.replacement_address_status === "needs_confirmation"
        ? t(
            "The new delivery address needs confirmation.",
            "عنوان الشحن الجديد بحاجة لتأكيد.",
          )
        : t("The delivery address is confirmed.", "عنوان الشحن مؤكد."),
    ),
    fact("order", t("A replacement is in stock.", "البديل متوفر.")),
    warehouse,
  ];
}
