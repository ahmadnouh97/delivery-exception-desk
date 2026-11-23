import { useEffect, useRef, useState } from "react";
import { ApiError, post, request } from "./api";
import type {
  Action,
  CaseDetail,
  Decision,
  Handler,
  Status,
  Summary,
} from "./api";
import { CaseEvidence } from "./CaseEvidence";
import {
  loadDeskStaff,
  rememberDeskStaff,
  useCaseDrafts,
  useDeskLanguage,
} from "./caseDrafts";
import { CaseQueue, caseType } from "./CaseQueue";
import type { QueueFilter } from "./CaseQueue";
import {
  actions,
  decisionEvidence,
  formatDate,
  money,
  policyRules,
  readableRecommendation,
  statuses,
} from "./casePresentation";
import { operationMessage } from "./caseErrors";
import type { Operation, OperationError } from "./caseErrors";
import "./styles.css";

type Outcome = "recorded" | "sent" | "returned" | "approved";
const outcomes: Record<Outcome, [string, string]> = {
  recorded: ["Decision recorded.", "تم تسجيل القرار."],
  sent: [
    "Sent for supervisor review. A supervisor acts next.",
    "أُرسلت الحالة للمراجعة. الخطوة التالية للمشرف.",
  ],
  returned: [
    "Returned to the handler for revision.",
    "أُعيدت الحالة لموظف الدعم لتعديل القرار.",
  ],
  approved: [
    "Approved. The decision has been recorded.",
    "تمت الموافقة وتسجيل القرار.",
  ],
};

function caseInUrl() {
  return new URLSearchParams(location.search).get("case") ?? "";
}

export function App() {
  const [language, setLanguage] = useDeskLanguage();
  const { drafts, saveDraft, discardDraft } = useCaseDrafts();
  const [queue, setQueue] = useState<Summary[]>([]);
  const [filter, setFilter] = useState<QueueFilter | null>(null);
  const [search, setSearch] = useState("");
  const [handlers, setHandlers] = useState<Handler[]>([]);
  const [handler, setHandler] = useState(loadDeskStaff);
  const [selected, setSelected] = useState(caseInUrl);
  const visibleCase = useRef(selected);
  const focusOnNavigation = useRef(false);
  const focusOnRecommendation = useRef(false);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const latestVersions = useRef(new Map<string, number>());
  const [editing, setEditing] = useState(false);
  const [manual, setManual] = useState(false);
  const [pending, setPending] = useState<{ caseId: string } | null>(null);
  const posting = useRef(false);
  const [queueReady, setQueueReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [caseLoadError, setCaseLoadError] = useState(false);
  const [failure, setFailure] = useState<OperationError | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [reload, setReload] = useState(0);
  const [reloadCase, setReloadCase] = useState(0);
  const ar = language === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const path = "/cases/" + encodeURIComponent(selected);
  const activeStaff = handlers.find((entry) => entry.handler_id === handler);
  const role = activeStaff?.role;
  const roleStatus: Status =
    role === "supervisor" ? "awaiting_supervisor" : "waiting";
  const busy = pending !== null;
  const busyHere = pending?.caseId === selected;
  const draftId = `${handler}:${selected}`;
  const draft = drafts[draftId];

  function show(value: CaseDetail) {
    if ((latestVersions.current.get(value.case_id) ?? -1) > value.version)
      return;
    latestVersions.current.set(value.case_id, value.version);
    if (visibleCase.current === value.case_id) {
      setDetail(value);
    }
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
        setHandler((current) =>
          staff.some((entry) => entry.handler_id === current)
            ? current
            : (staff.find((entry) => entry.role === "support_agent")
                ?.handler_id ??
              staff[0]?.handler_id ??
              ""),
        );
        setQueueReady(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (queueReady) rememberDeskStaff(handler);
  }, [handler, queueReady]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void request<CaseDetail>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted && visibleCase.current === selected)
          show(value);
      })
      .catch(() => {
        if (!controller.signal.aborted && visibleCase.current === selected)
          setCaseLoadError(true);
      });
    return () => controller.abort();
  }, [selected, path, reloadCase]);

  function openCase(id: string) {
    if (id === visibleCase.current) return;
    visibleCase.current = id;
    focusOnNavigation.current = true;
    focusOnRecommendation.current = false;
    setFailure(null);
    setCaseLoadError(false);
    setDetail(null);
    setOutcome(null);
    setEditing(false);
    setManual(false);
    setSelected(id);
  }

  useEffect(() => {
    function navigateBack() {
      openCase(caseInUrl());
    }
    window.addEventListener("popstate", navigateBack);
    return () => window.removeEventListener("popstate", navigateBack);
  }, []);

  useEffect(() => {
    if (!focusOnNavigation.current) return;
    focusOnNavigation.current = false;
    document
      .getElementById(selected ? "case-detail" : "queue-heading")
      ?.focus();
  }, [selected]);

  function select(id: string) {
    if (id === visibleCase.current) return;
    const url = new URL(location.href);
    if (id) url.searchParams.set("case", id);
    else url.searchParams.delete("case");
    url.hash = "";
    history.pushState(null, "", url);
    openCase(id);
  }

  async function change(endpoint: Operation, body?: object) {
    if (posting.current || visibleCase.current !== selected) return;
    const trigger = document.activeElement;
    posting.current = true;
    setPending({ caseId: selected });
    setFailure(null);
    setOutcome(null);
    try {
      let value: CaseDetail;
      if (endpoint === "recommendation") {
        await post<Decision>(path + "/" + endpoint);
        value = await request<CaseDetail>(path);
        focusOnRecommendation.current =
          visibleCase.current === selected &&
          value.status === "waiting" &&
          value.recommendation !== null &&
          (document.activeElement === trigger ||
            document.activeElement === document.body);
      } else {
        value = await post<CaseDetail>(path + "/" + endpoint, body);
        discardDraft(draftId);
        if (visibleCase.current === selected) {
          setEditing(false);
          setManual(false);
          setOutcome(
            value.status === "awaiting_supervisor"
              ? "sent"
              : value.status === "waiting"
                ? "returned"
                : endpoint === "supervisor-review"
                  ? "approved"
                  : "recorded",
          );
        }
      }
      show(value);
    } catch (error) {
      if (visibleCase.current !== selected) return;
      const status = error instanceof ApiError ? error.status : 0;
      setFailure({ operation: endpoint, status });
      if (status === 409) {
        setCaseLoadError(false);
        setDetail(null);
        setReloadCase((value) => value + 1);
      }
    } finally {
      posting.current = false;
      setPending(null);
    }
  }

  function retry() {
    setLoadError(false);
    setReload((value) => value + 1);
  }

  function submitDecision(values: Pick<Decision, "action" | "rationale">) {
    if (!detail) return;
    void change("decision", {
      handler_id: handler,
      version: detail.version,
      action: values.action,
      rationale: values.rationale,
    });
  }

  function decisionTitle(decision: Decision) {
    return (
      <>
        {t(...actions[decision.action])}
        {decision.action === "refund" && (
          <>
            {" "}
            · <bdi>{money(decision.refund_sar, language)}</bdi>
          </>
        )}
      </>
    );
  }

  const recommendation = detail?.recommendation;
  const historyEntries = detail?.history ?? [];
  const latestSubmission = historyEntries.findLast(
    (entry) => entry.kind === "submission",
  );
  const caseHandlerName =
    latestSubmission?.display_name ??
    (role === "support_agent" ? activeStaff?.display_name : undefined);
  const latestReview = historyEntries.findLast(
    (entry) => entry.kind === "supervisor",
  );
  const currentDecision =
    detail?.status === "waiting" ? recommendation : latestSubmission?.decision;
  const defaults = latestSubmission?.decision ?? recommendation;
  const action = draft?.action ?? defaults?.action ?? "";
  const canEditAction =
    !recommendation ||
    Boolean(draft && (draft.manual || draft.action !== recommendation.action));
  const reason =
    draft?.reason ??
    (detail?.status === "waiting" ? (defaults?.rationale ?? "") : "");
  const nextCase = queue.find(
    (item) => item.case_id !== selected && item.status === roleStatus,
  );
  const mayAct = detail?.status === roleStatus && Boolean(role);
  const showManual = manual || Boolean(draft || latestSubmission);
  const recommendationFailed = failure?.operation === "recommendation";
  const canGenerate =
    detail?.status === "waiting" && role === "support_agent" && !recommendation;
  const canStartManual =
    canGenerate && ![409, 422].includes(failure?.status ?? 0);
  const facts = detail ? decisionEvidence(detail.evidence, language, t) : [];

  function resetDraft() {
    discardDraft(draftId);
    setEditing(false);
  }

  function refreshCase() {
    setCaseLoadError(false);
    setReloadCase((value) => value + 1);
  }

  useEffect(() => {
    if (failure) document.getElementById("operation-error")?.focus();
    else if (outcome) document.getElementById("outcome-message")?.focus();
    else if (focusOnRecommendation.current) {
      focusOnRecommendation.current = false;
      document.getElementById("recommended-action")?.focus();
    }
  }, [failure, outcome, detail]);

  function displayRationale(rationale: string) {
    return rationale === recommendation?.rationale
      ? readableRecommendation(rationale)
      : rationale;
  }

  return (
    <main
      lang={language}
      dir={ar ? "rtl" : "ltr"}
      className={selected ? "desk has-case" : "desk"}
    >
      <header className="desk-header">
        <div className="masthead">
          <div className="desk-title">
            <span className="desk-mark" aria-hidden="true">
              <span />
            </span>
            <h1>
              {t("Delivery Exception Desk", "مكتب متابعة مشكلات التوصيل")}
            </h1>
          </div>
          <div className="controls">
            <label>
              {t("Demo staff", "موظف تجريبي")}
              <select
                value={handler}
                onChange={(event) => {
                  setHandler(event.target.value);
                  setFilter(null);
                  setEditing(false);
                  setManual(false);
                  setOutcome(null);
                  setFailure(null);
                }}
                disabled={busy}
              >
                {handlers.map((entry) => {
                  const roleLabel =
                    entry.role === "supervisor"
                      ? t("Supervisor", "مشرف")
                      : t("Handler", "موظف دعم");
                  const name = "\u2066" + entry.display_name + "\u2069";
                  return (
                    <option key={entry.handler_id} value={entry.handler_id}>
                      {ar ? roleLabel + " · " + name : name + " · " + roleLabel}
                    </option>
                  );
                })}
              </select>
            </label>
            <button
              className="secondary"
              type="button"
              onClick={() => setLanguage(ar ? "en" : "ar")}
              lang={ar ? "en" : "ar"}
            >
              {t("العربية", "English")}
            </button>
          </div>
        </div>
      </header>
      {loadError && (
        <p className="queue-error" role="alert">
          {t("Could not load the queue.", "تعذّر تحميل قائمة الحالات.")}{" "}
          <button type="button" onClick={retry}>
            {t("Retry", "إعادة المحاولة")}
          </button>
        </p>
      )}
      <div className="workspace">
        <CaseQueue
          queue={queue}
          filter={filter ?? roleStatus}
          search={search}
          selected={selected}
          ready={queueReady}
          language={language}
          t={t}
          onFilter={setFilter}
          onSearch={setSearch}
          onSelect={select}
        />
        <section
          id="case-detail"
          className="case-detail"
          aria-label={t("Case details", "تفاصيل الحالة")}
          tabIndex={-1}
        >
          {selected && (
            <button
              type="button"
              className="back-to-cases secondary"
              onClick={() => select("")}
            >
              <span className="back-arrow" aria-hidden="true" />
              {t("Back to cases", "العودة إلى قائمة الحالات")}
            </button>
          )}
          {caseLoadError && (
            <div className="operation-error" role="alert">
              <p>{t("Could not load the case.", "تعذّر تحميل الحالة.")}</p>
              <button type="button" className="secondary" onClick={refreshCase}>
                {t("Reload case", "إعادة تحميل الحالة")}
              </button>
            </div>
          )}
          {!selected && (
            <div className="panel case-welcome">
              <span className="desk-mark" aria-hidden="true">
                <span />
              </span>
              <h2>{t("Select a case to review", "اختر حالة لمراجعتها")}</h2>
              <p className="muted">
                {t(
                  "Use the queue or search by case, order, or tracking ID.",
                  "استخدم قائمة الحالات أو ابحث برقم الحالة أو الطلب أو التتبع.",
                )}
              </p>
            </div>
          )}
          {selected && !detail && !caseLoadError && (
            <p className="case-loading" role="status">
              {t("Loading case…", "جارٍ تحميل الحالة…")}
            </p>
          )}
          {detail && (
            <>
              <div className="case-header">
                <p className="case-category">
                  {caseType(detail.evidence.ticket.exception_type, t)}
                </p>
                <h2>
                  <bdi dir="ltr">{detail.case_id}</bdi>{" "}
                  <span className={"status " + detail.status}>
                    {t(...statuses[detail.status])}
                  </span>
                </h2>
                <p className="case-item">
                  <bdi>{detail.evidence.order.item}</bdi>
                </p>
                <div className="case-meta muted">
                  <p>
                    {caseHandlerName ? (
                      <>
                        {latestSubmission
                          ? t("Handled by", "موظف الدعم")
                          : t("Reviewing as", "موظف الدعم الحالي")}{" "}
                        <strong>
                          <bdi>{caseHandlerName}</bdi>
                        </strong>
                      </>
                    ) : (
                      t("No handler recorded", "لم يُسجَّل موظف دعم بعد")
                    )}
                  </p>
                  <p>
                    {t("Evidence as of report time", "الأدلة وقت البلاغ")}
                    {" · "}
                    <time dateTime={detail.evidence.ticket.reported_at}>
                      {formatDate(detail.evidence.ticket.reported_at, language)}
                    </time>
                    {" · "}
                    {t("Riyadh time", "بتوقيت الرياض")}
                  </p>
                </div>
              </div>
              {outcome && (
                <div
                  className={"outcome-message " + outcome}
                  id="outcome-message"
                  tabIndex={-1}
                  role="status"
                >
                  <div>
                    <strong>{t(...outcomes[outcome])}</strong>
                    {!nextCase && (
                      <p>
                        {t(
                          "There are no more cases in your queue.",
                          "لا توجد حالات أخرى في قائمتك.",
                        )}
                      </p>
                    )}
                  </div>
                  {nextCase && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setFilter(null);
                        setSearch("");
                        select(nextCase.case_id);
                      }}
                    >
                      {t("Next case", "الحالة التالية")}
                    </button>
                  )}
                </div>
              )}
              <div className="case-grid" key={detail.case_id}>
                <section
                  className="panel decision-panel"
                  aria-labelledby="decision-heading"
                >
                  <h3 id="decision-heading">
                    {detail.status === "waiting"
                      ? t("Recommendation", "التوصية")
                      : detail.status === "awaiting_supervisor"
                        ? t("Proposed decision", "القرار المقترح")
                        : t("Recorded decision", "القرار المسجّل")}
                  </h3>
                  {currentDecision && (
                    <>
                      <p
                        className="decision-action"
                        id="recommended-action"
                        tabIndex={-1}
                      >
                        {decisionTitle(currentDecision)}
                      </p>
                      {currentDecision.requires_review &&
                        detail.status !== "decided" && (
                          <p className="status awaiting_supervisor">
                            {t(
                              "Supervisor review required",
                              "تجب مراجعة المشرف",
                            )}
                          </p>
                        )}
                      <p className="decision-policy">
                        <bdi dir="ltr">{currentDecision.policy_ref}</bdi>
                        {" · "}
                        {policyRules[currentDecision.policy_ref] &&
                          t(...policyRules[currentDecision.policy_ref])}
                      </p>
                      {currentDecision.policy_ref === "P5" &&
                        currentDecision.action !== "refund" && (
                          <p className="decision-policy">
                            {t("Order total", "إجمالي الطلب")} ·{" "}
                            <bdi>
                              {money(detail.evidence.order.total_sar, language)}
                            </bdi>
                          </p>
                        )}
                    </>
                  )}
                  <div className="key-evidence">
                    <h4>{t("Key evidence", "الأدلة الأساسية")}</h4>
                    <ul className="decision-facts">
                      {facts.map(({ text, source }) => (
                        <li key={text}>
                          <a href={`#evidence-${source}`}>{text}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {currentDecision && (
                    <details className="original-reason">
                      <summary>
                        {detail.status === "waiting"
                          ? t(
                              "Original recommendation explanation",
                              "شرح التوصية الأصلي",
                            )
                          : t("Recorded explanation", "سبب القرار المسجّل")}
                      </summary>
                      <p className="source-text" dir="auto">
                        {displayRationale(currentDecision.rationale)}
                      </p>
                    </details>
                  )}

                  {failure && (
                    <div
                      className="operation-error"
                      id="operation-error"
                      role="alert"
                      tabIndex={-1}
                    >
                      <p>{operationMessage(failure, t)}</p>
                      {failure.status === 409 && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setFailure(null);
                            refreshCase();
                          }}
                        >
                          {t("Reload case", "إعادة تحميل الحالة")}
                        </button>
                      )}
                    </div>
                  )}

                  {canGenerate && !showManual && (
                    <div className="decision-controls">
                      {(!recommendationFailed ||
                        ![409, 422, 502].includes(failure.status)) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void change("recommendation")}
                        >
                          {recommendationFailed
                            ? t(
                                "Retry recommendation",
                                "إعادة محاولة إنشاء التوصية",
                              )
                            : t("Generate recommendation", "إنشاء توصية")}
                        </button>
                      )}
                      {canStartManual && (
                        <button
                          type="button"
                          className={
                            failure?.status === 502 ? undefined : "secondary"
                          }
                          disabled={busy}
                          onClick={() => {
                            setManual(true);
                            setFailure(null);
                          }}
                        >
                          {t("Continue manually", "المتابعة يدويًا")}
                        </button>
                      )}
                    </div>
                  )}

                  {detail.status === "waiting" &&
                    latestReview?.outcome === "return_for_revision" && (
                      <div className="review-note">
                        <strong>
                          {t(
                            "Supervisor returned this case for revision",
                            "أعاد المشرف الحالة للتعديل",
                          )}
                        </strong>
                        <p className="source-text" dir="auto">
                          {latestReview.note}
                        </p>
                      </div>
                    )}

                  {draft && (
                    <div className="draft-note">
                      <p className="muted">
                        {t("Unsubmitted draft", "مسودة غير مُرسلة")}
                      </p>
                      {!mayAct && (
                        <>
                          {draft.action && <p>{t(...actions[draft.action])}</p>}
                          <p className="source-text" dir="auto">
                            {draft.reason}
                          </p>
                        </>
                      )}
                      <button
                        type="button"
                        className="secondary"
                        disabled={busyHere}
                        onClick={resetDraft}
                      >
                        {t("Discard draft", "حذف المسودة")}
                      </button>
                    </div>
                  )}

                  {detail.status === "waiting" &&
                    role === "support_agent" &&
                    (recommendation &&
                    !editing &&
                    !draft &&
                    !latestSubmission ? (
                      <div className="decision-controls">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => submitDecision(recommendation)}
                        >
                          {recommendation.requires_review
                            ? t(
                                "Send for supervisor review",
                                "إرسال للمشرف للمراجعة",
                              )
                            : t("Accept recommendation", "قبول التوصية")}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => setEditing(true)}
                        >
                          {t("Edit reason", "تعديل السبب")}
                        </button>
                      </div>
                    ) : (
                      (recommendation || showManual) && (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (action && reason.trim())
                              submitDecision({ action, rationale: reason });
                          }}
                        >
                          <h4>
                            {canEditAction
                              ? t("Manual decision", "قرار يدوي")
                              : t("Edit decision reason", "تعديل سبب القرار")}
                          </h4>
                          {canEditAction && (
                            <label>
                              {t("Action", "الإجراء")}
                              <select
                                value={action}
                                autoFocus={manual && !draft}
                                disabled={busyHere}
                                onChange={(event) =>
                                  saveDraft(draftId, {
                                    action: event.target.value as Action | "",
                                    reason,
                                    manual: true,
                                  })
                                }
                                required
                              >
                                <option value="">
                                  {t("Select an action", "اختر إجراءً")}
                                </option>
                                {(Object.keys(actions) as Action[]).map(
                                  (value) => (
                                    <option key={value} value={value}>
                                      {t(...actions[value])}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                          )}
                          <label>
                            {t("Reason", "السبب")}
                            <textarea
                              autoFocus={editing && Boolean(recommendation)}
                              dir="auto"
                              value={reason}
                              readOnly={busyHere}
                              onChange={(event) =>
                                saveDraft(draftId, {
                                  action,
                                  reason: event.target.value,
                                  manual: canEditAction,
                                })
                              }
                              required
                              maxLength={2000}
                            />
                          </label>
                          <div className="decision-controls">
                            <button
                              type="submit"
                              disabled={busy || !action || !reason.trim()}
                            >
                              {t("Record decision", "تسجيل القرار")}
                            </button>
                            {recommendation && !draft && !latestSubmission && (
                              <button
                                type="button"
                                className="secondary"
                                disabled={busy}
                                onClick={() => setEditing(false)}
                              >
                                {t("Cancel edit", "إلغاء التعديل")}
                              </button>
                            )}
                            {!recommendation &&
                              manual &&
                              !draft &&
                              !latestSubmission && (
                                <button
                                  type="button"
                                  className="secondary"
                                  disabled={busy}
                                  onClick={() => setManual(false)}
                                >
                                  {t(
                                    "Back to recommendation",
                                    "العودة إلى التوصية",
                                  )}
                                </button>
                              )}
                          </div>
                        </form>
                      )
                    ))}

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
                        <h4>{t("Supervisor review", "مراجعة المشرف")}</h4>
                        <label>
                          {t("Review note", "ملاحظة المراجعة")}
                          <textarea
                            dir="auto"
                            value={reason}
                            readOnly={busyHere}
                            onChange={(event) =>
                              saveDraft(draftId, {
                                action: "",
                                reason: event.target.value,
                              })
                            }
                            required
                            maxLength={2000}
                          />
                        </label>
                        <div className="decision-controls">
                          <button
                            type="submit"
                            value="approve"
                            disabled={busy || !reason.trim()}
                          >
                            {t("Approve", "موافقة")}
                          </button>
                          <button
                            type="submit"
                            className="secondary"
                            value="return_for_revision"
                            disabled={busy || !reason.trim()}
                          >
                            {t("Return for revision", "إعادة للمراجعة")}
                          </button>
                        </div>
                      </form>
                    )}

                  {historyEntries.length > 0 && (
                    <details className="decision-history">
                      <summary>{t("Decision history", "سجل القرارات")}</summary>
                      {historyEntries.map((entry, i) => (
                        <article key={i}>
                          <p className="muted">
                            <bdi dir="ltr">{entry.display_name}</bdi> ·{" "}
                            <time dateTime={entry.recorded_at}>
                              {formatDate(entry.recorded_at, language)}
                            </time>
                          </p>
                          {entry.kind === "submission" ? (
                            <>
                              <p>
                                <strong>{decisionTitle(entry.decision)}</strong>{" "}
                                ·{" "}
                                <bdi dir="ltr">{entry.decision.policy_ref}</bdi>
                              </p>
                              <p className="source-text" dir="auto">
                                {entry.decision.rationale}
                              </p>
                            </>
                          ) : (
                            <>
                              <p>
                                <strong>
                                  {entry.outcome === "approve"
                                    ? t("Approved", "تمت الموافقة")
                                    : t(
                                        "Returned for revision",
                                        "أعيد للمراجعة",
                                      )}
                                </strong>
                              </p>
                              <p className="source-text" dir="auto">
                                {entry.note}
                              </p>
                            </>
                          )}
                        </article>
                      ))}
                      {recommendation && detail.status !== "waiting" && (
                        <article>
                          <p>
                            <strong>
                              {t("Original recommendation", "التوصية الأصلية")}
                            </strong>{" "}
                            · {decisionTitle(recommendation)}
                          </p>
                          <p className="source-text" dir="auto">
                            {recommendation.rationale}
                          </p>
                        </article>
                      )}
                    </details>
                  )}
                  {busyHere && (
                    <p className="working" role="status">
                      {t("Working…", "جارٍ التنفيذ…")}
                    </p>
                  )}
                  {busy && !busyHere && (
                    <p className="working muted" role="status">
                      {t(
                        "An action is still in progress on another case.",
                        "يوجد إجراء قيد التنفيذ في حالة أخرى.",
                      )}
                    </p>
                  )}
                </section>
                <CaseEvidence
                  evidence={detail.evidence}
                  priority={facts[0]?.source}
                  language={language}
                  t={t}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
