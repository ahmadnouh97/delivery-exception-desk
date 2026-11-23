import { useEffect, useState } from "react";
import type { Action, Language } from "./api";
import { actions } from "./casePresentation";

export type CaseDraft = {
  action: Action | "";
  reason: string;
  manual?: boolean;
};
type Drafts = Record<string, CaseDraft>;

const draftKey = "delivery-desk:drafts";
const languageKey = "delivery-desk:language";
const staffKey = "delivery-desk:staff";

function isDraft(value: unknown): value is CaseDraft {
  return (
    !!value &&
    typeof value === "object" &&
    "action" in value &&
    typeof value.action === "string" &&
    (value.action === "" || Object.hasOwn(actions, value.action)) &&
    "reason" in value &&
    typeof value.reason === "string" &&
    (!("manual" in value) || typeof value.manual === "boolean")
  );
}

function loadDrafts(): Drafts {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(draftKey) ?? "{}");
    return value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value).filter(([, draft]) => isDraft(draft)),
        )
      : {};
  } catch {
    return {};
  }
}

export function useCaseDrafts() {
  const [drafts, setDrafts] = useState(loadDrafts);

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(drafts));
    } catch {
      // Drafts still work in memory when the browser blocks storage.
    }
  }, [drafts]);

  function saveDraft(key: string, draft: CaseDraft) {
    setDrafts((current) => ({ ...current, [key]: draft }));
  }

  function discardDraft(key: string) {
    setDrafts((current) => {
      if (!Object.hasOwn(current, key)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  return { drafts, saveDraft, discardDraft };
}

export function useDeskLanguage() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem(languageKey) === "ar" ? "ar" : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem(languageKey, language);
    } catch {
      // The language can still be changed for the current visit.
    }
  }, [language]);

  return [language, setLanguage] as const;
}

export function loadDeskStaff() {
  try {
    return sessionStorage.getItem(staffKey) ?? "";
  } catch {
    return "";
  }
}

export function rememberDeskStaff(handlerId: string) {
  try {
    sessionStorage.setItem(staffKey, handlerId);
  } catch {
    // The staff member can still be selected for the current visit.
  }
}
