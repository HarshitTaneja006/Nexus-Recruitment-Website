"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { VitEmailProfile } from "@/lib/vit";
import { DRIVE_DEADLINE } from "@/lib/drive";
import { useDriveOpen } from "@/lib/drive-client";
import type { ApplicationRecord } from "@/lib/storage";
import { useApplicationStore, type ApplicationDraft } from "@/store/application-store";
import { ApplicationForm } from "./application-form";
import { SubmittedView } from "./submitted-view";
import { DraftBanner } from "./draft-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { Hourglass } from "lucide-react";

type Phase = "loading" | "ready" | "submitted";

/**
 * Orchestrates the apply journey: session identity in, draft recovery,
 * autosave mirroring, submission and the post-submit state.
 */
export function ApplyClient({ profile }: { profile: VitEmailProfile }) {
  const router = useRouter();
  const driveOpen = useDriveOpen();
  const [phase, setPhase] = useState<Phase>("loading");
  const [editing, setEditing] = useState(false);
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [recovered, setRecovered] = useState<{
    at: string;
    source: "local" | "server";
  } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- initial load: rehydrate + fetch application + drafts ---------- */
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      // 1. Restore the local draft (zustand persist, skipHydration)
      try {
        await useApplicationStore.persist.rehydrate();
      } catch {
        /* corrupt storage - start clean */
      }
      useApplicationStore.getState().setHydrated();

      if (cancelled) return;

      // 2. Already submitted?
      try {
        const res = await fetch("/api/application", { cache: "no-store" });
        if (res.status === 401) {
          router.refresh();
          return;
        }
        const data = (await res.json()) as { application: ApplicationRecord | null };
        if (data.application) {
          useApplicationStore.getState().reset();
          fetch("/api/application/draft", { method: "DELETE" }).catch(() => undefined);
          if (!cancelled) {
            setApplication(data.application);
            setPhase("submitted");
          }
          return;
        }
      } catch {
        /* network hiccup - continue to form, local draft still holds data */
      }

      // 3. Draft recovery: compare server mirror vs local copy
      const local = useApplicationStore.getState();
      const localHasData =
        Boolean(local.department) ||
        Boolean(local.whatsapp.trim()) ||
        Object.values(local.answers).some((v) => v.trim().length > 0) ||
        Object.values(local.links).some((v) => v.trim().length > 0);

      try {
        const res = await fetch("/api/application/draft", { cache: "no-store" });
        const data = (await res.json()) as {
          draft: { data: ApplicationDraft; updatedAt: string } | null;
        };
        const serverDraft = data.draft;
        const serverNewer =
          serverDraft &&
          serverDraft.data &&
          Object.values(serverDraft.data.answers ?? {}).some((v) => v.trim().length > 0) &&
          (!local.updatedAt ||
            !localHasData ||
            new Date(serverDraft.updatedAt) > new Date(local.updatedAt));

        if (serverNewer && serverDraft) {
          useApplicationStore.getState().hydrateFrom({
            department: serverDraft.data.department,
            whatsapp: serverDraft.data.whatsapp ?? "",
            answers: serverDraft.data.answers,
            links: serverDraft.data.links,
            updatedAt: serverDraft.updatedAt,
          });
          if (!cancelled) {
            setRecovered({ at: serverDraft.updatedAt, source: "server" });
          }
        } else if (localHasData && local.updatedAt) {
          if (!cancelled) setRecovered({ at: local.updatedAt, source: "local" });
        }
      } catch {
        if (!cancelled && localHasData && local.updatedAt) {
          setRecovered({ at: local.updatedAt, source: "local" });
        }
      }

      if (!cancelled) setPhase("ready");
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, [router]);

  /* ---------- server-side draft mirror (debounced autosave) ---------- */
  useEffect(() => {
    if (phase !== "ready" || !driveOpen) return;

    const unsubscribe = useApplicationStore.subscribe((state, prev) => {
      if (!state.updatedAt || state.updatedAt === prev.updatedAt) return;
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(async () => {
        const s = useApplicationStore.getState();
        try {
          const res = await fetch("/api/application/draft", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              department: s.department,
              whatsapp: s.whatsapp,
              answers: s.answers,
              links: s.links,
            }),
          });
          const data = (await res.json()) as { ok: boolean; updatedAt?: string };
          if (data.ok) {
            s.setServerSyncedAt(data.updatedAt ?? new Date().toISOString());
          }
        } catch {
          /* server mirror failed - localStorage copy is intact */
        }
      }, 1500);
    });

    return () => {
      unsubscribe();
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [phase, driveOpen]);

  const handleSubmitted = useCallback(
    (app: { id: string; submittedAt?: string }) => {
      const record: ApplicationRecord = {
        id: app.id,
        email: profile.email,
        fullName: profile.fullName,
        joinYear: profile.joinYear,
        yearOfStudy: profile.yearOfStudy,
        department: useApplicationStore.getState().department,
        whatsapp: useApplicationStore.getState().whatsapp,
        answers: {},
        links: { github: "", linkedin: "", portfolio: "" },
        status: "SUBMITTED",
        statusNote: null,
        panelNote: null,
        statusUpdatedAt: null,
        reviewedBy: null,
        interviewAt: null,
        interviewMode: null,
        clarificationQuestion: null,
        clarificationAnswer: null,
        clarificationAskedAt: null,
        clarificationAnsweredAt: null,
        statusHistory: [],
        submittedAt: app.submittedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // The POST response returns the full application; refresh via GET is
      // simpler than threading the whole record through - fetch it.
      fetch("/api/application", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { application: ApplicationRecord | null }) => {
          setApplication(d.application ?? record);
          setEditing(false);
          setRecovered(null);
          setBannerDismissed(false);
        })
        .catch(() => {
          setApplication(record);
          setEditing(false);
        });
    },
    [profile]
  );

  const handleReopen = useCallback(() => {
    if (!application) return;
    useApplicationStore.getState().hydrateFrom({
      department: application.department,
      whatsapp: application.whatsapp ?? "",
      answers: application.answers,
      links: application.links,
      updatedAt: new Date().toISOString(),
    });
    setEditing(true);
    toast.info("APPLICATION_REOPENED", {
      description: "Edit your answers and re-submit - the new version overwrites the old.",
    });
  }, [application]);

  /* ---------- render ---------- */

  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-14 sm:px-6" aria-busy="true" aria-label="Loading your application">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // drive closed + nothing submitted → hard lock panel
  if (!driveOpen && !application) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-20 sm:px-6">
        <div className="terminal-panel p-8 text-center">
          <Hourglass className="mx-auto h-9 w-9 text-warn" aria-hidden="true" />
          <h1 className="mt-4 font-mono text-xl font-bold tracking-wide text-warn">
            DRIVE_CLOSED
          </h1>
          <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
            The application window closed on{" "}
            <span className="font-mono text-foreground">
              {DRIVE_DEADLINE.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              · 23:59 IST
            </span>
            . If you submitted before the deadline, your application is safely
            stored and under review - sign in to check its status.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-10 items-center border border-border px-4 font-mono text-xs tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              ← BACK_HOME
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // submitted → receipt (works even when the drive is closed - read-only)
  if (application && !editing) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:py-14">
        <p className="section-tag mb-6 self-start">
          <span className="text-primary">00</span>
          <span className="text-muted-foreground">/</span> APPLICATION_STATUS
        </p>
        <SubmittedView
          application={application}
          onReopen={driveOpen ? handleReopen : undefined}
        />
      </div>
    );
  }

  // form (fresh or recovered draft)
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      <p className="section-tag mb-6 self-start">
        <span className="text-primary">00</span>
        <span className="text-muted-foreground">/</span> INITIATE_APPLICATION
      </p>

      {recovered && !bannerDismissed && (
        <div className="mb-6">
          <DraftBanner
            recoveredAt={recovered.at}
            source={recovered.source}
            onKeep={() => setBannerDismissed(true)}
            onDiscard={() => {
              useApplicationStore.getState().reset();
              fetch("/api/application/draft", { method: "DELETE" }).catch(
                () => undefined
              );
              setRecovered(null);
              setBannerDismissed(false);
              toast("DRAFT_WIPED", { description: "Fresh start - rm -rf ~/draft" });
            }}
          />
        </div>
      )}

      <ApplicationForm profile={profile} onSubmitted={handleSubmitted} />
    </div>
  );
}
