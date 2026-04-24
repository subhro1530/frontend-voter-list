const rawBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const API_BASE = (() => {
  if (!rawBase || rawBase === "/") return ""; // same-origin, rely on Next rewrite
  const withProtocol = rawBase.startsWith("http")
    ? rawBase
    : `http://${rawBase}`;
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;
})();

const API_PREFIX = (API_BASE || "/api").replace(/\/$/, "");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Get auth token from localStorage
function getAuthToken() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token");
  }
  return null;
}

// Add auth headers to requests
function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseErrorResponse(res) {
  let message = `Request failed with ${res.status}`;
  let technical = "";

  try {
    const errorData = await res.json();
    message =
      errorData.message || errorData.error || errorData.details || message;
    technical = errorData.technical || "";
  } catch {
    try {
      const text = await res.text();
      if (text) {
        message = text;
        technical = text;
      }
    } catch {
      // Ignore parsing errors and keep default message.
    }
  }

  const err = new Error(message);
  err.status = res.status;
  err.technical = technical || message;
  return err;
}

function extractFileName(contentDisposition, fallback = "download.pdf") {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const simpleMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (simpleMatch?.[1]) return simpleMatch[1];
  return fallback;
}

function parseAffidavitValidationValue(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "valid", "1", "yes", "ok"].includes(normalized)) {
    return true;
  }
  if (["false", "invalid", "0", "no"].includes(normalized)) {
    return false;
  }
  return null;
}

function parseAffidavitMissingRequired(value) {
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch {
    // Fall through to CSV parsing.
  }
  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseAffidavitValidationHeaders(headers) {
  if (!headers) {
    return {
      valid: null,
      missingRequired: [],
    };
  }
  const validRaw = headers.get("x-affidavit-validation");
  const missingRaw = headers.get("x-affidavit-missing-required");
  return {
    valid: parseAffidavitValidationValue(validRaw),
    missingRequired: parseAffidavitMissingRequired(missingRaw),
  };
}

function parseNominationHeaderJson(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function parseNominationPageCount(value) {
  if (typeof value !== "string") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric);
}

function deriveNominationTemplateAuditState(templateAudit, templateMissing) {
  if (typeof templateAudit === "boolean") return templateAudit;

  if (templateAudit && typeof templateAudit === "object") {
    const candidateKeys = ["valid", "passed", "ok", "success"];
    for (const key of candidateKeys) {
      if (typeof templateAudit[key] === "boolean") {
        return templateAudit[key];
      }
    }

    if (typeof templateAudit.status === "string") {
      const normalizedStatus = templateAudit.status.trim().toLowerCase();
      if (
        ["pass", "passed", "ok", "valid", "success"].includes(normalizedStatus)
      ) {
        return true;
      }
      if (["fail", "failed", "invalid", "error"].includes(normalizedStatus)) {
        return false;
      }
    }
  }

  if (Array.isArray(templateMissing) && templateMissing.length > 0) {
    return false;
  }

  return null;
}

function parseNominationValidationHeaders(headers) {
  if (!headers) {
    return {
      valid: null,
      missingRequired: [],
      templateAudit: null,
      templateMissing: [],
      templateAuditPassed: null,
      pageCount: null,
    };
  }

  const validRaw = headers.get("x-nomination-validation");
  const missingRaw = headers.get("x-nomination-missing-required");
  const templateAuditRaw = headers.get("x-nomination-template-audit");
  const templateMissingRaw = headers.get("x-nomination-template-missing");
  const pageCountRaw = headers.get("x-nomination-page-count");

  const templateAuditJson = parseNominationHeaderJson(templateAuditRaw);
  const templateAuditValue =
    templateAuditJson ??
    parseAffidavitValidationValue(templateAuditRaw) ??
    (typeof templateAuditRaw === "string" && templateAuditRaw.trim()
      ? templateAuditRaw.trim()
      : null);

  const templateMissing = parseAffidavitMissingRequired(templateMissingRaw);

  return {
    valid: parseAffidavitValidationValue(validRaw),
    missingRequired: parseAffidavitMissingRequired(missingRaw),
    templateAudit: templateAuditValue,
    templateMissing,
    templateAuditPassed: deriveNominationTemplateAuditState(
      templateAuditValue,
      templateMissing,
    ),
    pageCount: parseNominationPageCount(pageCountRaw),
  };
}

async function fetchBlobWithAuth(path, options = {}) {
  const url = `${API_PREFIX}${path}`;
  const headers = {
    ...(options.headers || {}),
    ...(!options.skipAuth ? getAuthHeaders() : {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    const err = new Error("Session expired. Please login again.");
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get("content-disposition") || "";
  const fileName = extractFileName(contentDisposition);
  return {
    blob,
    fileName,
    headers: res.headers,
    validation: parseAffidavitValidationHeaders(res.headers),
  };
}

async function fetchBlobWithAuthFallback(paths, options = {}) {
  let lastError;
  for (const path of paths) {
    try {
      return await fetchBlobWithAuth(path, options);
    } catch (err) {
      lastError = err;
      const status = Number(err?.status || 0);
      if (status !== 404 && status !== 405) {
        throw err;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error("Endpoint not available");
}

async function fetchWithRetry(path, options = {}) {
  const { retries = 1, backoff = 400, signal, skipAuth = false } = options;
  const controller = new AbortController();
  const mergedSignal = signal || controller.signal;

  const attempt = async (count) => {
    try {
      const url = `${API_PREFIX}${path}`;
      const headers = {
        ...(options.headers || {}),
        ...(!skipAuth ? getAuthHeaders() : {}),
      };

      // Add Content-Type for JSON body if not FormData
      if (
        options.body &&
        !(options.body instanceof FormData) &&
        typeof options.body === "string"
      ) {
        headers["Content-Type"] = "application/json";
      }

      const res = await fetch(url, {
        ...options,
        headers,
        signal: mergedSignal,
      });

      // Handle auth errors
      if (res.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          window.location.href = "/login";
        }
        throw new Error("Session expired. Please login again.");
      }

      if (res.status === 403) {
        throw new Error("You do not have permission to perform this action");
      }

      if (res.status === 429) {
        throw new Error("API quota exhausted. Please try again later.");
      }

      if (!res.ok) {
        if (res.status >= 500 && count < retries) {
          await sleep(backoff);
          return attempt(count + 1);
        }
        throw await parseErrorResponse(res);
      }
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return res.json();
      }
      return res.text();
    } catch (err) {
      if (err.name === "AbortError") throw err;
      if (count < retries) {
        await sleep(backoff);
        return attempt(count + 1);
      }
      throw err;
    }
  };

  const promise = attempt(0);
  promise.cancel = () => controller.abort();
  return promise;
}

async function fetchWithFallback(paths, options = {}) {
  let lastError;
  for (const path of paths) {
    try {
      return await fetchWithRetry(path, options);
    } catch (err) {
      lastError = err;
      const status = Number(err?.status || 0);
      if (status !== 404 && status !== 405) {
        throw err;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error("Endpoint not available");
}

export function getSessions(queryOrSignal, maybeSignal) {
  let query = {};
  let signal = maybeSignal;

  const isAbortSignal =
    queryOrSignal &&
    typeof queryOrSignal === "object" &&
    typeof queryOrSignal.addEventListener === "function" &&
    typeof queryOrSignal.aborted === "boolean";

  if (isAbortSignal) {
    signal = queryOrSignal;
  } else if (queryOrSignal && typeof queryOrSignal === "object") {
    query = queryOrSignal;
  }

  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const qs = params.toString();
  return fetchWithRetry(`/sessions${qs ? `?${qs}` : ""}`, {
    method: "GET",
    signal,
  });
}

export function getSession(id, queryOrSignal, maybeSignal) {
  let query = {};
  let signal = maybeSignal;

  const isAbortSignal =
    queryOrSignal &&
    typeof queryOrSignal === "object" &&
    typeof queryOrSignal.addEventListener === "function" &&
    typeof queryOrSignal.aborted === "boolean";

  if (isAbortSignal) {
    signal = queryOrSignal;
  } else if (queryOrSignal && typeof queryOrSignal === "object") {
    query = queryOrSignal;
  }

  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";
  return fetchWithRetry(`/sessions/${id}${suffix}`, { method: "GET", signal });
}

export function getSessionNavigation(id, queryOrSignal, maybeSignal) {
  let query = {};
  let signal = maybeSignal;

  const isAbortSignal =
    queryOrSignal &&
    typeof queryOrSignal === "object" &&
    typeof queryOrSignal.addEventListener === "function" &&
    typeof queryOrSignal.aborted === "boolean";

  if (isAbortSignal) {
    signal = queryOrSignal;
  } else if (queryOrSignal && typeof queryOrSignal === "object") {
    query = queryOrSignal;
  }

  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";
  return fetchWithRetry(`/sessions/${id}/navigation${suffix}`, {
    method: "GET",
    signal,
  });
}

export function getSessionVoters(id, query, signal) {
  const qs = new URLSearchParams(query || {}).toString();
  const suffix = qs ? `?${qs}` : "";
  return fetchWithRetry(`/sessions/${id}/voters${suffix}`, {
    method: "GET",
    signal,
  });
}

export function bulkSetSessionVoterAdjudicationBySerial(
  sessionId,
  payload = {},
) {
  if (!sessionId) {
    throw new Error("Session ID is required");
  }

  const normalizeSerial = (value) => {
    const text = String(value ?? "").trim();
    if (!text || !/^\d+$/.test(text)) return "";
    const parsed = Number.parseInt(text, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return "";
    return String(parsed);
  };

  const rawSerials = Array.isArray(payload?.serialNumbers)
    ? payload.serialNumbers
    : [payload?.serialNumbers];

  const serialNumbers = Array.from(
    new Set(rawSerials.map(normalizeSerial).filter(Boolean)),
  );

  if (!serialNumbers.length) {
    const err = new Error("At least one valid serial number is required.");
    err.status = 400;
    throw err;
  }

  const partNumber = String(payload?.partNumber ?? "").trim();
  const boothNo = String(payload?.boothNo ?? "").trim();

  const body = {
    serialNumbers,
    ...(partNumber ? { partNumber } : {}),
    ...(boothNo ? { boothNo } : {}),
  };

  return fetchWithRetry(
    `/sessions/${encodeURIComponent(sessionId)}/voters/adjudication/by-serial`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
      retries: 0,
    },
  );
}

export function updateSessionVoterAdjudication(id, updates = []) {
  const normalizedUpdates = (Array.isArray(updates) ? updates : [])
    .map((item) => ({
      voterId: String(item?.voterId || "").trim(),
      underAdjudication: Boolean(item?.underAdjudication),
    }))
    .filter((item) => item.voterId);

  if (!id) {
    throw new Error("Session ID is required");
  }

  if (!normalizedUpdates.length) {
    return Promise.resolve({ updated: 0 });
  }

  const buildBulkPayload = () => {
    const updateRows = normalizedUpdates.map((item) => ({
      voterId: item.voterId,
      voter_id: item.voterId,
      id: item.voterId,
      underAdjudication: item.underAdjudication,
      under_adjudication: item.underAdjudication,
      adjudicationSource: "manual",
      adjudication_source: "manual",
    }));

    return {
      sessionId: id,
      session_id: id,
      updates: updateRows,
      voters: updateRows,
      voterUpdates: updateRows,
      voter_updates: updateRows,
    };
  };

  const isEndpointMissing = (err) => {
    const status = Number(err?.status || 0);
    return status === 404 || status === 405;
  };

  const tryCandidates = async (candidates = []) => {
    let lastError;

    for (const candidate of candidates) {
      try {
        return await fetchWithRetry(candidate.path, {
          method: candidate.method || "PATCH",
          body: JSON.stringify(candidate.body || {}),
          retries: 0,
        });
      } catch (err) {
        lastError = err;
        if (!isEndpointMissing(err)) {
          throw err;
        }
      }
    }

    if (lastError) throw lastError;
    throw new Error("No adjudication update endpoint matched");
  };

  const bulkCandidates = [
    {
      path: `/sessions/${id}/voters/adjudication`,
      method: "PATCH",
      body: buildBulkPayload(),
    },
    {
      path: `/sessions/${id}/voters/bulk`,
      method: "PATCH",
      body: buildBulkPayload(),
    },
    {
      path: `/sessions/${id}/voters`,
      method: "PATCH",
      body: buildBulkPayload(),
    },
    {
      path: `/sessions/${id}/voters/update`,
      method: "PATCH",
      body: buildBulkPayload(),
    },
    {
      path: `/sessions/${id}/voters/adjudication`,
      method: "POST",
      body: buildBulkPayload(),
    },
  ];

  const perVoterCandidates = (row) => {
    const body = {
      voterId: row.voterId,
      voter_id: row.voterId,
      underAdjudication: row.underAdjudication,
      under_adjudication: row.underAdjudication,
      adjudicationSource: "manual",
      adjudication_source: "manual",
    };

    return [
      {
        path: `/sessions/${id}/voters/${encodeURIComponent(row.voterId)}`,
        method: "PATCH",
        body,
      },
      {
        path: `/sessions/${id}/voters/${encodeURIComponent(row.voterId)}`,
        method: "PUT",
        body,
      },
      {
        path: `/user/voters/${encodeURIComponent(row.voterId)}`,
        method: "PATCH",
        body,
      },
      {
        path: `/admin/voters/${encodeURIComponent(row.voterId)}`,
        method: "PATCH",
        body,
      },
      {
        path: `/voters/${encodeURIComponent(row.voterId)}`,
        method: "PATCH",
        body,
      },
    ];
  };

  return (async () => {
    try {
      return await tryCandidates(bulkCandidates);
    } catch (bulkError) {
      if (!isEndpointMissing(bulkError)) {
        throw bulkError;
      }

      let updatedCount = 0;
      for (const row of normalizedUpdates) {
        await tryCandidates(perVoterCandidates(row));
        updatedCount += 1;
      }

      return { updated: updatedCount };
    }
  })().catch((error) => {
    if (isEndpointMissing(error)) {
      const endpointError = new Error(
        "Could not save adjudication: backend update endpoint not found (404/405).",
      );
      endpointError.status = error?.status || 404;
      throw endpointError;
    }
    throw error;
  });
}

export async function createSession(file, apiKey, dispatchMode) {
  const form = new FormData();
  form.append("file", file);
  if (apiKey) {
    form.append("apiKey", apiKey);
    // Also send geminiApiKey for backends that expect this field name
    form.append("geminiApiKey", apiKey);
  }
  if (dispatchMode) {
    const mode = String(dispatchMode);
    // Keep both keys for compatibility with evolving backend contracts.
    form.append("dispatchMode", mode);
    form.append("mode", mode);
  }
  return fetchWithRetry("/sessions", {
    method: "POST",
    body: form,
    retries: 0,
  });
}

export async function createSessionsBulk(files, options = {}) {
  const { dispatchMode, signal } = options;
  const form = new FormData();

  (files || []).forEach((file) => {
    form.append("files", file);
  });

  if (dispatchMode) {
    form.append("dispatchMode", String(dispatchMode));
  }

  const url = `${API_PREFIX}/sessions/bulk`;
  const res = await fetch(url, {
    method: "POST",
    body: form,
    headers: {
      ...getAuthHeaders(),
    },
    signal,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    const err = new Error("Session expired. Please login again.");
    err.status = 401;
    throw err;
  }

  if (res.status === 403) {
    const err = new Error("You do not have permission to perform this action");
    err.status = 403;
    throw err;
  }

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const payload = await res.json();
  return {
    ...payload,
    httpStatus: res.status,
  };
}

export async function uploadAdditionalSessionVoters(
  sessionId,
  file,
  options = {},
) {
  if (!sessionId) {
    const err = new Error("Session ID is required.");
    err.status = 400;
    throw err;
  }

  if (!file) {
    const err = new Error("Upload file is required.");
    err.status = 400;
    throw err;
  }

  const { apiKey, geminiApiKey, dispatchMode, signal } = options;
  const form = new FormData();
  form.append("file", file);

  const resolvedApiKey = String(apiKey || geminiApiKey || "").trim();
  if (resolvedApiKey) {
    form.append("apiKey", resolvedApiKey);
    form.append("geminiApiKey", resolvedApiKey);
  }

  if (dispatchMode) {
    form.append("dispatchMode", String(dispatchMode));
  }

  const url = `${API_PREFIX}/sessions/${encodeURIComponent(sessionId)}/voters/additional/upload`;
  const res = await fetch(url, {
    method: "POST",
    body: form,
    headers: {
      ...getAuthHeaders(),
    },
    signal,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    const err = new Error("Session expired. Please login again.");
    err.status = 401;
    throw err;
  }

  if (res.status === 403) {
    const err = new Error("You do not have permission to perform this action");
    err.status = 403;
    throw err;
  }

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const payload = await res.json();
  return {
    ...payload,
    httpStatus: res.status,
  };
}

export function getSessionStatus(id, signal) {
  return fetchWithRetry(`/sessions/${id}/status`, { method: "GET", signal });
}

export function deleteSession(id) {
  return fetchWithRetry(`/sessions/${id}`, { method: "DELETE", retries: 0 });
}

export function searchGlobalVoters(query, signal) {
  const qs = new URLSearchParams(query || {}).toString();
  const suffix = qs ? `?${qs}` : "";
  return fetchWithRetry(`/voters/search${suffix}`, { method: "GET", signal });
}

export function getReligionStats(sessionId, signal) {
  return fetchWithRetry(`/sessions/${sessionId}/stats/religion`, {
    method: "GET",
    signal,
  });
}

// API Key Management
export function getApiKeysStatus(signal) {
  return fetchWithRetry("/api-keys/status", { method: "GET", signal });
}

export function getApiKeysDispatchStatus(signal) {
  return fetchWithRetry("/api-keys/dispatch-status", {
    method: "GET",
    signal,
  });
}

export function getDispatchMode(signal) {
  return fetchWithRetry("/api-keys/dispatch-mode", {
    method: "GET",
    signal,
  });
}

export function updateDispatchMode(dispatchMode) {
  const mode = String(dispatchMode || "auto");
  return fetchWithRetry("/api-keys/dispatch-mode", {
    method: "PATCH",
    // Backend contract expects canonical `mode`; alias retained for compatibility.
    body: JSON.stringify({ mode, dispatchMode: mode }),
    retries: 0,
  });
}

export function resetApiKeys() {
  return fetchWithRetry("/api-keys/reset", { method: "POST", retries: 0 });
}

export function resumeSession(sessionId, dispatchMode) {
  const hasDispatchMode = Boolean(dispatchMode);
  return fetchWithRetry(`/sessions/${sessionId}/resume`, {
    method: "POST",
    ...(hasDispatchMode
      ? {
          body: JSON.stringify({
            mode: String(dispatchMode),
            dispatchMode: String(dispatchMode),
          }),
        }
      : {}),
    retries: 0,
  });
}

export function stopSession(sessionId) {
  return fetchWithRetry(`/sessions/${sessionId}/stop`, {
    method: "POST",
    retries: 0,
  });
}

export function renameSession(sessionId, name) {
  return fetchWithRetry(`/sessions/${sessionId}/rename`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
    retries: 0,
  });
}

export function patchSessionMetadata(sessionId, payload) {
  return fetchWithRetry(`/sessions/${sessionId}/metadata`, {
    method: "PATCH",
    body: JSON.stringify(payload || {}),
    retries: 0,
  });
}

// ==================== AUTH API ====================
export const authAPI = {
  register: (data) =>
    fetchWithRetry("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
      skipAuth: true,
    }),

  login: (data) =>
    fetchWithRetry("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
      skipAuth: true,
    }),

  verify: () => fetchWithRetry("/auth/verify", { method: "GET" }),

  me: () => fetchWithRetry("/auth/me", { method: "GET" }),

  updateProfile: (data) =>
    fetchWithRetry("/user/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getProfile: () => fetchWithRetry("/user/profile", { method: "GET" }),
};

// ==================== USER API ====================
export const userAPI = {
  getAssemblies: (signalOrOptions, maybeOptions = {}) => {
    const isAbortSignal =
      typeof AbortSignal !== "undefined" &&
      signalOrOptions instanceof AbortSignal;
    const options = isAbortSignal
      ? { ...maybeOptions, signal: signalOrOptions }
      : { ...(signalOrOptions || {}) };

    const params = new URLSearchParams();
    if (options.sessionId) {
      params.set("sessionId", String(options.sessionId));
    }

    const qs = params.toString();
    return fetchWithRetry(`/user/assemblies${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal: options.signal,
    });
  },

  getParts: (assembly, signalOrOptions, maybeOptions = {}) => {
    const isAbortSignal =
      typeof AbortSignal !== "undefined" &&
      signalOrOptions instanceof AbortSignal;
    const options = isAbortSignal
      ? { ...maybeOptions, signal: signalOrOptions }
      : { ...(signalOrOptions || {}) };

    const params = new URLSearchParams();
    if (options.sessionId) {
      params.set("sessionId", String(options.sessionId));
    }

    const qs = params.toString();
    return fetchWithRetry(
      `/user/assemblies/${encodeURIComponent(assembly)}/parts${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        signal: options.signal,
      },
    );
  },

  searchVoters: (query, signal) => {
    const qs = new URLSearchParams(query || {}).toString();
    return fetchWithRetry(`/user/voters/search${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal,
    });
  },

  getVoter: (id, signal) =>
    fetchWithRetry(`/user/voters/${id}`, { method: "GET", signal }),

  getVoterPrintData: (id, signal) =>
    fetchWithRetry(`/user/voters/${id}/print-data`, { method: "GET", signal }),

  markAsPrinted: (id) =>
    fetchWithRetry(`/user/voters/${id}/print`, { method: "POST", retries: 0 }),

  downloadVoterSlipById: (id, signal) =>
    fetchBlobWithAuth(`/user/voters/${id}/voterslip.pdf`, {
      method: "GET",
      signal,
    }),

  downloadVoterSlipByQueryId: (idOrVoterId, signal) =>
    fetchBlobWithAuth(
      `/user/voters/voterslip.pdf?id=${encodeURIComponent(idOrVoterId)}`,
      {
        method: "GET",
        signal,
      },
    ),

  startMassVoterSlipGeneration: (payload) =>
    fetchWithRetry("/user/voterslips/mass/start", {
      method: "POST",
      body: JSON.stringify(payload),
      retries: 0,
    }),

  startMassVoterSlipBoothRangeZip: (payload) =>
    fetchWithRetry("/user/voterslips/mass/booth-range/start", {
      method: "POST",
      body: JSON.stringify(payload),
      retries: 0,
    }),

  startMassVoterSlipForSession: async (sessionId) => {
    const normalizedSessionId = String(sessionId || "").trim();
    if (!normalizedSessionId) {
      throw new Error("Session ID is required");
    }

    try {
      return await fetchWithRetry(
        `/user/voterslips/mass/sessions/${encodeURIComponent(normalizedSessionId)}/start`,
        {
          method: "POST",
          retries: 0,
        },
      );
    } catch (error) {
      const status = Number(error?.status || 0);
      if (status !== 404 && status !== 405) {
        throw error;
      }

      return fetchWithRetry("/user/voterslips/mass/current-session/start", {
        method: "POST",
        body: JSON.stringify({ sessionId: normalizedSessionId }),
        retries: 0,
      });
    }
  },

  startSpecificVoterSlipGeneration: async ({
    partNo,
    files,
    apiKey,
    geminiApiKey,
    signal,
  } = {}) => {
    const normalizedPartNo = String(partNo || "").trim();
    if (!normalizedPartNo) {
      const err = new Error("Part No is required.");
      err.status = 400;
      throw err;
    }

    const normalizedFiles = Array.isArray(files)
      ? files.filter(Boolean)
      : files
        ? [files]
        : [];

    if (!normalizedFiles.length) {
      const err = new Error("At least one file is required.");
      err.status = 400;
      throw err;
    }

    const form = new FormData();
    form.append("partNo", normalizedPartNo);
    normalizedFiles.forEach((file) => {
      form.append("files", file);
    });

    const resolvedApiKey = String(apiKey || geminiApiKey || "").trim();
    if (resolvedApiKey) {
      form.append("apiKey", resolvedApiKey);
      form.append("geminiApiKey", resolvedApiKey);
    }

    const url = `${API_PREFIX}/user/voterslips/specific/start`;
    const res = await fetch(url, {
      method: "POST",
      body: form,
      headers: {
        ...getAuthHeaders(),
      },
      signal,
    });

    if (res.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
      const err = new Error("Session expired. Please login again.");
      err.status = 401;
      throw err;
    }

    if (res.status === 403) {
      const err = new Error(
        "You do not have permission to perform this action",
      );
      err.status = 403;
      throw err;
    }

    if (!res.ok) {
      throw await parseErrorResponse(res);
    }

    const payload = await res.json();
    return {
      ...payload,
      httpStatus: res.status,
    };
  },

  getMassVoterSlipJob: (jobId, signal) =>
    fetchWithRetry(`/user/voterslips/mass/jobs/${jobId}`, {
      method: "GET",
      signal,
      retries: 0,
    }),

  downloadMassVoterSlipJob: (jobId, signal, query = {}) => {
    const qs = new URLSearchParams(query || {}).toString();
    return fetchBlobWithAuth(
      `/user/voterslips/mass/jobs/${jobId}/download${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        signal,
      },
    );
  },
};

// ==================== ADMIN API ====================
export const adminAPI = {
  getUsers: (signal) =>
    fetchWithRetry("/admin/users", { method: "GET", signal }),

  updateUserRole: (id, role) =>
    fetchWithRetry(`/admin/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
      retries: 0,
    }),

  deleteUser: (id) =>
    fetchWithRetry(`/admin/users/${id}`, { method: "DELETE", retries: 0 }),

  registerAdmin: (data) =>
    fetchWithRetry("/auth/register/admin", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getVoters: (query, signal) => {
    const qs = new URLSearchParams(query || {}).toString();
    return fetchWithRetry(`/admin/voters${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal,
    });
  },

  getStats: (type, query, signal) => {
    const qs = new URLSearchParams(query || {}).toString();
    return fetchWithRetry(`/admin/stats/${type}${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal,
    });
  },

  getDashboardStats: (signal) =>
    fetchWithRetry("/admin/stats", { method: "GET", signal }),

  getVoterSlipLayout: (signal) =>
    fetchWithFallback(
      ["/user/voterslips/layout", "/user/voterslips/calibration"],
      { method: "GET", signal, retries: 0 },
    ),

  getVoterSlipTemplateImage: (signal) =>
    (async () => {
      const paths = [
        "/user/voterslips/layout/template.png",
        "/user/voterslips/calibration/template.png",
      ];
      let lastError;

      for (const path of paths) {
        try {
          return await fetchBlobWithAuth(path, {
            method: "GET",
            signal,
          });
        } catch (err) {
          lastError = err;
          const status = Number(err?.status || 0);
          if (status !== 404 && status !== 405) {
            throw err;
          }
        }
      }

      if (lastError) throw lastError;
      throw new Error("Template endpoint not available");
    })(),

  recalibrateVoterSlipLayout: () =>
    fetchWithFallback(
      ["/user/voterslips/layout/recalibrate", "/user/voterslips/recalibrate"],
      { method: "POST", retries: 0 },
    ),

  resetVoterSlipLayoutToDefault: () =>
    fetchWithFallback(
      ["/user/voterslips/layout/reset", "/user/voterslips/revert"],
      { method: "POST", retries: 0 },
    ),

  getVoterSlipManualProfiles: (signal) =>
    fetchWithRetry("/user/voterslips/layout/manual/profiles", {
      method: "GET",
      signal,
      retries: 0,
    }),

  saveVoterSlipManualLayout: (payload) =>
    fetchWithRetry("/user/voterslips/layout/manual", {
      method: "POST",
      body: JSON.stringify(payload),
      retries: 0,
    }),

  applyVoterSlipManualProfile: (profileId, payload = { setPreferred: true }) =>
    fetchWithRetry(
      `/user/voterslips/layout/manual/${encodeURIComponent(profileId)}/apply`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        retries: 0,
      },
    ),

  setVoterSlipLayoutMode: (preferredMode) =>
    fetchWithRetry("/user/voterslips/layout/mode", {
      method: "PATCH",
      body: JSON.stringify({ preferredMode }),
      retries: 0,
    }),

  autoLabelVoterSlipBoxes: (boxes) =>
    fetchWithRetry("/user/voterslips/layout/manual/auto-labels", {
      method: "POST",
      body: JSON.stringify({ boxes }),
      retries: 0,
    }),
};

// ==================== CHAT API ====================
export const chatAPI = {
  sendMessage: (message) =>
    fetchWithRetry("/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
      retries: 0,
    }),

  getActions: (signal) =>
    fetchWithRetry("/chat/actions", { method: "GET", signal }),
};

// ==================== SYSTEM API ====================
export const systemAPI = {
  getInfo: (signal) =>
    fetchWithRetry("/system/info", { method: "GET", signal }),
};

// ==================== AGENT API ====================
export const agentAPI = {
  // Main query endpoint - process natural language queries
  query: (message, isConfirmation = false) =>
    fetchWithRetry("/agent/query", {
      method: "POST",
      body: JSON.stringify({ message, isConfirmation }),
      retries: 0,
    }),

  // Confirm or cancel pending query
  confirm: (confirm) =>
    fetchWithRetry("/agent/confirm", {
      method: "POST",
      body: JSON.stringify({ confirm }),
      retries: 0,
    }),

  // Get agent status and capabilities
  getStatus: (signal) =>
    fetchWithRetry("/agent/status", { method: "GET", signal }),

  // Get role-appropriate query suggestions
  getSuggestions: (signal) =>
    fetchWithRetry("/agent/suggestions", { method: "GET", signal }),

  // Get comprehensive help
  getHelp: (signal) => fetchWithRetry("/agent/help", { method: "GET", signal }),

  // Get categorized query templates
  getTemplates: (signal) =>
    fetchWithRetry("/agent/templates", { method: "GET", signal }),

  // Execute predefined quick query
  quickQuery: (queryType, signal) =>
    fetchWithRetry(`/agent/quick/${queryType}`, { method: "GET", signal }),
};

// ==================== ELECTION RESULTS API ====================
export const electionResultsAPI = {
  upload: (file) => {
    const form = new FormData();
    form.append("file", file);
    return fetchWithRetry("/election-results/upload", {
      method: "POST",
      body: form,
      retries: 0,
    });
  },

  getSessions: (query = {}, signal) => {
    const params = new URLSearchParams();
    if (query.assembly) params.set("assembly", query.assembly);
    if (query.year) params.set("year", String(query.year));
    if (query.boothNo) params.set("boothNo", String(query.boothNo));
    const qs = params.toString();
    return fetchWithRetry(`/election-results/sessions${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal,
    });
  },

  getSession: (id, signal) =>
    fetchWithRetry(`/election-results/sessions/${id}`, {
      method: "GET",
      signal,
    }),

  getSessionBoothVoterList: (id, boothNo, signal) =>
    fetchWithRetry(
      `/election-results/sessions/${id}/booths/${encodeURIComponent(boothNo)}/voter-list`,
      {
        method: "GET",
        signal,
      },
    ),

  getLinkedElectionResultsFromVoterSession: (sessionId, year, signal) => {
    const qs = year ? `?year=${encodeURIComponent(year)}` : "";
    return fetchWithRetry(
      `/sessions/${sessionId}/linked-election-results${qs}`,
      {
        method: "GET",
        signal,
      },
    );
  },

  deleteSession: (id) =>
    fetchWithRetry(`/election-results/sessions/${id}`, {
      method: "DELETE",
      retries: 0,
    }),

  getStats: (id, signal) =>
    fetchWithRetry(`/election-results/sessions/${id}/stats`, {
      method: "GET",
      signal,
    }),

  renameSession: (id, name) =>
    fetchWithRetry(`/election-results/sessions/${id}/rename`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
      retries: 0,
    }),

  repairMissingPages: (id) =>
    fetchWithRetry(`/election-results/sessions/${id}/repair-missing-pages`, {
      method: "POST",
      retries: 0,
    }),

  exportExcel: async (id) => {
    const token = getAuthToken();
    const params = new URLSearchParams({
      sortBy: "boothNo",
      sortOrder: "asc",
    });
    const url = `${API_PREFIX}/election-results/sessions/${id}/export/excel?${params.toString()}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error("Failed to download Excel file");
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `election_result_${id}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(blobUrl);
  },
};

// ==================== AFFIDAVIT API ====================
export const affidavitAPI = {
  uploadImage: (file) => {
    const form = new FormData();
    form.append("image", file);
    return fetchWithRetry("/affidavits/upload-image", {
      method: "POST",
      body: form,
      retries: 0,
    });
  },

  upload: (file) => {
    const form = new FormData();
    form.append("file", file);
    return fetchWithRetry("/affidavits/upload", {
      method: "POST",
      body: form,
      retries: 0,
    });
  },

  getSessions: (signal) =>
    fetchWithRetry("/affidavits/sessions", { method: "GET", signal }),

  getSession: (id, signal) =>
    fetchWithRetry(`/affidavits/sessions/${id}`, { method: "GET", signal }),

  getSessionStatus: (id, signal) =>
    fetchWithRetry(`/affidavits/sessions/${id}/status`, {
      method: "GET",
      signal,
    }),

  getEntries: (id, category, signal) => {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    return fetchWithRetry(`/affidavits/sessions/${id}/entries${qs}`, {
      method: "GET",
      signal,
    });
  },

  deleteSession: (id) =>
    fetchWithRetry(`/affidavits/sessions/${id}`, {
      method: "DELETE",
      retries: 0,
    }),

  renameSession: (id, name) =>
    fetchWithRetry(`/affidavits/sessions/${id}/rename`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
      retries: 0,
    }),

  stopSession: (id) =>
    fetchWithRetry(`/affidavits/sessions/${id}/stop`, {
      method: "POST",
      retries: 0,
    }),

  getFormSchema: (signal) =>
    fetchWithRetry("/affidavits/form-schema", { method: "GET", signal }),

  manualEntry: (data) =>
    fetchWithRetry("/affidavits/manual-entry", {
      method: "POST",
      body: JSON.stringify(data),
      retries: 0,
    }),

  getSessionValidation: (id, optionsOrSignal, maybeSignal) => {
    let includeTemplateAudit = false;
    let signal = maybeSignal;

    const isAbortSignal =
      optionsOrSignal &&
      typeof optionsOrSignal === "object" &&
      typeof optionsOrSignal.addEventListener === "function" &&
      typeof optionsOrSignal.aborted === "boolean";

    if (isAbortSignal) {
      signal = optionsOrSignal;
    } else if (typeof optionsOrSignal === "boolean") {
      includeTemplateAudit = optionsOrSignal;
    } else if (optionsOrSignal && typeof optionsOrSignal === "object") {
      includeTemplateAudit = Boolean(optionsOrSignal.includeTemplateAudit);
      signal = optionsOrSignal.signal || maybeSignal;
    }

    const qs = includeTemplateAudit ? "?includeTemplateAudit=true" : "";
    return fetchWithRetry(`/affidavits/sessions/${id}/validation${qs}`, {
      method: "GET",
      signal,
      retries: 0,
    });
  },

  previewDocxFromPayloadDetailed: async (data, options = {}) => {
    const preferAlias = Boolean(options.preferAlias);
    const paths = preferAlias
      ? ["/affidavits/preview/docx", "/affidavits/manual-entry/preview/docx"]
      : ["/affidavits/manual-entry/preview/docx", "/affidavits/preview/docx"];

    const { blob, fileName, validation } = await fetchBlobWithAuthFallback(
      paths,
      {
        method: "POST",
        body: JSON.stringify(data),
        signal: options.signal,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return {
      blob,
      fileName,
      validation,
    };
  },

  previewDocxFromPayload: async (data, options = {}) => {
    const { blob } = await affidavitAPI.previewDocxFromPayloadDetailed(
      data,
      options,
    );
    return blob;
  },

  previewDocxFromSessionDetailed: async (id, options = {}) => {
    const paths = [
      `/affidavits/sessions/${id}/preview/docx`,
      `/affidavits/manual-entry/preview/docx?sessionId=${encodeURIComponent(id)}`,
    ];
    const { blob, fileName, validation } = await fetchBlobWithAuthFallback(
      paths,
      {
        method: "GET",
        signal: options.signal,
      },
    );

    return {
      blob,
      fileName,
      validation,
    };
  },

  previewDocxFromSession: async (id, options = {}) => {
    const { blob } = await affidavitAPI.previewDocxFromSessionDetailed(
      id,
      options,
    );
    return blob;
  },

  search: (query, signal) => {
    const qs = new URLSearchParams(query || {}).toString();
    return fetchWithRetry(`/affidavits/search${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal,
    });
  },

  exportDocx: async (id, candidateName, options = {}) => {
    const { blob, validation } = await fetchBlobWithAuth(
      `/affidavits/sessions/${id}/export/docx`,
      {
        method: "GET",
        signal: options.signal,
      },
    );
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = candidateName
      ? `Affidavit_${candidateName.replace(/[^a-zA-Z0-9]/g, "_")}.docx`
      : `Affidavit_${id.slice(0, 8)}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return {
      validation,
    };
  },
};

// ==================== NOMINATION API ====================
/**
 * @typedef {Object} NominationManualEntryResponse
 * @property {string} sessionId
 * @property {string} [status]
 * @property {string} [message]
 * @property {string} [exportUrl]
 * @property {string} [previewUrl]
 * @property {string} [validationUrl]
 * @property {Record<string, any>} [dbAudit]
 */

/**
 * @typedef {Object} NominationUploadImageResponse
 * @property {string} url
 * @property {string} [publicId]
 * @property {"photo"|"signature"} [type]
 */

/**
 * @typedef {Object} NominationDocxDiagnostics
 * @property {boolean|null} valid
 * @property {string[]} missingRequired
 * @property {unknown} templateAudit
 * @property {string[]} templateMissing
 * @property {boolean|null} templateAuditPassed
 * @property {number|null} pageCount
 */

function resolveNominationAuditAndSignal(optionsOrSignal, maybeSignal) {
  let includeTemplateAudit = false;
  let signal = maybeSignal;

  const isAbortSignal =
    optionsOrSignal &&
    typeof optionsOrSignal === "object" &&
    typeof optionsOrSignal.addEventListener === "function" &&
    typeof optionsOrSignal.aborted === "boolean";

  if (isAbortSignal) {
    signal = optionsOrSignal;
  } else if (typeof optionsOrSignal === "boolean") {
    includeTemplateAudit = optionsOrSignal;
  } else if (optionsOrSignal && typeof optionsOrSignal === "object") {
    includeTemplateAudit = Boolean(optionsOrSignal.includeTemplateAudit);
    signal = optionsOrSignal.signal || maybeSignal;
  }

  return {
    includeTemplateAudit,
    signal,
  };
}

function withNominationQuery(path, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function fetchNominationDocx(paths, options = {}) {
  const { blob, fileName, headers } = await fetchBlobWithAuthFallback(
    paths,
    options,
  );
  const diagnostics = parseNominationValidationHeaders(headers);
  return {
    blob,
    fileName,
    headers,
    diagnostics,
    toArrayBuffer: () => blob.arrayBuffer(),
  };
}

export const nominationAPI = {
  /**
   * @param {File} file
   * @param {"photo"|"signature"} type
   * @returns {Promise<NominationUploadImageResponse>}
   */
  uploadImage: (file, type = "photo") => {
    const form = new FormData();
    form.append("image", file);
    form.append("type", type);
    return fetchWithRetry("/nominations/upload-image", {
      method: "POST",
      body: form,
      retries: 0,
    });
  },

  getFormSchema: (signal) =>
    fetchWithRetry("/nominations/form-schema", { method: "GET", signal }),

  /**
   * @param {Record<string, any>} data
   * @param {AbortSignal} [signal]
   * @returns {Promise<NominationManualEntryResponse>}
   */
  manualEntry: (data, signal) =>
    fetchWithRetry("/nominations/manual-entry", {
      method: "POST",
      body: JSON.stringify(data),
      signal,
      retries: 0,
    }),

  getSessionValidation: (id, optionsOrSignal, maybeSignal) => {
    const { includeTemplateAudit, signal } = resolveNominationAuditAndSignal(
      optionsOrSignal,
      maybeSignal,
    );
    const path = withNominationQuery(`/nominations/sessions/${id}/validation`, {
      includeTemplateAudit,
    });
    return fetchWithRetry(path, {
      method: "GET",
      signal,
      retries: 0,
    });
  },

  getPreviewMetadata: (id, optionsOrSignal, maybeSignal) => {
    const { includeTemplateAudit, signal } = resolveNominationAuditAndSignal(
      optionsOrSignal,
      maybeSignal,
    );
    const path = withNominationQuery(
      `/nominations/sessions/${id}/preview/metadata`,
      {
        includeTemplateAudit,
      },
    );
    return fetchWithRetry(path, {
      method: "GET",
      signal,
      retries: 0,
    });
  },

  getSessions: (signal) =>
    fetchWithRetry("/nominations/sessions", { method: "GET", signal }),

  getSession: (id, signal) =>
    fetchWithRetry(`/nominations/sessions/${id}`, { method: "GET", signal }),

  deleteSession: (id) =>
    fetchWithRetry(`/nominations/sessions/${id}`, {
      method: "DELETE",
      retries: 0,
    }),

  renameSession: (id, name) =>
    fetchWithRetry(`/nominations/sessions/${id}/rename`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
      retries: 0,
    }),

  search: (query, signal) => {
    const params = new URLSearchParams();
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      params.set(key, String(value));
    });
    const qs = params.toString();
    return fetchWithRetry(`/nominations/search${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal,
    });
  },

  previewDocxFromPayloadDetailed: async (data, options = {}) => {
    const path = "/nominations/manual-entry/preview/docx";
    const result = await fetchNominationDocx([path], {
      method: "POST",
      body: JSON.stringify(data),
      signal: options.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });
    return result;
  },

  previewDocxFromPayload: async (data, options = {}) => {
    const { blob } = await nominationAPI.previewDocxFromPayloadDetailed(
      data,
      options,
    );
    return blob;
  },

  previewDocxFromPayloadArrayBuffer: async (data, options = {}) => {
    const { toArrayBuffer } =
      await nominationAPI.previewDocxFromPayloadDetailed(data, options);
    return toArrayBuffer();
  },

  previewDocxFromSessionDetailed: async (id, options = {}) => {
    const paths = [
      `/nominations/sessions/${id}/preview/docx`,
      `/nominations/manual-entry/preview/docx?sessionId=${encodeURIComponent(id)}`,
    ];
    return fetchNominationDocx(paths, {
      method: "GET",
      signal: options.signal,
    });
  },

  previewDocxFromSession: async (id, options = {}) => {
    const { blob } = await nominationAPI.previewDocxFromSessionDetailed(
      id,
      options,
    );
    return blob;
  },

  previewDocxFromSessionArrayBuffer: async (id, options = {}) => {
    const { toArrayBuffer } =
      await nominationAPI.previewDocxFromSessionDetailed(id, options);
    return toArrayBuffer();
  },

  exportDocxBlob: (id, options = {}) => {
    const path = withNominationQuery(
      `/nominations/sessions/${id}/export/docx`,
      {
        strictTemplateAudit: options.strictTemplateAudit,
      },
    );
    return fetchNominationDocx([path], {
      method: "GET",
      signal: options.signal,
    });
  },

  exportDocxArrayBuffer: async (id, options = {}) => {
    const { toArrayBuffer } = await nominationAPI.exportDocxBlob(id, options);
    return toArrayBuffer();
  },

  exportDocx: async (id, candidateName, options = {}) => {
    const { blob, diagnostics } = await nominationAPI.exportDocxBlob(
      id,
      options,
    );
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = candidateName
      ? `Nomination_${candidateName.replace(/[^a-zA-Z0-9]/g, "_")}.docx`
      : `Nomination_${id.slice(0, 8)}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
    return {
      sessionId: id,
      diagnostics,
    };
  },
};

export { API_BASE };
