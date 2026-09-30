// The loaded term's catalog, shared by every view that needs it: one IndexedDB
// read, one set of worker listeners, however many components subscribe.
// Loading a term goes through the worker (REFRESH_CATALOG); this store follows
// its progress broadcasts and re-reads the catalog when it lands.
import { useSyncExternalStore } from "react";
import { getAllCourses } from "../shared/db";
import type { Course } from "../shared/types";
import type { BannerTerm } from "../background/agent/banner-ssb-client";

export interface CatalogState {
  terms: BannerTerm[];
  term: string | null;
  termLabel: string | null;
  updatedAt: number | null;
  courses: Course[];
  progress: { done: number; total: number } | null;
  error: { message: string; expired: boolean; recoveryUrl?: string } | null;
}

let state: CatalogState = {
  terms: [],
  term: null,
  termLabel: null,
  updatedAt: null,
  courses: [],
  progress: null,
  error: null,
};
const subscribers = new Set<() => void>();
let started = false;

function set(patch: Partial<CatalogState>) {
  state = { ...state, ...patch };
  subscribers.forEach((f) => f());
}

function readCourses() {
  getAllCourses()
    .then((courses) => set({ courses }))
    .catch(() => set({ courses: [] }));
}

function start() {
  if (started) return;
  started = true;
  chrome.storage.local.get(["catalogTerm", "catalogTermLabel", "catalogUpdatedAt"], (r) =>
    set({
      term: (r.catalogTerm as string) ?? null,
      termLabel: (r.catalogTermLabel as string) ?? null,
      updatedAt: (r.catalogUpdatedAt as number) ?? null,
    })
  );
  chrome.runtime.sendMessage({ type: "GET_CATALOG_TERMS" }, (r) => {
    if (Array.isArray(r?.terms)) set({ terms: r.terms as BannerTerm[] });
  });
  readCourses();
  chrome.storage.onChanged.addListener((changes) => {
    const patch: Partial<CatalogState> = {};
    if (changes.catalogTerm) patch.term = (changes.catalogTerm.newValue as string) ?? null;
    if (changes.catalogTermLabel) patch.termLabel = (changes.catalogTermLabel.newValue as string) ?? null;
    if (changes.catalogUpdatedAt) patch.updatedAt = (changes.catalogUpdatedAt.newValue as number) ?? null;
    if (Object.keys(patch).length) set(patch);
  });
  chrome.runtime.onMessage.addListener((msg: { type?: string; [k: string]: unknown }) => {
    if (msg.type === "CATALOG_PROGRESS") {
      set({ progress: { done: Number(msg.done) || 0, total: Number(msg.total) || 1 }, error: null });
    } else if (msg.type === "CATALOG_READY") {
      set({ progress: null, error: null, updatedAt: (msg.updatedAt as number) ?? Date.now() });
      readCourses();
    } else if (msg.type === "CATALOG_ERROR") {
      set({
        progress: null,
        error: {
          message: String(msg.error ?? "The catalog didn't load."),
          expired: msg.expired === true,
          recoveryUrl: typeof msg.recoveryUrl === "string" ? msg.recoveryUrl : undefined,
        },
      });
    }
  });
}

export function loadCatalogTerm(term: string) {
  const termLabel = state.terms.find((t) => t.code === term)?.description ?? null;
  set({ progress: { done: 0, total: 1 }, error: null });
  chrome.runtime.sendMessage({ type: "REFRESH_CATALOG", term, termLabel });
}

export function useCatalog(): CatalogState {
  return useSyncExternalStore(
    (f) => {
      start();
      subscribers.add(f);
      return () => subscribers.delete(f);
    },
    () => state
  );
}
