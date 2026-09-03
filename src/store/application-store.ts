"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { EMPTY_LINKS, type Links } from "@/lib/departments";

/**
 * Application draft store.
 *
 * The browser holds the primary copy (localStorage via zustand/persist),
 * mirrored to the server periodically. If anything goes wrong client-side —
 * tab crash, refresh, accidental close, laptop death — the student's
 * answers survive and are restored automatically.
 */

export interface ApplicationDraft {
  department: string;
  whatsapp: string;
  answers: Record<string, string>;
  links: Links;
  updatedAt: string | null;
}

interface ApplicationStore extends ApplicationDraft {
  hydrated: boolean;
  serverSyncedAt: string | null;
  /** whether a recovered draft banner should be shown */
  recoveredAt: string | null;
  setDepartment: (department: string) => void;
  setWhatsapp: (value: string) => void;
  setAnswer: (questionId: string, value: string) => void;
  setLink: (key: keyof Links, value: string) => void;
  hydrateFrom: (draft: Partial<ApplicationDraft>) => void;
  setHydrated: () => void;
  setServerSyncedAt: (iso: string) => void;
  setRecoveredAt: (iso: string | null) => void;
  reset: () => void;
}

const STORAGE_KEY = "nexus-recruitment-draft-v1";

export const useApplicationStore = create<ApplicationStore>()(
  persist(
    (set) => ({
      department: "",
      whatsapp: "",
      answers: {},
      links: { ...EMPTY_LINKS },
      updatedAt: null,
      hydrated: false,
      serverSyncedAt: null,
      recoveredAt: null,
      setDepartment: (department) =>
        set({ department, updatedAt: new Date().toISOString() }),
      setWhatsapp: (whatsapp) =>
        set({ whatsapp, updatedAt: new Date().toISOString() }),
      setAnswer: (questionId, value) =>
        set((s) => ({
          answers: { ...s.answers, [questionId]: value },
          updatedAt: new Date().toISOString(),
        })),
      setLink: (key, value) =>
        set((s) => ({
          links: { ...s.links, [key]: value },
          updatedAt: new Date().toISOString(),
        })),
      hydrateFrom: (draft) =>
        set((s) => ({
          department: draft.department ?? s.department,
          whatsapp: draft.whatsapp ?? s.whatsapp,
          answers: { ...s.answers, ...(draft.answers ?? {}) },
          links: { ...s.links, ...(draft.links ?? {}) },
          updatedAt: draft.updatedAt ?? s.updatedAt,
        })),
      setHydrated: () => set({ hydrated: true }),
      setServerSyncedAt: (iso) => set({ serverSyncedAt: iso }),
      setRecoveredAt: (iso) => set({ recoveredAt: iso }),
      reset: () =>
        set({
          department: "",
          whatsapp: "",
          answers: {},
          links: { ...EMPTY_LINKS },
          updatedAt: null,
          recoveredAt: null,
          serverSyncedAt: null,
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        department: s.department,
        whatsapp: s.whatsapp,
        answers: s.answers,
        links: s.links,
        updatedAt: s.updatedAt,
      }),
    }
  )
);

export { STORAGE_KEY };
