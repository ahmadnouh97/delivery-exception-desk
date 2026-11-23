import type { CaseDetail, Language } from "./api";
import {
  eventNames,
  formatCount,
  formatDate,
  money,
  proofAssessments,
  proofKinds,
} from "./casePresentation";
import type { EvidenceSource, Translate } from "./casePresentation";

export function CaseEvidence({
  evidence,
  priority,
  language,
  t,
}: {
  evidence: CaseDetail["evidence"];
  priority?: EvidenceSource;
  language: Language;
  t: Translate;
}) {
  const { ticket, order, shipment, history } = evidence;
  const proof = shipment.proof_of_delivery;
  const relevant = shipment.events.findLast((event) =>
    ticket.exception_type === "delivered_not_received"
      ? event.status === "delivered"
      : event.status.startsWith("return_"),
  );
  const latest = shipment.events.at(-1);
  const featured = relevant ?? latest;
  const otherEvents = shipment.events
    .filter((event) => event !== featured)
    .reverse();

  function carrierEvent(
    event: CaseDetail["evidence"]["shipment"]["events"][number],
  ) {
    const status = eventNames[event.status];
    return (
      <>
        <div className="event-heading">
          <strong>{status ? t(...status) : event.status}</strong>
          <time dateTime={event.at}>{formatDate(event.at, language)}</time>
        </div>
        <p className="source-text" dir="auto">
          {event.detail}
        </p>
      </>
    );
  }

  const proofSection = (
    <div
      className={
        priority === "proof"
          ? "evidence-section lead-evidence proof-mismatch"
          : "evidence-section"
      }
      id="evidence-proof"
      tabIndex={-1}
    >
      <h4>{t("Proof of delivery", "إثبات التسليم")}</h4>
      {proof ? (
        <>
          <p>
            {proofKinds[proof.kind] ? t(...proofKinds[proof.kind]) : proof.kind}{" "}
            ·{" "}
            {proofAssessments[proof.assessment]
              ? t(...proofAssessments[proof.assessment])
              : proof.assessment}
          </p>
          <p className="source-text" dir="auto">
            {proof.detail}
          </p>
        </>
      ) : (
        <p className="muted">{t("No proof available", "لا يتوفر إثبات")}</p>
      )}
    </div>
  );
  const historySection = (
    <div
      className={
        priority === "prior-resolutions"
          ? "evidence-section lead-evidence"
          : "evidence-section"
      }
      id="evidence-prior-resolutions"
      tabIndex={-1}
    >
      <h4>{t("Prior resolutions", "الحلول السابقة")}</h4>
      {history.length > 0 ? (
        <ul>
          {history.map((entry, i) => (
            <li key={i}>
              {entry.resolution === "refund"
                ? t("Refund", "استرداد المبلغ")
                : t("Replacement", "استبدال")}
              {" · "}
              {entry.status === "completed"
                ? t("Completed", "مكتمل")
                : t("Pending", "قيد الانتظار")}
              {" · "}
              {entry.same_issue
                ? t("Same issue", "نفس المشكلة")
                : t("Different issue", "مشكلة مختلفة")}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          {t("No prior resolutions", "لا توجد حلول سابقة")}
        </p>
      )}
    </div>
  );

  return (
    <section
      className="panel evidence-panel"
      aria-labelledby="evidence-heading"
    >
      <h3 id="evidence-heading">{t("Case evidence", "أدلة الحالة")}</h3>
      {priority === "proof" && proofSection}
      {priority === "prior-resolutions" && historySection}
      <div className="evidence-section" id="evidence-tracking" tabIndex={-1}>
        <h4>{t("Tracking timeline", "سجل التتبع")}</h4>
        {featured ? (
          <div className="latest-event">
            <span className="event-label">
              {featured === latest
                ? t("Latest scan", "أحدث تحديث")
                : t("Relevant scan", "التحديث المرتبط بالقرار")}
            </span>
            {carrierEvent(featured)}
          </div>
        ) : (
          <p>{t("No tracking events available", "لا توجد تحديثات تتبع")}</p>
        )}
        {otherEvents.length > 0 && (
          <details>
            <summary>
              {featured === latest
                ? t("Earlier scans", "التحديثات السابقة")
                : t("Other scans", "التحديثات الأخرى")}{" "}
              ({formatCount(otherEvents.length, language)})
            </summary>
            <ul className="timeline">
              {otherEvents.map((event) => (
                <li key={event.at + event.status + event.detail}>
                  {carrierEvent(event)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="evidence-section" id="evidence-ticket" tabIndex={-1}>
        <h4>{t("Customer ticket", "تذكرة العميل")}</h4>
        <p
          className="source-text"
          lang={ticket.language}
          dir={ticket.language === "ar" ? "rtl" : "ltr"}
        >
          {ticket.customer_message}
        </p>
        {ticket.requested_refund_sar !== null && (
          <p>
            {t("Requested refund", "المبلغ المطلوب")}{" "}
            <bdi>{money(ticket.requested_refund_sar, language)}</bdi>
          </p>
        )}
      </div>
      <div className="evidence-section" id="evidence-order" tabIndex={-1}>
        <h4>{t("Order and shipment", "الطلب والشحنة")}</h4>
        <p>
          <bdi>{order.item}</bdi> ·{" "}
          <bdi>{money(order.total_sar, language)}</bdi>
        </p>
        <dl className="case-identifiers">
          <div>
            <dt>{t("Order", "رقم الطلب")}</dt>
            <dd>
              <bdi dir="ltr">{order.order_id}</bdi>
            </dd>
          </div>
          <div>
            <dt>{t("Tracking", "رقم التتبع")}</dt>
            <dd>
              <bdi dir="ltr">{shipment.tracking_id}</bdi>
            </dd>
          </div>
        </dl>
        <p>
          {order.replacement_in_stock
            ? t("Replacement in stock", "البديل متوفر")
            : t("Replacement out of stock", "البديل غير متوفر")}
          {" · "}
          {order.replacement_address_status === "confirmed"
            ? t("Address confirmed", "العنوان مؤكد")
            : t("Address needs confirmation", "العنوان بحاجة لتأكيد")}
        </p>
      </div>
      {priority !== "proof" && proofSection}
      {priority !== "prior-resolutions" && historySection}
    </section>
  );
}
