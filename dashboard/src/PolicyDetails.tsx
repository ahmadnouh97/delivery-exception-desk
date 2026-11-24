import type { Translate } from "./casePresentation";

type Copy = [string, string];

// Bilingual display copy for docs/delivery-exception-policy.md (v1).
const rules: Record<string, { title: Copy; clauses: Copy[] }> = {
  P1: {
    title: ["Prior resolution", "الإجراءات السابقة"],
    clauses: [
      [
        "Check the resolution record. If a refund or replacement was completed for the same item and issue, record no further action. This rule takes priority over all others.",
        "راجع سجل الإجراءات السابقة. إذا سبق ردّ المبلغ أو استبدال المنتج نفسه بسبب المشكلة نفسها، فلا يلزم اتخاذ إجراء آخر. لهذا البند الأولوية على بقية البنود.",
      ],
      [
        "A customer message alone does not establish that the issue was resolved. Verify completion in the record.",
        "رسالة العميل وحدها لا تؤكد حلّ المشكلة. تحقّق من اكتمال الإجراء في السجل.",
      ],
    ],
  },
  P2: {
    title: [
      "Delivered but not received",
      "تم تسجيل التسليم والعميل لم يستلم الطلب",
    ],
    clauses: [
      [
        "If the proof of delivery conflicts with the shipment, open a carrier investigation immediately.",
        "إذا كان إثبات التسليم لا يطابق الشحنة، فاطلب من شركة الشحن فتح تحقيق فورًا.",
      ],
      [
        "If proof matches, is inconclusive, or is missing, count from the latest delivered scan. Wait for an update if fewer than 24 hours have passed. At 24 hours or more, open a carrier investigation.",
        "إذا كان الإثبات مطابقًا أو غير حاسم أو غير متاح، فاحسب المدة من آخر تسجيل للتسليم. انتظر تحديثًا إذا مضت أقل من ٢٤ ساعة، وافتح تحقيقًا مع شركة الشحن إذا مضت ٢٤ ساعة أو أكثر.",
      ],
      [
        "Compensation is not authorized at this stage.",
        "لا يُصرف تعويض في هذه المرحلة.",
      ],
    ],
  },
  P3: {
    title: ["Return still in transit", "الطلب المُعاد لا يزال في الطريق"],
    clauses: [
      [
        "Wait for an update until a scan confirms receipt at the retailer’s warehouse. A scan at a carrier depot only confirms that the carrier has the parcel.",
        "انتظر تحديثًا يؤكد استلام مستودع المتجر للطلب المُعاد. تسجيل وصوله إلى مستودع شركة الشحن يعني أنه ما زال لدى الشركة.",
      ],
    ],
  },
  P4: {
    title: [
      "Return received at the warehouse",
      "استلام الطلب المُعاد في المستودع",
    ],
    clauses: [
      [
        "Refund the full order total if the customer explicitly requests a refund or the replacement is out of stock.",
        "أعِد كامل مبلغ الطلب إذا طلب العميل استرداد المبلغ صراحةً أو إذا كان البديل غير متوفر.",
      ],
      [
        "Otherwise, ask the customer to confirm the shipping address if needed. If the address is confirmed, record a replacement.",
        "في غير ذلك، اطلب من العميل تأكيد عنوان الشحن إذا لزم الأمر. إذا كان العنوان مؤكّدًا، فسجّل طلب استبدال.",
      ],
      [
        "Send refunds and replacements for supervisor review if the order total exceeds SAR 500. Record a refund amount of zero for every action other than a refund.",
        "أحِل طلب الاسترداد أو الاستبدال إلى المشرف إذا تجاوز إجمالي الطلب ٥٠٠ ريال سعودي. سجّل مبلغ استرداد قدره صفر لأي إجراء سوى ردّ المبلغ.",
      ],
    ],
  },
  P5: {
    title: ["Supervisor review", "مراجعة المشرف"],
    clauses: [
      [
        "If the order total exceeds SAR 500, send the proposed refund or replacement to a supervisor before execution. Keep the proposed action and cite P5.",
        "إذا تجاوز إجمالي الطلب ٥٠٠ ريال سعودي، فأرسل طلب الاسترداد أو الاستبدال إلى المشرف قبل التنفيذ. احتفظ بالإجراء المقترح وسجّل البند P5 مرجعًا للقرار.",
      ],
      [
        "At SAR 500 or less, follow P4 and proceed without supervisor review.",
        "إذا بلغ إجمالي الطلب ٥٠٠ ريال سعودي أو أقل، فاتّبع البند P4 وأكمل الإجراء دون مراجعة المشرف.",
      ],
    ],
  },
};

export function PolicyDetails({ code, t }: { code: string; t: Translate }) {
  const rule = rules[code];
  const reference = <bdi dir="ltr">{code}</bdi>;
  if (!rule) return <p className="decision-policy">{reference}</p>;
  return (
    <details className="policy-details">
      <summary>
        {t("View policy", "عرض بند السياسة")} {reference} · {t(...rule.title)}
      </summary>
      <ul>
        {rule.clauses.map((clause) => (
          <li key={clause[0]}>{t(...clause)}</li>
        ))}
      </ul>
    </details>
  );
}
