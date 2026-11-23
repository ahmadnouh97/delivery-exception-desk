import { useEffect, useState } from "react";
import { post, request } from "./api";
import type {
  Action,
  CaseDetail,
  Decision,
  Handler,
  Language,
  Summary,
} from "./api";
import "./styles.css";

const actions: Record<Action, [string, string]> = {
  no_action: ["No action", "لا إجراء"],
  wait_for_update: ["Wait for update", "انتظار التحديث"],
  open_carrier_investigation: [
    "Open carrier investigation",
    "فتح تحقيق مع الناقل",
  ],
  request_information: ["Request address confirmation", "طلب تأكيد العنوان"],
  replace: ["Replace", "استبدال"],
  refund: ["Refund", "استرداد المبلغ"],
};
const statuses = {
  waiting: ["Waiting for decision", "بانتظار القرار"],
  awaiting_supervisor: ["Awaiting supervisor review", "بانتظار مراجعة المشرف"],
  decided: ["Decided", "تم تسجيل القرار"],
} as const;
const eventNames: Record<string, [string, string]> = {
  out_for_delivery: ["Out for delivery", "خرج للتوصيل"],
  delivery_attempted: ["Delivery attempted", "محاولة توصيل"],
  delivered: ["Delivered", "تم التسليم"],
  awaiting_pickup: ["Awaiting pickup", "بانتظار الاستلام"],
  return_in_transit: ["Return in transit", "المرتجع في الطريق"],
  return_at_carrier_depot: ["At carrier depot", "في مركز الناقل"],
  return_received: ["Received at warehouse", "وصل إلى المستودع"],
};
const money = (amount: string | number) =>
  new Intl.NumberFormat("en", { style: "currency", currency: "SAR" }).format(
    Number(amount),
  );

export function App() {
  const [language, setLanguage] = useState<Language>("en");
  const [queue, setQueue] = useState<Summary[]>([]);
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [handler, setHandler] = useState("");
  const [selected, setSelected] = useState(
    new URLSearchParams(location.search).get("case") ?? "",
  );
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [action, setAction] = useState<Action | "">("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const ar = language === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const index = ar ? 1 : 0;
  const path = "/cases/" + encodeURIComponent(selected);
  const role = handlers.find((entry) => entry.handler_id === handler)?.role;

  function show(value: CaseDetail) {
    setDetail(value);
    const priorSubmission = value.history.findLast(
      (entry) => entry.kind === "submission",
    );
    const draft = priorSubmission?.decision ?? value.recommendation;
    setAction(draft?.action ?? "");
    setReason(value.status === "waiting" ? (draft?.rationale ?? "") : "");
    setQueue((items) =>
      items.map((item) =>
        item.case_id === value.case_id
          ? { ...item, status: value.status }
          : item,
      ),
    );
  }

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    void Promise.all([
      request<Summary[]>("/cases", options),
      request<Handler[]>("/handlers", options),
    ])
      .then(([cases, staff]) => {
        setQueue(cases);
        setHandlers(staff);
        setHandler(
          (current) =>
            current ||
            staff.find((entry) => entry.role === "support_agent")?.handler_id ||
            "",
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void request<CaseDetail>(path, { signal: controller.signal })
      .then(show)
      .catch(() => {
        if (!controller.signal.aborted) setError("load");
      });
    return () => controller.abort();
  }, [selected, path, reload]);

  function select(id: string) {
    if (id === selected) return;
    history.replaceState(null, "", "?case=" + encodeURIComponent(id));
    setError("");
    setDetail(null);
    setSelected(id);
  }

  async function change(endpoint: string, body?: object) {
    setBusy(true);
    setError("");
    try {
      if (endpoint === "recommendation") {
        await post<Decision>(path + "/" + endpoint);
        show(await request<CaseDetail>(path));
      } else {
        show(await post<CaseDetail>(path + "/" + endpoint, body));
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "load");
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setError("");
    setLoadError(false);
    setReload(reload + 1);
  }

  function summary(decision: Decision) {
    return (
      <>
        <p>
          <strong>{actions[decision.action][index]}</strong> ·{" "}
          <bdi>{decision.policy_ref}</bdi>
        </p>
        <p>
          {t("Refund", "المبلغ المسترد")}{" "}
          <bdi>{money(decision.refund_sar)}</bdi>
        </p>
        <p>
          {decision.requires_review
            ? t("Supervisor review required", "تجب مراجعة المشرف")
            : t("No supervisor review required", "لا حاجة لمراجعة المشرف")}
        </p>
        <p dir="auto">{decision.rationale}</p>
      </>
    );
  }

  const evidence = detail?.evidence;
  const historyEntries = detail?.history ?? [];
  return (
    <main lang={language} dir={ar ? "rtl" : "ltr"}>
      <header>
        <h1>{t("Delivery Exception Desk", "مكتب متابعة مشكلات التوصيل")}</h1>
        <div className="controls">
          <label>
            {t("Demo staff", "موظف تجريبي")}
            <select
              value={handler}
              onChange={(event) => setHandler(event.target.value)}
              disabled={busy}
            >
              {handlers.map((entry) => (
                <option key={entry.handler_id} value={entry.handler_id}>
                  {entry.display_name} ·{" "}
                  {entry.role === "supervisor"
                    ? t("Supervisor", "مشرف")
                    : t("Handler", "موظف دعم")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setLanguage(ar ? "en" : "ar")}
            lang={ar ? "en" : "ar"}
          >
            {t("العربية", "English")}
          </button>
        </div>
      </header>
      {loadError && (
        <p role="alert">
          {t("Could not load the queue.", "تعذّر تحميل قائمة الحالات.")}{" "}
          <button onClick={retry}>{t("Retry", "إعادة المحاولة")}</button>
        </p>
      )}
      <div className="workspace">
        <nav aria-label={t("Case queue", "قائمة الحالات")}>
          <h2>{t("Case queue", "قائمة الحالات")}</h2>
          {queue.map((item) => (
            <button
              key={item.case_id}
              disabled={busy}
              aria-current={item.case_id === selected ? "true" : undefined}
              onClick={() => select(item.case_id)}
            >
              <bdi>{item.case_id}</bdi>
              <span>
                {item.exception_type === "return_to_sender"
                  ? t("Return to sender", "إرجاع إلى المرسل")
                  : t("Missing delivery", "شحنة مفقودة")}
              </span>
              <span className={"status " + item.status}>
                {statuses[item.status][index]}
              </span>
            </button>
          ))}
        </nav>
        <section aria-label={t("Case details", "تفاصيل الحالة")}>
          {error && (
            <p role="alert">
              {error === "load" ? (
                t("Could not load the case.", "تعذّر تحميل الحالة.")
              ) : (
                <bdi>{error}</bdi>
              )}{" "}
              <button onClick={retry}>{t("Reload", "إعادة التحميل")}</button>
            </p>
          )}
          {!selected && (
            <p>{t("Select a case to review.", "اختر حالة لمراجعتها.")}</p>
          )}
          {selected && !detail && !error && (
            <p role="status">{t("Loading case…", "جارٍ تحميل الحالة…")}</p>
          )}
          {detail && evidence && (
            <>
              <h2>
                <bdi>{detail.case_id}</bdi>{" "}
                <span className={"status " + detail.status}>
                  {statuses[detail.status][index]}
                </span>
              </h2>
              <div className="case-grid">
                <div className="panel">
                  <h3>{t("Customer ticket", "تذكرة العميل")}</h3>
                  <p
                    lang={evidence.ticket.language}
                    dir={evidence.ticket.language === "ar" ? "rtl" : "ltr"}
                  >
                    {evidence.ticket.customer_message}
                  </p>
                  <p>
                    {t(
                      "Evidence available at report time",
                      "الأدلة المتاحة عند تقديم البلاغ",
                    )}{" "}
                    <bdi>{evidence.ticket.reported_at}</bdi>
                  </p>
                  {evidence.ticket.requested_refund_sar !== null && (
                    <p>
                      {t("Requested refund", "المبلغ المطلوب")}{" "}
                      <bdi>{money(evidence.ticket.requested_refund_sar)}</bdi>
                    </p>
                  )}
                  <h3>{t("Order and shipment", "الطلب والشحنة")}</h3>
                  <p>
                    <bdi>{evidence.order.order_id}</bdi> ·{" "}
                    <bdi>{evidence.order.item}</bdi> ·{" "}
                    <bdi>{money(evidence.order.total_sar)}</bdi>
                  </p>
                  <p>
                    <bdi>{evidence.shipment.tracking_id}</bdi>
                  </p>
                  <p>
                    {evidence.order.replacement_in_stock
                      ? t("Replacement in stock", "البديل متوفر")
                      : t("Replacement out of stock", "البديل غير متوفر")}{" "}
                    ·{" "}
                    {evidence.order.replacement_address_status === "confirmed"
                      ? t("Address confirmed", "العنوان مؤكد")
                      : t(
                          "Address needs confirmation",
                          "العنوان يحتاج إلى تأكيد",
                        )}
                  </p>
                  <ul>
                    {evidence.shipment.events.map((event, i) => (
                      <li key={i}>
                        <bdi>{event.at}</bdi> ·{" "}
                        {eventNames[event.status]?.[index] ?? event.status}
                        <div dir="auto">{event.detail}</div>
                      </li>
                    ))}
                  </ul>
                  <h3>{t("Proof of delivery", "إثبات التسليم")}</h3>
                  {evidence.shipment.proof_of_delivery ? (
                    <p dir="auto">
                      {evidence.shipment.proof_of_delivery.kind} ·{" "}
                      {evidence.shipment.proof_of_delivery.assessment} ·{" "}
                      {evidence.shipment.proof_of_delivery.detail}
                    </p>
                  ) : (
                    <p>{t("No proof available", "لا يتوفر إثبات")}</p>
                  )}
                  <h3>{t("Prior resolutions", "الإجراءات السابقة")}</h3>
                  {evidence.history.length ? (
                    <ul>
                      {evidence.history.map((entry, i) => (
                        <li key={i}>
                          <bdi>
                            {entry.resolution} · {entry.status}
                          </bdi>{" "}
                          ·{" "}
                          {entry.same_issue
                            ? t("Same issue", "المشكلة نفسها")
                            : t("Different issue", "مشكلة أخرى")}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{t("No prior resolutions", "لا توجد إجراءات سابقة")}</p>
                  )}
                </div>
                <div className="panel">
                  <h3>{t("Recommendation", "التوصية")}</h3>
                  {detail.recommendation
                    ? summary(detail.recommendation)
                    : detail.status === "waiting" && (
                        <button
                          disabled={busy}
                          onClick={() => void change("recommendation")}
                        >
                          {t("Generate recommendation", "إنشاء توصية")}
                        </button>
                      )}
                  {detail.status === "waiting" && role === "support_agent" && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void change("decision", {
                          handler_id: handler,
                          version: detail.version,
                          action,
                          rationale: reason,
                        });
                      }}
                    >
                      <h3>{t("Handler decision", "قرار موظف الدعم")}</h3>
                      <label>
                        {t("Action", "الإجراء")}
                        <select
                          value={action}
                          onChange={(event) =>
                            setAction(event.target.value as Action | "")
                          }
                          required
                        >
                          <option value="">
                            {t("Select an action", "اختر إجراءً")}
                          </option>
                          {(Object.keys(actions) as Action[]).map((value) => (
                            <option key={value} value={value}>
                              {actions[value][index]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("Reason", "السبب")}
                        <textarea
                          dir="auto"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          required
                          maxLength={2000}
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={busy || !action || !reason.trim()}
                      >
                        {detail.recommendation?.action === action &&
                        detail.recommendation?.rationale === reason
                          ? t("Accept recommendation", "قبول التوصية")
                          : t("Record decision", "تسجيل القرار")}
                      </button>
                    </form>
                  )}
                  {detail.status === "awaiting_supervisor" &&
                    role === "supervisor" && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const outcome =
                            (
                              event.nativeEvent as SubmitEvent
                            ).submitter?.getAttribute("value") ??
                            "return_for_revision";
                          void change("supervisor-review", {
                            handler_id: handler,
                            version: detail.version,
                            outcome,
                            note: reason,
                          });
                        }}
                      >
                        <h3>{t("Supervisor review", "مراجعة المشرف")}</h3>
                        <label>
                          {t("Review note", "ملاحظة المراجعة")}
                          <textarea
                            dir="auto"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            required
                            maxLength={2000}
                          />
                        </label>
                        <button
                          value="approve"
                          disabled={busy || !reason.trim()}
                        >
                          {t("Approve", "موافقة")}
                        </button>{" "}
                        <button
                          value="return_for_revision"
                          disabled={busy || !reason.trim()}
                        >
                          {t("Return for revision", "إعادة للمراجعة")}
                        </button>
                      </form>
                    )}
                  {historyEntries.length > 0 && (
                    <section>
                      <h3>{t("Decision history", "سجل القرارات")}</h3>
                      {historyEntries.map((entry, i) => (
                        <article key={i}>
                          <p>
                            <bdi>{entry.display_name}</bdi> ·{" "}
                            <bdi>{entry.recorded_at}</bdi>
                          </p>
                          {entry.kind === "submission" ? (
                            summary(entry.decision)
                          ) : (
                            <p>
                              {entry.outcome === "approve"
                                ? t("Approved", "تمت الموافقة")
                                : t(
                                    "Returned for revision",
                                    "أعيد للمراجعة",
                                  )}{" "}
                              · <bdi>{entry.note}</bdi>
                            </p>
                          )}
                        </article>
                      ))}
                    </section>
                  )}
                  {busy && <p role="status">{t("Working…", "جارٍ التنفيذ…")}</p>}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
