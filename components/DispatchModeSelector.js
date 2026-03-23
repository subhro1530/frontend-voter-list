import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getDispatchMode, updateDispatchMode } from "../lib/api";
import {
  DISPATCH_MODES,
  getDispatchModeMessage,
  normalizeDispatchMode,
  readStoredDispatchMode,
  writeStoredDispatchMode,
} from "../lib/dispatchMode";

export default function DispatchModeSelector({
  value,
  onChange,
  compact = false,
}) {
  const [mode, setMode] = useState(normalizeDispatchMode(value || "auto"));
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    setMode(normalizeDispatchMode(value || "auto"));
  }, [value]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function loadMode() {
      try {
        const res = await getDispatchMode(controller.signal);
        if (!mounted) return;
        const payload = res?.data || res?.result || res;
        const serverMode = normalizeDispatchMode(
          payload?.mode ||
            payload?.dispatchMode ||
            payload?.activeMode ||
            "auto",
        );
        setMode(serverMode);
        writeStoredDispatchMode(serverMode);
        onChange?.(serverMode);
      } catch {
        if (!mounted) return;
        const storedMode = readStoredDispatchMode();
        setMode(storedMode);
        onChange?.(storedMode);
      }
    }

    loadMode();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [onChange]);

  const handleModeChange = async (nextModeRaw) => {
    const nextMode = normalizeDispatchMode(nextModeRaw);
    const previousMode = mode;

    setMode(nextMode);
    setSyncError("");
    writeStoredDispatchMode(nextMode);
    onChange?.(nextMode);

    setLoading(true);
    try {
      await updateDispatchMode(nextMode);
      toast.success("OCR mode updated.");
    } catch (err) {
      setMode(previousMode);
      writeStoredDispatchMode(previousMode);
      onChange?.(previousMode);
      setSyncError(err?.message || "Failed to sync OCR mode.");
      toast.error("Could not update OCR mode.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <label className="text-xs text-slate-300 uppercase tracking-wide">
        OCR Processing Mode
      </label>
      <select
        value={mode}
        onChange={(e) => handleModeChange(e.target.value)}
        disabled={loading}
        className="min-w-[220px]"
      >
        {DISPATCH_MODES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-300">{getDispatchModeMessage(mode)}</p>
      {syncError && <p className="text-xs text-rose-300">{syncError}</p>}
    </div>
  );
}
