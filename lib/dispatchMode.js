export const DISPATCH_MODES = [
  { value: "paid-only", label: "Turbo (paid-only)" },
  { value: "auto", label: "Balanced (auto)" },
  { value: "free-only", label: "Cost Save (free-only)" },
];

export const DISPATCH_MODE_STORAGE_KEY = "ocr-dispatch-mode";

export function normalizeDispatchMode(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();

  if (
    normalized === "paid-only" ||
    normalized === "paid_only" ||
    normalized === "turbo"
  ) {
    return "paid-only";
  }

  if (
    normalized === "free-only" ||
    normalized === "free_only" ||
    normalized === "cost-save" ||
    normalized === "cost_save"
  ) {
    return "free-only";
  }

  return "auto";
}

export function getDispatchModeMessage(mode) {
  const normalized = normalizeDispatchMode(mode);
  if (normalized === "paid-only") {
    return "Turbo mode active: paid pool prioritized for speed.";
  }
  if (normalized === "free-only") {
    return "Cost Save mode active: free pool only.";
  }
  return "Balanced mode active: free first, paid fallback.";
}

export function readStoredDispatchMode() {
  if (typeof window === "undefined") return "auto";
  return normalizeDispatchMode(
    localStorage.getItem(DISPATCH_MODE_STORAGE_KEY) || "auto",
  );
}

export function writeStoredDispatchMode(mode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    DISPATCH_MODE_STORAGE_KEY,
    normalizeDispatchMode(mode || "auto"),
  );
}
