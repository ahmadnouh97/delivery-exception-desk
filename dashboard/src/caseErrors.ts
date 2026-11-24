import type { Translate } from "./casePresentation";

export type Operation = "recommendation" | "decision" | "supervisor-review";
export type OperationError = {
  operation: Operation;
  status: number;
  retryAt?: number;
};

export function operationMessage(
  { operation, status }: OperationError,
  t: Translate,
) {
  if (status === 409) {
    return t(
      "The case changed. Review the latest details before trying again.",
      "تغيّرت الحالة. راجع آخر التفاصيل قبل المحاولة مجددًا.",
    );
  }
  if (status === 403) {
    return t(
      "This staff role cannot take this action. Check the selected staff member.",
      "هذا الإجراء غير متاح لهذا الدور. تحقّق من الموظف المحدد.",
    );
  }
  if (operation === "recommendation") {
    if (status === 429) {
      return t(
        "Recommendations are temporarily rate-limited. You can continue manually.",
        "بلغت خدمة التوصيات حد الاستخدام مؤقتًا. يمكنك المتابعة يدويًا.",
      );
    }
    if (status === 422) {
      return t(
        "The evidence available at report time is insufficient. The case stays open.",
        "الأدلة المتاحة وقت البلاغ غير كافية. ستبقى الحالة مفتوحة.",
      );
    }
    if (status === 502) {
      return t(
        "The recommendation conflicts with policy. Continue manually using the case evidence.",
        "التوصية تخالف السياسة. تابع يدويًا بناءً على أدلة الحالة.",
      );
    }
    return t(
      "Recommendation unavailable. Try again or continue manually.",
      "التوصية غير متاحة. أعد المحاولة أو تابع يدويًا.",
    );
  }
  if (status === 422) {
    return t(
      "The decision could not be saved. Check the action and reason against the evidence.",
      "تعذّر حفظ القرار. راجع الإجراء والسبب بالرجوع إلى الأدلة.",
    );
  }
  return t(
    "Could not confirm the save. Review the case and try again.",
    "تعذّر تأكيد الحفظ. راجع الحالة ثم حاول مجددًا.",
  );
}
