import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  deleteSession,
  getSessions,
  getSessionStatus,
  stopSession,
  resumeSession,
  renameSession,
  electionResultsAPI,
} from "../lib/api";
import toast from "react-hot-toast";
import {
  extractAutomaticRetryRounds,
  extractDispatchTier,
  formatAutomaticRetryRounds,
} from "../lib/engineStatusMapper";
import DispatchModeSelector from "./DispatchModeSelector";
import { readStoredDispatchMode } from "../lib/dispatchMode";
import useBoothRangeZipJob, {
  NEXT_BOOTH_DELAY_MS,
  normalizeBoothRangeInput,
} from "../lib/useBoothRangeZipJob";

const SKELETON_COUNT = 8;
const SORT_VALUE = "createdAt:desc";
const DEBOUNCE_MS = 400;

const DEFAULT_FILTERS = {
  boothNo: "",
  assembly: "",
  voterList: "",
  section: "",
  status: "",
  fromDate: "",
  toDate: "",
};

const statusTone = (status) => {
  const key = (status || "").toLowerCase();
  if (key.includes("fail")) return "status-failed";
  if (key.includes("paused") || key.includes("stopped")) return "status-paused";
  if (key.includes("process")) return "status-processing";
  if (key.includes("complete")) return "status-completed";
  return "status-pending";
};

const statusIcon = (status) => {
  const key = (status || "").toLowerCase();
  if (key.includes("fail")) return "❌";
  if (key.includes("paused") || key.includes("stopped")) return "⏸️";
  if (key.includes("process")) return "⏳";
  if (key.includes("complete")) return "✅";
  return "📋";
};

function toSingleQueryValue(value) {
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
}

function parseUrlFilters(query) {
  return {
    boothNo: toSingleQueryValue(query.boothNo),
    assembly: toSingleQueryValue(query.assembly),
    voterList: toSingleQueryValue(query.voterList),
    section: toSingleQueryValue(query.section),
    status: toSingleQueryValue(query.status),
    fromDate: toSingleQueryValue(query.fromDate),
    toDate: toSingleQueryValue(query.toDate),
  };
}

function buildSessionsQuery(filters) {
  const query = {
    sort: SORT_VALUE,
  };

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const text = String(value).trim();
    if (!text) return;
    query[key] = text;
  });

  return query;
}

function serializeQuery(query) {
  const params = new URLSearchParams();
  Object.keys(query)
    .sort()
    .forEach((key) => {
      params.set(key, String(query[key]));
    });
  return params.toString();
}

function normalizeSessionListResponse(res) {
  const list = Array.isArray(res?.sessions)
    ? res.sessions
    : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
        ? res
        : [];

  return {
    sessions: Array.isArray(list) ? list : [],
  };
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function SessionList() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [progressMap, setProgressMap] = useState({});
  const [dispatchTierMap, setDispatchTierMap] = useState({});
  const [renameModal, setRenameModal] = useState(null);
  const [linkedResultState, setLinkedResultState] = useState({
    open: false,
    loading: false,
    data: null,
    error: "",
    sourceSession: null,
  });
  const [linkedYear, setLinkedYear] = useState("");
  const [dispatchMode, setDispatchMode] = useState("auto");
  const [boothSortOrder, setBoothSortOrder] = useState("none");
  const [isTabVisible, setIsTabVisible] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState !== "hidden";
  });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);
  const [boothRangeTouched, setBoothRangeTouched] = useState(false);

  const pageCacheRef = useRef(new Map());
  const requestIdRef = useRef(0);
  const activeControllerRef = useRef(null);

  const debouncedBoothNo = useDebouncedValue(filters.boothNo, DEBOUNCE_MS);
  const debouncedAssembly = useDebouncedValue(filters.assembly, DEBOUNCE_MS);
  const debouncedVoterList = useDebouncedValue(filters.voterList, DEBOUNCE_MS);
  const debouncedSection = useDebouncedValue(filters.section, DEBOUNCE_MS);

  const effectiveFilters = useMemo(
    () => ({
      boothNo: debouncedBoothNo,
      assembly: debouncedAssembly,
      voterList: debouncedVoterList,
      section: debouncedSection,
      status: filters.status,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    }),
    [
      debouncedAssembly,
      debouncedBoothNo,
      debouncedSection,
      debouncedVoterList,
      filters.fromDate,
      filters.status,
      filters.toDate,
    ],
  );

  const resolveSessionsForRange = useCallback(async () => {
    const response = await getSessions({ sort: SORT_VALUE });
    const normalized = normalizeSessionListResponse(response);
    return normalized.sessions;
  }, []);

  const {
    autoState: boothRangeState,
    validationError: boothRangeValidationError,
    nextBoothNo,
    updateRangeInput: updateBoothRangeInput,
    startAutoDownload,
    pauseAutoDownload,
    resumeAutoDownload,
    stopAutoDownload,
    retryFailedBooths,
  } = useBoothRangeZipJob({
    resolveSessionsForRange,
    onWarning: (message) => toast(message, { icon: "⚠️" }),
    onError: (message) => toast.error(message),
    onSuccess: (message) => toast.success(message),
  });

  useEffect(() => {
    setDispatchMode(readStoredDispatchMode());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedOrder =
      window.localStorage.getItem("session-booth-sort-order") || "none";
    if (
      savedOrder === "none" ||
      savedOrder === "asc" ||
      savedOrder === "desc"
    ) {
      setBoothSortOrder(savedOrder);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("session-booth-sort-order", boothSortOrder);
  }, [boothSortOrder]);

  useEffect(() => {
    if (!router.isReady || initializedFromUrl) return;

    const urlFilters = parseUrlFilters(router.query);

    setFilters((prev) => ({ ...prev, ...urlFilters }));
    setInitializedFromUrl(true);
  }, [initializedFromUrl, router.isReady, router.query]);

  useEffect(() => {
    if (!initializedFromUrl || !router.isReady) return;

    const nextQuery = buildSessionsQuery(effectiveFilters);
    const currentQuery = buildSessionsQuery(parseUrlFilters(router.query));

    if (serializeQuery(nextQuery) === serializeQuery(currentQuery)) {
      return;
    }

    router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true },
    );
  }, [effectiveFilters, initializedFromUrl, router]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const onVisibilityChange = () => {
      setIsTabVisible(document.visibilityState !== "hidden");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const load = useCallback(
    ({ force = false } = {}) => {
      if (!initializedFromUrl) return () => {};

      const query = buildSessionsQuery(effectiveFilters);
      const cacheKey = serializeQuery(query);

      if (!force && pageCacheRef.current.has(cacheKey)) {
        const cached = pageCacheRef.current.get(cacheKey);
        setSessions(cached.sessions);
        setError("");
        setLoading(false);
        return () => {};
      }

      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }

      const controller = new AbortController();
      activeControllerRef.current = controller;
      const requestId = ++requestIdRef.current;

      setLoading(true);
      setError("");

      getSessions(query, controller.signal)
        .then((res) => {
          if (requestId !== requestIdRef.current) return;

          const normalized = normalizeSessionListResponse(res);

          setSessions(normalized.sessions);

          pageCacheRef.current.set(cacheKey, {
            sessions: normalized.sessions,
          });

          if (normalized.sessions.length) {
            Promise.all(
              normalized.sessions.map((sessionItem) =>
                getSessionStatus(sessionItem.id, controller.signal)
                  .then((payload) => ({ id: sessionItem.id, payload }))
                  .catch(() => null),
              ),
            ).then((results) => {
              if (requestId !== requestIdRef.current) return;

              const nextProgress = {};
              const nextDispatchTierMap = {};

              results.filter(Boolean).forEach(({ id, payload }) => {
                nextProgress[id] = normalizeProgress(payload);
                const dispatchTier = extractDispatchTier(payload);
                if (dispatchTier) {
                  nextDispatchTierMap[id] = dispatchTier;
                }
              });

              setProgressMap((prev) => ({ ...prev, ...nextProgress }));
              setDispatchTierMap((prev) => ({
                ...prev,
                ...nextDispatchTierMap,
              }));
            });
          }
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          if (requestId !== requestIdRef.current) return;
          setError(err.message || "Failed to load sessions");
        })
        .finally(() => {
          if (requestId !== requestIdRef.current) return;
          setLoading(false);
        });

      return () => controller.abort();
    },
    [effectiveFilters, initializedFromUrl],
  );

  const refreshCurrentPage = useCallback(() => {
    const query = buildSessionsQuery(effectiveFilters);
    const cacheKey = serializeQuery(query);
    pageCacheRef.current.delete(cacheKey);
    load({ force: true });
  }, [effectiveFilters, load]);

  useEffect(() => {
    const cleanup = load();
    return () => cleanup?.();
  }, [load]);

  useEffect(() => {
    if (!router?.query?.fromUpload) return;
    const timer = setTimeout(() => {
      load({ force: true });
    }, 800);
    return () => clearTimeout(timer);
  }, [load, router?.query?.fromUpload]);

  useEffect(() => {
    if (!isTabVisible) return;

    const hasProcessing = sessions.some((s) =>
      (s?.status || "").toLowerCase().includes("process"),
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      load({ force: true });
    }, 2000);

    return () => clearInterval(interval);
  }, [isTabVisible, load, sessions]);

  const setTextFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const setDirectFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleDelete = async (id) => {
    const session = sessions.find((s) => s.id === id);
    if (!window.confirm(`Delete session ${session?.original_filename || id}?`))
      return;

    setActionLoading(id);
    const prev = sessions;
    setSessions((list) => list.filter((s) => s.id !== id));
    try {
      await deleteSession(id);
      pageCacheRef.current.clear();
    } catch (err) {
      setError(err.message || "Delete failed");
      setSessions(prev);
    } finally {
      setActionLoading("");
    }
  };

  const handleStop = async (id) => {
    setActionLoading(id);
    try {
      await stopSession(id);
      refreshCurrentPage();
    } catch (err) {
      setError(err.message || "Failed to stop session");
    } finally {
      setActionLoading("");
    }
  };

  const handleResume = async (id) => {
    setActionLoading(id);
    try {
      const response = await resumeSession(id, dispatchMode);
      const rounds = extractAutomaticRetryRounds(response);
      const retryText = formatAutomaticRetryRounds(rounds);
      toast.success(
        retryText ? `Session resumed. ${retryText}` : "Session resumed.",
      );
      refreshCurrentPage();
    } catch (err) {
      setError(err.message || "Failed to resume session");
    } finally {
      setActionLoading("");
    }
  };

  const handleRename = async (id, newName) => {
    try {
      await renameSession(id, newName);
      setRenameModal(null);
      refreshCurrentPage();
    } catch (err) {
      setError(err.message || "Failed to rename session");
    }
  };

  const handleViewBoothResult = async (session, overrideYear) => {
    setLinkedResultState((prev) => ({
      ...prev,
      open: true,
      loading: true,
      error: "",
      sourceSession: session,
    }));

    const yearToUse =
      overrideYear || linkedYear || session.election_year || session.year || "";

    try {
      const data =
        await electionResultsAPI.getLinkedElectionResultsFromVoterSession(
          session.id,
          yearToUse,
        );
      setLinkedResultState((prev) => ({
        ...prev,
        loading: false,
        data,
        error: "",
      }));
    } catch (err) {
      const message = err.message || "Failed to fetch linked election results";
      setLinkedResultState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
      toast.error(message);
    }
  };

  const handleBoothRangeSubmit = useCallback(
    async (event) => {
      event?.preventDefault();
      setBoothRangeTouched(true);
      await startAutoDownload();
    },
    [startAutoDownload],
  );

  const displaySessions = useMemo(() => {
    const filtered = sessions.filter((session) => {
      const boothFilter = String(effectiveFilters.boothNo || "")
        .trim()
        .toLowerCase();
      if (boothFilter) {
        const boothNumberRaw = String(
          session?.booth_no ?? session?.boothNo ?? session?.booth_number ?? "",
        ).toLowerCase();
        const boothNameRaw = String(
          session?.booth_name ?? session?.boothName ?? "",
        ).toLowerCase();
        const boothNumberParsed = extractBoothNumber(session);
        const boothNumericText = Number.isNaN(boothNumberParsed)
          ? ""
          : String(boothNumberParsed);

        if (
          !boothNumberRaw.includes(boothFilter) &&
          !boothNameRaw.includes(boothFilter) &&
          !boothNumericText.includes(boothFilter)
        ) {
          return false;
        }
      }

      const assemblyFilter = normalizeAssembly(effectiveFilters.assembly);
      if (assemblyFilter) {
        const assemblyText = normalizeAssembly(
          session?.assembly_name ?? session?.constituency ?? session?.assembly,
        );
        if (!assemblyText.includes(assemblyFilter)) return false;
      }

      const listFilter = String(effectiveFilters.voterList || "")
        .trim()
        .toLowerCase();
      if (listFilter) {
        const listText = String(
          session?.original_filename ??
            session?.name ??
            session?.title ??
            session?.filename ??
            "",
        ).toLowerCase();
        if (!listText.includes(listFilter)) return false;
      }

      const sectionFilter = String(effectiveFilters.section || "")
        .trim()
        .toLowerCase();
      if (sectionFilter) {
        const sectionText = String(
          session?.section ?? session?.section_name ?? "",
        ).toLowerCase();
        if (!sectionText.includes(sectionFilter)) return false;
      }

      const statusFilter = String(effectiveFilters.status || "")
        .trim()
        .toLowerCase();
      if (statusFilter) {
        const statusText = String(session?.status || "").toLowerCase();
        if (!statusText.includes(statusFilter)) return false;
      }

      const createdAtValue = session?.created_at ?? session?.createdAt;
      if (effectiveFilters.fromDate && createdAtValue) {
        const fromDate = new Date(`${effectiveFilters.fromDate}T00:00:00`);
        const createdAt = new Date(createdAtValue);
        if (!Number.isNaN(fromDate.getTime()) && createdAt < fromDate) {
          return false;
        }
      }

      if (effectiveFilters.toDate && createdAtValue) {
        const toDate = new Date(`${effectiveFilters.toDate}T23:59:59.999`);
        const createdAt = new Date(createdAtValue);
        if (!Number.isNaN(toDate.getTime()) && createdAt > toDate) {
          return false;
        }
      }

      return true;
    });

    if (boothSortOrder === "none") return filtered;

    const direction = boothSortOrder === "asc" ? 1 : -1;
    const sorted = [...filtered];

    sorted.sort((a, b) => {
      const aBooth = extractBoothNumber(a);
      const bBooth = extractBoothNumber(b);
      const aMissing = Number.isNaN(aBooth);
      const bMissing = Number.isNaN(bBooth);

      if (aMissing && bMissing) {
        return String(a?.id || "").localeCompare(String(b?.id || ""));
      }
      if (aMissing) return 1;
      if (bMissing) return -1;
      if (aBooth !== bBooth) return (aBooth - bBooth) * direction;

      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });

    return sorted;
  }, [boothSortOrder, effectiveFilters, sessions]);

  const boothQueueStatusClass = {
    pending: "bg-slate-700/60 text-slate-200 border-slate-500/60",
    processing: "bg-sky-900/50 text-sky-100 border-sky-700/60",
    downloaded: "bg-emerald-900/50 text-emerald-100 border-emerald-700/60",
    failed: "bg-rose-900/50 text-rose-100 border-rose-700/60",
    skipped: "bg-amber-900/50 text-amber-100 border-amber-700/60",
  };

  const normalizedBoothRangeInput = normalizeBoothRangeInput(
    boothRangeState.rangeInput,
  );

  const boothRangeInlineError =
    boothRangeValidationError ||
    (boothRangeTouched && normalizedBoothRangeInput.error
      ? normalizedBoothRangeInput.error
      : "");

  const boothRangeItems = Array.isArray(boothRangeState.items)
    ? boothRangeState.items
    : [];
  const boothRangeTotals = boothRangeState.totals || {
    total: 0,
    downloaded: 0,
    failed: 0,
    skipped: 0,
  };

  const failedBoothsCount = boothRangeItems.filter(
    (item) => item.status === "failed",
  ).length;
  const currentBoothLabel = boothRangeState.currentBooth || "—";
  const cooldownLabel = formatCountdown(boothRangeState.cooldownMsRemaining);
  const nextBoothEtaLabel =
    boothRangeState.cooldownMsRemaining > 0 ? cooldownLabel : "Ready";
  const runnerStatusLabel = boothRangeState.isRunning
    ? boothRangeState.isPaused
      ? "Paused"
      : "Running"
    : "Idle";
  const runnerStatusClass = boothRangeState.isRunning
    ? boothRangeState.isPaused
      ? "bg-amber-900/50 text-amber-100 border-amber-700/60"
      : "bg-sky-900/50 text-sky-100 border-sky-700/60"
    : "bg-slate-700/60 text-slate-200 border-slate-500/60";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Voter Lists</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="space-y-1">
            <label
              htmlFor="boothSortOrder"
              className="text-xs text-slate-300 uppercase tracking-wide"
            >
              Booth Order
            </label>
            <select
              id="boothSortOrder"
              value={boothSortOrder}
              onChange={(e) => setBoothSortOrder(e.target.value)}
              className="min-w-[170px]"
            >
              <option value="none">Default</option>
              <option value="asc">Booth No (ASC)</option>
              <option value="desc">Booth No (DESC)</option>
            </select>
          </div>
          <DispatchModeSelector
            compact
            value={dispatchMode}
            onChange={setDispatchMode}
          />
          <button
            className="btn btn-secondary"
            onClick={refreshCurrentPage}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              Sequential Booth Range Auto Download
            </h3>
            <p className="text-sm text-slate-300">
              Generates one booth PDF at a time, downloads immediately, then
              waits before next booth.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Concurrency: 1 (strict sequence). Next booth delay:{" "}
              {NEXT_BOOTH_DELAY_MS} ms.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Part No source of truth remains booth-context driven. Current
              booth:
              {` ${currentBoothLabel}`}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${runnerStatusClass}`}
          >
            {runnerStatusLabel}
          </span>
        </div>

        <form onSubmit={handleBoothRangeSubmit} className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-2 lg:col-span-2">
              <label
                htmlFor="boothRangeInput"
                className="text-sm text-slate-200 font-medium"
              >
                Booth Range
              </label>
              <input
                id="boothRangeInput"
                type="text"
                placeholder="Example: 1-50"
                value={boothRangeState.rangeInput}
                onChange={(event) => updateBoothRangeInput(event.target.value)}
                onBlur={() => setBoothRangeTouched(true)}
                className={`w-full rounded-lg border bg-ink-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-neon-200 ${
                  boothRangeInlineError
                    ? "border-rose-500/80 focus:border-rose-400"
                    : "border-ink-500/70 focus:border-neon-300"
                }`}
                aria-invalid={Boolean(boothRangeInlineError)}
                aria-describedby="boothRangeInputHelp"
              />
              <p id="boothRangeInputHelp" className="text-xs text-slate-400">
                Accepted formats: 1-50, 5 to 20, 12.
              </p>
              {normalizedBoothRangeInput.normalized && (
                <p className="text-xs text-slate-300">
                  Normalized range: {normalizedBoothRangeInput.normalized}
                </p>
              )}
              {boothRangeInlineError && (
                <p className="text-xs text-rose-200">{boothRangeInlineError}</p>
              )}
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={boothRangeState.isRunning}
              >
                Start Auto Download
              </button>
            </div>
          </div>
        </form>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 text-sm text-slate-200">
          <div className="rounded-lg border border-ink-500/40 bg-ink-900/50 p-3">
            <div className="text-slate-400 text-xs">Total booths</div>
            <div className="font-semibold mt-1">{boothRangeTotals.total}</div>
          </div>
          <div className="rounded-lg border border-ink-500/40 bg-ink-900/50 p-3">
            <div className="text-slate-400 text-xs">Downloaded</div>
            <div className="font-semibold mt-1">
              {boothRangeTotals.downloaded}
            </div>
          </div>
          <div className="rounded-lg border border-ink-500/40 bg-ink-900/50 p-3">
            <div className="text-slate-400 text-xs">Failed</div>
            <div className="font-semibold mt-1">{boothRangeTotals.failed}</div>
          </div>
          <div className="rounded-lg border border-ink-500/40 bg-ink-900/50 p-3">
            <div className="text-slate-400 text-xs">Skipped</div>
            <div className="font-semibold mt-1">{boothRangeTotals.skipped}</div>
          </div>
          <div className="rounded-lg border border-ink-500/40 bg-ink-900/50 p-3">
            <div className="text-slate-400 text-xs">Current booth</div>
            <div className="font-semibold mt-1">{currentBoothLabel}</div>
          </div>
          <div className="rounded-lg border border-ink-500/40 bg-ink-900/50 p-3">
            <div className="text-slate-400 text-xs">Next booth ETA</div>
            <div className="font-semibold mt-1">{nextBoothEtaLabel}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={pauseAutoDownload}
            disabled={!boothRangeState.isRunning || boothRangeState.isPaused}
          >
            Pause
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={resumeAutoDownload}
            disabled={!boothRangeState.isRunning || !boothRangeState.isPaused}
          >
            Resume
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={stopAutoDownload}
            disabled={!boothRangeState.isRunning}
          >
            Stop
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={retryFailedBooths}
            disabled={boothRangeState.isRunning || failedBoothsCount === 0}
          >
            Retry Failed Booths
          </button>
        </div>

        <div className="rounded-xl border border-ink-400/50 bg-ink-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-base font-semibold text-slate-100">
              Queue View
            </h4>
            {nextBoothNo && (
              <span className="text-xs text-slate-300">
                Next pending booth: {nextBoothNo}
              </span>
            )}
          </div>

          {boothRangeItems.length === 0 ? (
            <p className="text-sm text-slate-400">
              Enter a booth range and start auto download to build the queue.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-300 border-b border-ink-500/40">
                    <th className="py-2 pr-3">Booth</th>
                    <th className="py-2 pr-3">Session ID</th>
                    <th className="py-2 pr-3">Job ID</th>
                    <th className="py-2 pr-3">Attempts</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Status Text</th>
                    <th className="py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {boothRangeItems.map((item) => (
                    <tr
                      key={`booth-run-${item.boothNo}`}
                      className="border-b border-ink-500/30 align-top"
                    >
                      <td className="py-2 pr-3 font-semibold text-slate-100">
                        {item.boothNo}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-300 break-all">
                        {item.sessionId || "—"}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-300 break-all">
                        {item.jobId || "—"}
                      </td>
                      <td className="py-2 pr-3 text-slate-200">
                        {item.attempts}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${boothQueueStatusClass[item.status] || boothQueueStatusClass.pending}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-200">
                        {item.statusText || "—"}
                      </td>
                      <td className="py-2 text-rose-200 break-words">
                        {item.error || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="session-filter-booth"
              className="text-xs text-slate-300"
            >
              Booth No
            </label>
            <input
              id="session-filter-booth"
              type="text"
              value={filters.boothNo}
              onChange={(e) => setTextFilter("boothNo", e.target.value)}
              placeholder="e.g. 123"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="session-filter-assembly"
              className="text-xs text-slate-300"
            >
              Assembly
            </label>
            <input
              id="session-filter-assembly"
              type="text"
              value={filters.assembly}
              onChange={(e) => setTextFilter("assembly", e.target.value)}
              placeholder="Assembly name"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="session-filter-voter-list"
              className="text-xs text-slate-300"
            >
              Voter List
            </label>
            <input
              id="session-filter-voter-list"
              type="text"
              value={filters.voterList}
              onChange={(e) => setTextFilter("voterList", e.target.value)}
              placeholder="Session name"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="session-filter-section"
              className="text-xs text-slate-300"
            >
              Section
            </label>
            <input
              id="session-filter-section"
              type="text"
              value={filters.section}
              onChange={(e) => setTextFilter("section", e.target.value)}
              placeholder="e.g. A"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="session-filter-from"
              className="text-xs text-slate-300"
            >
              From Date
            </label>
            <input
              id="session-filter-from"
              type="date"
              value={filters.fromDate}
              onChange={(e) => setDirectFilter("fromDate", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="session-filter-to"
              className="text-xs text-slate-300"
            >
              To Date
            </label>
            <input
              id="session-filter-to"
              type="date"
              value={filters.toDate}
              onChange={(e) => setDirectFilter("toDate", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="session-filter-status"
              className="text-xs text-slate-300"
            >
              Status
            </label>
            <select
              id="session-filter-status"
              value={filters.status}
              onChange={(e) => setDirectFilter("status", e.target.value)}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="paused">Paused</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <button className="btn btn-secondary" onClick={resetFilters}>
            Reset Filters
          </button>
          <div className="text-xs text-slate-400">Sort: {SORT_VALUE}</div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-900/40 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      )}

      {loading && sessions.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, idx) => (
            <div
              key={`session-skeleton-${idx}`}
              className="card space-y-3 animate-pulse"
            >
              <div className="h-5 w-2/3 rounded bg-ink-100" />
              <div className="h-4 w-1/3 rounded bg-ink-100" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-4 rounded bg-ink-100" />
                <div className="h-4 rounded bg-ink-100" />
                <div className="h-4 rounded bg-ink-100" />
                <div className="h-4 rounded bg-ink-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && displaySessions.length === 0 && (
        <div className="p-3 text-slate-400">
          {sessions.length === 0
            ? "No voter lists found."
            : "No voter lists match these filters."}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displaySessions.map((s) => {
          const status = (s.status || "").toLowerCase();
          const isProcessing = status.includes("process");
          const isPaused =
            status.includes("paused") || status.includes("stopped");
          const isFailed = status.includes("fail");
          const canStop = isProcessing;
          const canResume = isPaused || isFailed;
          const dispatchTier =
            dispatchTierMap[s.id] ||
            extractDispatchTier(s) ||
            (s.activeDispatchTier === "paid" ? "paid" : "free");

          return (
            <div key={s.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-semibold text-slate-100 break-all">
                      {s.original_filename || "Untitled PDF"}
                    </div>
                    <button
                      onClick={() => setRenameModal(s)}
                      className="text-slate-400 hover:text-neon-400 transition-colors"
                      title="Rename session"
                    >
                      ✏️
                    </button>
                  </div>
                  <div className="text-xs text-slate-400">ID: {s.id}</div>
                  {(s.assembly_name || s.constituency) && (
                    <div className="text-xs text-slate-400">
                      Assembly: {s.assembly_name || s.constituency}
                    </div>
                  )}
                  {(s.booth_no || s.booth_name) && (
                    <div className="text-xs text-slate-300">
                      Booth #{s.booth_no || "—"}
                      {s.booth_name ? ` • ${s.booth_name}` : ""}
                    </div>
                  )}
                </div>
                <span className={`badge ${statusTone(s.status)}`}>
                  {statusIcon(s.status)} {s.status || "pending"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                <div>
                  Pages:{" "}
                  <span className="font-semibold">
                    {s.page_count ?? s.pageCount ?? s.total_pages ?? "—"}
                  </span>
                </div>
                <div>
                  Voters:{" "}
                  <span className="font-semibold">
                    {s.voter_count ?? s.voterCount ?? "—"}
                  </span>
                </div>
                <div>
                  Created:{" "}
                  <span className="font-semibold">
                    {s.created_at
                      ? new Date(s.created_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
                <div>
                  Updated:{" "}
                  <span className="font-semibold">
                    {s.updated_at
                      ? new Date(s.updated_at).toLocaleString()
                      : "—"}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-300">
                Dispatch tier used: {dispatchTier === "paid" ? "PAID" : "FREE"}
              </p>

              {(progressMap[s.id] || isProcessing) && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>
                      {isProcessing ? "⏳ Processing..." : "Progress"}
                    </span>
                    <span>
                      {progressMap[s.id]?.processed ?? s.processed_pages ?? 0} /{" "}
                      {progressMap[s.id]?.total ??
                        s.page_count ??
                        s.total_pages ??
                        0}{" "}
                      pages
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-ink-400/50 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isProcessing
                          ? "bg-neon-400 animate-pulse"
                          : "bg-teal-400"
                      }`}
                      style={{ width: `${progressMap[s.id]?.percent ?? 0}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Link className="btn btn-primary" href={`/sessions/${s.id}`}>
                  View
                </Link>
                <Link
                  className="btn btn-secondary"
                  href={`/sessions/${s.id}?openMass=1`}
                >
                  Mass Generate Slip
                </Link>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleViewBoothResult(s)}
                >
                  View Booth Result
                </button>

                {canStop && (
                  <button
                    className="btn bg-amber-600 hover:bg-amber-500 text-white"
                    onClick={() => handleStop(s.id)}
                    disabled={actionLoading === s.id}
                  >
                    {actionLoading === s.id ? "Stopping..." : "🛑 Stop"}
                  </button>
                )}

                {canResume && (
                  <button
                    className="btn bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => handleResume(s.id)}
                    disabled={actionLoading === s.id}
                  >
                    {actionLoading === s.id ? "Resuming..." : "▶️ Resume"}
                  </button>
                )}

                <button
                  className="btn btn-secondary"
                  onClick={() => handleDelete(s.id)}
                  disabled={actionLoading === s.id}
                >
                  {actionLoading === s.id ? "Deleting..." : "🗑️ Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {renameModal && (
        <RenameModal
          session={renameModal}
          onClose={() => setRenameModal(null)}
          onRename={handleRename}
        />
      )}

      {linkedResultState.open && (
        <LinkedElectionResultsModal
          state={linkedResultState}
          linkedYear={linkedYear}
          onYearChange={setLinkedYear}
          onClose={() =>
            setLinkedResultState({
              open: false,
              loading: false,
              data: null,
              error: "",
              sourceSession: null,
            })
          }
          onRetry={() =>
            linkedResultState.sourceSession &&
            handleViewBoothResult(linkedResultState.sourceSession, linkedYear)
          }
        />
      )}
    </div>
  );
}

function extractBoothNumber(session) {
  const raw =
    session?.booth_no ?? session?.boothNo ?? session?.booth_number ?? null;
  if (raw === null || raw === undefined || raw === "") return Number.NaN;

  if (typeof raw === "number") return Number.isFinite(raw) ? raw : Number.NaN;

  const text = String(raw).trim();
  const parsed = Number(text);
  if (Number.isFinite(parsed)) return parsed;

  const prefixMatch = text.match(/\d+/);
  if (!prefixMatch) return Number.NaN;
  const prefixNumber = Number(prefixMatch[0]);
  return Number.isFinite(prefixNumber) ? prefixNumber : Number.NaN;
}

function RenameModal({ session, onClose, onRename }) {
  const [name, setName] = useState(session.original_filename || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onRename(session.id, name.trim());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-ink-200 border border-ink-400 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-slate-100 mb-4">
          ✏️ Rename Session
        </h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-ink-100 border border-ink-400 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-400"
            placeholder="Enter new name"
            autoFocus
          />
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-ink-400 rounded-lg text-slate-300 hover:bg-ink-100 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-neon-500 text-white rounded-lg hover:bg-neon-400 transition-colors disabled:opacity-50"
              disabled={saving || !name.trim()}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function normalizeProgress(payload) {
  const processed = payload?.processed_pages ?? payload?.processed ?? 0;
  const total =
    payload?.page_count ?? payload?.total_pages ?? payload?.pages ?? 0;
  const percent = total
    ? Math.min(100, Math.round((processed / total) * 100))
    : 0;
  return { processed, total, percent };
}

function normalizeAssembly(value) {
  return (value || "").toString().trim().toLowerCase();
}

function LinkedElectionResultsModal({
  state,
  linkedYear,
  onYearChange,
  onClose,
  onRetry,
}) {
  const totalLabels = {
    evm: "EVM Votes",
    postal: "Postal Votes",
    total: "Total Votes Polled",
  };

  const sourceAssembly =
    state.data?.session?.assembly_name ||
    state.sourceSession?.assembly_name ||
    state.sourceSession?.constituency ||
    "";

  const results = state.data?.fullResults || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-ink-200 border border-ink-400 rounded-xl p-4 w-full max-w-6xl shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Linked Booth Result
            </h3>
            <p className="text-xs text-slate-400">
              Booth #
              {state.data?.session?.booth_no ||
                state.sourceSession?.booth_no ||
                "—"}
              {sourceAssembly ? ` • ${sourceAssembly}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-ink-400 rounded-lg text-slate-300 hover:bg-ink-100"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="number"
            min="1900"
            max="2100"
            value={linkedYear}
            onChange={(e) => onYearChange(e.target.value)}
            placeholder="Year filter"
            className="px-3 py-2 bg-ink-100 border border-ink-400 rounded-lg text-slate-100 placeholder:text-slate-500"
          />
          <button onClick={onRetry} className="btn btn-secondary">
            Reload Linked Result
          </button>
        </div>

        {state.loading && (
          <div className="space-y-2 animate-pulse">
            <div className="h-10 rounded bg-ink-100" />
            <div className="h-28 rounded bg-ink-100" />
            <div className="h-28 rounded bg-ink-100" />
          </div>
        )}

        {!state.loading && state.error && (
          <div className="p-3 bg-rose-900/40 text-rose-100 rounded-lg border border-rose-700 flex items-center justify-between gap-3">
            <span>{state.error}</span>
            <button
              className="btn btn-secondary text-xs py-1 px-2"
              onClick={onRetry}
            >
              Retry
            </button>
          </div>
        )}

        {!state.loading && !state.error && results.length === 0 && (
          <div className="p-3 text-slate-400 border border-ink-400/40 rounded-lg">
            No linked election result found for this voter session.
          </div>
        )}

        {!state.loading &&
          !state.error &&
          results.map((result, index) => {
            const boothResult = result.boothResult || {};
            const electionSession = result.electionSession || {};
            const assemblyMismatch =
              normalizeAssembly(sourceAssembly) &&
              normalizeAssembly(
                electionSession.constituency || electionSession.assembly_name,
              ) &&
              normalizeAssembly(sourceAssembly) !==
                normalizeAssembly(
                  electionSession.constituency || electionSession.assembly_name,
                );

            return (
              <div
                key={`${electionSession.id || "session"}-${index}`}
                className="border border-ink-400/40 rounded-lg p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm text-slate-200">
                    <strong>
                      {electionSession.constituency || "Election Session"}
                    </strong>
                    {electionSession.election_year
                      ? ` • Year ${electionSession.election_year}`
                      : ""}
                    {boothResult.booth_no
                      ? ` • Booth #${boothResult.booth_no}`
                      : ""}
                  </div>
                  <Link
                    href={`/admin/election-results/${electionSession.id}?boothNo=${encodeURIComponent(boothResult.booth_no || "")}`}
                    className="btn btn-secondary text-xs py-1 px-2"
                  >
                    Open Booth Row
                  </Link>
                </div>

                {assemblyMismatch && (
                  <div className="p-2 text-xs bg-amber-900/30 border border-amber-600/40 text-amber-100 rounded">
                    Warning: Linked result assembly differs from voter session
                    assembly.
                  </div>
                )}

                <div className="overflow-x-auto border border-ink-400/30 rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-ink-100/80 text-slate-300 text-xs">
                        <th className="px-3 py-2 text-left">Booth</th>
                        <th className="px-3 py-2 text-left">Candidate Votes</th>
                        <th className="px-3 py-2 text-left">Valid</th>
                        <th className="px-3 py-2 text-left">Rejected</th>
                        <th className="px-3 py-2 text-left">NOTA</th>
                        <th className="px-3 py-2 text-left">Total</th>
                        <th className="px-3 py-2 text-left">Tendered</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-ink-400/20">
                        <td className="px-3 py-2 text-slate-100 font-mono">
                          {boothResult.booth_no || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {Object.entries(boothResult.candidate_votes || {})
                            .map(([name, votes]) => `${name}: ${votes}`)
                            .join(" | ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {boothResult.total_valid_votes ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {boothResult.rejected_votes ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {boothResult.nota ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300 font-semibold">
                          {boothResult.total_votes ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {boothResult.tendered_votes ?? "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {Array.isArray(result.candidates) &&
                  result.candidates.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {result.candidates.map((candidate, idx) => (
                        <span
                          key={`${candidate.id || candidate.candidate_name || idx}`}
                          className="px-2 py-1 rounded bg-ink-100/40 border border-ink-400/40 text-slate-200"
                        >
                          {candidate.candidate_name}
                        </span>
                      ))}
                    </div>
                  )}

                {Array.isArray(result.totals) && result.totals.length > 0 && (
                  <div className="overflow-x-auto border border-ink-400/30 rounded">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-ink-100/80 text-slate-300">
                          <th className="px-3 py-2 text-left">Total Type</th>
                          <th className="px-3 py-2 text-left">Valid</th>
                          <th className="px-3 py-2 text-left">Rejected</th>
                          <th className="px-3 py-2 text-left">NOTA</th>
                          <th className="px-3 py-2 text-left">Total</th>
                          <th className="px-3 py-2 text-left">Tendered</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.totals.map((row) => (
                          <tr
                            key={row.total_type}
                            className="border-t border-ink-400/20 text-slate-300"
                          >
                            <td className="px-3 py-2">
                              {totalLabels[row.total_type] || row.total_type}
                            </td>
                            <td className="px-3 py-2">
                              {row.total_valid_votes ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              {row.rejected_votes ?? "—"}
                            </td>
                            <td className="px-3 py-2">{row.nota ?? "—"}</td>
                            <td className="px-3 py-2 font-semibold">
                              {row.total_votes ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              {row.tendered_votes ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
