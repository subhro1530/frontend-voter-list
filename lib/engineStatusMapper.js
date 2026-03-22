/**
 * @typedef {import("./engineStatus.types").ApiKeysStatusResponse} ApiKeysStatusResponse
 * @typedef {import("./engineStatus.types").DispatchTier} DispatchTier
 */

const DEFAULT_POOL = Object.freeze({
  total: 0,
  active: 0,
  rateLimited: 0,
  exhausted: 0,
  busy: 0,
  available: 0,
});

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeEngineStatusValue(value) {
  const normalized = String(value || "").toLowerCase();
  if (
    normalized === "active" ||
    normalized === "ready" ||
    normalized === "idle"
  ) {
    return "active";
  }
  if (normalized === "rate_limited" || normalized === "ratelimited") {
    return "rate_limited";
  }
  if (normalized === "exhausted") {
    return "exhausted";
  }
  return "unknown";
}

function normalizeDispatchTier(value) {
  const normalized = String(value || "").toLowerCase();
  return normalized === "paid" ? "paid" : "free";
}

function normalizePool(pool) {
  if (!pool || typeof pool !== "object") return { ...DEFAULT_POOL };
  return {
    total: toNumber(pool.total),
    active: toNumber(pool.active),
    rateLimited: toNumber(pool.rateLimited ?? pool.rate_limited),
    exhausted: toNumber(pool.exhausted),
    busy: toNumber(pool.busy),
    available: toNumber(pool.available),
  };
}

/**
 * Normalizes API key engine status payloads from backend variants.
 * @param {any} payload
 * @returns {ApiKeysStatusResponse}
 */
export function normalizeApiKeysStatus(payload) {
  const rawEngines = Array.isArray(payload?.engines)
    ? payload.engines
    : Array.isArray(payload?.keys)
      ? payload.keys
      : Array.isArray(payload?.apiKeys)
        ? payload.apiKeys
        : [];

  const engines = rawEngines.map((engine, index) => ({
    engineId: String(
      engine?.engineId ?? engine?.id ?? engine?.keyIndex ?? index + 1,
    ),
    tier: normalizeDispatchTier(engine?.tier),
    status: normalizeEngineStatusValue(engine?.status),
    busy: Boolean(engine?.busy),
    keyPreview: String(engine?.keyPreview || engine?.preview || ""),
    metrics: {
      totalRequests: toNumber(
        engine?.metrics?.totalRequests ??
          engine?.requestCount ??
          engine?.requests,
      ),
      successCount: toNumber(
        engine?.metrics?.successCount ?? engine?.successCount,
      ),
    },
  }));

  const poolFree = normalizePool(payload?.pools?.free);
  const poolPaid = normalizePool(payload?.pools?.paid);

  const inferredActive = engines.filter(
    (engine) => engine.status === "active",
  ).length;
  const inferredRateLimited = engines.filter(
    (engine) => engine.status === "rate_limited",
  ).length;
  const inferredExhausted = engines.filter(
    (engine) => engine.status === "exhausted",
  ).length;
  const inferredBusy = engines.filter((engine) => engine.busy).length;
  const inferredAvailable = engines.filter(
    (engine) => engine.status === "active" && !engine.busy,
  ).length;

  return {
    totalEngines: toNumber(
      payload?.totalEngines ??
        payload?.totalKeys ??
        payload?.total ??
        engines.length,
    ),
    activeEngines: toNumber(
      payload?.activeEngines ??
        payload?.activeKeys ??
        payload?.active ??
        inferredActive,
    ),
    rateLimitedEngines: toNumber(
      payload?.rateLimitedEngines ??
        payload?.rateLimitedKeys ??
        payload?.rateLimited ??
        inferredRateLimited,
    ),
    exhaustedEngines: toNumber(
      payload?.exhaustedEngines ??
        payload?.exhaustedKeys ??
        payload?.exhausted ??
        inferredExhausted,
    ),
    busyEngines: toNumber(
      payload?.busyEngines ??
        payload?.busyKeys ??
        payload?.busy ??
        inferredBusy,
    ),
    availableEngines: toNumber(
      payload?.availableEngines ??
        payload?.availableKeys ??
        payload?.available ??
        inferredAvailable,
    ),
    activeDispatchTier: normalizeDispatchTier(
      payload?.activeDispatchTier ?? payload?.dispatchTier,
    ),
    pools: {
      free: poolFree,
      paid: poolPaid,
    },
    engines,
  };
}

/**
 * @param {any} payload
 * @returns {DispatchTier | undefined}
 */
export function extractDispatchTier(payload) {
  const direct = payload?.activeDispatchTier ?? payload?.dispatchTier;
  if (direct) return normalizeDispatchTier(direct);
  return undefined;
}

/**
 * @param {string | undefined | null} statusText
 */
export function isTerminalSessionStatus(statusText) {
  const normalized = String(statusText || "").toLowerCase();
  return normalized.includes("complete") || normalized.includes("fail");
}

/**
 * @param {string | undefined | null} statusText
 */
export function isProcessingSessionStatus(statusText) {
  const normalized = String(statusText || "").toLowerCase();
  return (
    normalized.includes("process") ||
    normalized.includes("pending") ||
    normalized.includes("upload") ||
    normalized.includes("resume") ||
    normalized.includes("running")
  );
}

/**
 * @param {any} payload
 * @returns {number | null}
 */
export function extractAutomaticRetryRounds(payload) {
  const rounds = payload?.automaticRetryRounds;
  if (rounds === undefined || rounds === null) return null;
  const parsed = toNumber(rounds);
  return parsed > 0 ? parsed : 0;
}

/**
 * @param {number | null | undefined} rounds
 */
export function formatAutomaticRetryRounds(rounds) {
  if (rounds === null || rounds === undefined) return "";
  return `Automatic retry rounds: ${rounds}`;
}
