import type { Language, Status, Summary } from "./api";
import { formatCount, statuses } from "./casePresentation";
import type { Translate } from "./casePresentation";

export type QueueFilter = Status | "all";

const filters: QueueFilter[] = [
  "all",
  "waiting",
  "awaiting_supervisor",
  "decided",
];
const queueStatuses: Record<Status, [string, string]> = {
  waiting: ["Needs decision", "بانتظار القرار"],
  awaiting_supervisor: ["Needs review", "بانتظار المراجعة"],
  decided: statuses.decided,
};

export function caseType(type: Summary["exception_type"], t: Translate) {
  return type === "return_to_sender"
    ? t("Return to sender", "إرجاع إلى المرسل")
    : t("Missing delivery", "شحنة مفقودة");
}

export function CaseQueue({
  queue,
  filter,
  search,
  selected,
  ready,
  language,
  t,
  onFilter,
  onSearch,
  onSelect,
}: {
  queue: Summary[];
  filter: QueueFilter;
  search: string;
  selected: string;
  ready: boolean;
  language: Language;
  t: Translate;
  onFilter: (filter: QueueFilter) => void;
  onSearch: (search: string) => void;
  onSelect: (caseId: string) => void;
}) {
  const query = search.trim().toLowerCase();
  const matching = queue.filter((item) =>
    [item.case_id, item.order_id, item.tracking_id].some((id) =>
      id?.toLowerCase().includes(query),
    ),
  );
  const visible = matching.filter(
    (item) => filter === "all" || item.status === filter,
  );

  return (
    <nav className="case-queue" aria-labelledby="queue-heading">
      <div className="queue-header">
        <h2 id="queue-heading" tabIndex={-1}>
          {t("Case queue", "قائمة الحالات")}
        </h2>
        <label className="queue-search">
          <span>{t("Find a case", "البحث عن حالة")}</span>
          <input
            type="search"
            dir="auto"
            value={search}
            placeholder={t(
              "Case, order, or tracking ID",
              "رقم الحالة أو الطلب أو التتبع",
            )}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
        <select
          aria-label={t("Filter cases by status", "تصفية الحالات حسب الحالة")}
          value={filter}
          onChange={(event) => onFilter(event.target.value as QueueFilter)}
        >
          {filters.map((value) => (
            <option key={value} value={value}>
              {value === "all"
                ? t("All cases", "كل الحالات")
                : t(...statuses[value])}{" "}
              (
              {formatCount(
                value === "all"
                  ? queue.length
                  : queue.filter((item) => item.status === value).length,
                language,
              )}
              )
            </option>
          ))}
        </select>
      </div>
      <ul className="queue-list">
        {visible.map((item) => (
          <li key={item.case_id}>
            <button
              type="button"
              aria-current={item.case_id === selected ? "true" : undefined}
              onClick={() => onSelect(item.case_id)}
            >
              <bdi dir="ltr" className="case-id">
                {item.case_id}
              </bdi>
              <span className={"status " + item.status}>
                {t(...queueStatuses[item.status])}
              </span>
              <span className="case-type">
                {caseType(item.exception_type, t)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {ready && visible.length === 0 && (
        <div className="queue-empty">
          <p role="status">
            {query
              ? t(
                  "No cases match your search here.",
                  "لا توجد حالات تطابق بحثك هنا.",
                )
              : t(
                  "No cases match this filter.",
                  "لا توجد حالات تطابق التصفية.",
                )}
          </p>
          {filter !== "all" && query && (
            <button
              type="button"
              className="secondary"
              onClick={() => onFilter("all")}
            >
              {t("Search all cases", "البحث في كل الحالات")}
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
