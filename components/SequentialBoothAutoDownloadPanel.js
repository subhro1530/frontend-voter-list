import { useCallback, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getSessions } from "../lib/api";
import useBoothRangeZipJob, {
  NEXT_BOOTH_DELAY_MS,
  normalizeBoothRangeInput,
} from "../lib/useBoothRangeZipJob";

const SORT_VALUE = "createdAt:desc";

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

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function SequentialBoothAutoDownloadPanel() {
  const [boothRangeTouched, setBoothRangeTouched] = useState(false);

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

  const handleBoothRangeSubmit = useCallback(
    async (event) => {
      event?.preventDefault();
      setBoothRangeTouched(true);
      await startAutoDownload();
    },
    [startAutoDownload],
  );

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
  const currentBoothLabel = boothRangeState.currentBooth || "-";
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

  const headerMeta = useMemo(
    () => ({
      delayMs: NEXT_BOOTH_DELAY_MS,
      currentBooth: currentBoothLabel,
    }),
    [currentBoothLabel],
  );

  return (
    <section className="card space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">
            Sequential Booth Range Auto Download
          </h3>
          <p className="text-sm text-slate-300">
            Generates one booth PDF at a time, downloads immediately, then waits
            before next booth.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Concurrency: 1 (strict sequence). Next booth delay:{" "}
            {headerMeta.delayMs} ms.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Part No source of truth remains booth-context driven. Current booth:{" "}
            {headerMeta.currentBooth}
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
          <h4 className="text-base font-semibold text-slate-100">Queue View</h4>
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
                      {item.sessionId || "-"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-300 break-all">
                      {item.jobId || "-"}
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
                      {item.statusText || "-"}
                    </td>
                    <td className="py-2 text-rose-200 break-words">
                      {item.error || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
