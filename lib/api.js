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

  if (res.status === 403) {
    const err = new Error("You do not have permission to perform this action");
    err.status = 403;
    throw err;
  }

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get("content-disposition") || "";
  const fileName = extractFileName(contentDisposition);
  return { blob, fileName };
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

export function getSessions(signal) {
  return fetchWithRetry("/sessions", { method: "GET", signal });
}

export function getSession(id, signal) {
  return fetchWithRetry(`/sessions/${id}`, { method: "GET", signal });
}

export function getSessionVoters(id, query, signal) {
  const qs = new URLSearchParams(query || {}).toString();
  const suffix = qs ? `?${qs}` : "";
  return fetchWithRetry(`/sessions/${id}/voters${suffix}`, {
    method: "GET",
    signal,
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

  search: (query, signal) => {
    const qs = new URLSearchParams(query || {}).toString();
    return fetchWithRetry(`/affidavits/search${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal,
    });
  },

  exportDocx: async (id, candidateName) => {
    const token = getAuthToken();
    const url = `${API_PREFIX}/affidavits/sessions/${id}/export/docx?skipRawOcr=true`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = "Failed to download DOCX file";
      try {
        const err = await res.json();
        msg = err.error || msg;
      } catch {}
      throw new Error(msg);
    }
    const blob = await res.blob();
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
  },
};

// ==================== NOMINATION API ====================
export const nominationAPI = {
  uploadImage: (file) => {
    const form = new FormData();
    form.append("image", file);
    return fetchWithRetry("/nominations/upload-image", {
      method: "POST",
      body: form,
      retries: 0,
    });
  },

  getFormSchema: (signal) =>
    fetchWithRetry("/nominations/form-schema", { method: "GET", signal }),

  manualEntry: (data) =>
    fetchWithRetry("/nominations/manual-entry", {
      method: "POST",
      body: JSON.stringify(data),
      retries: 0,
    }),

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
    const qs = new URLSearchParams(query || {}).toString();
    return fetchWithRetry(`/nominations/search${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal,
    });
  },

  exportDocx: async (id, candidateName) => {
    const token = getAuthToken();
    const url = `${API_PREFIX}/nominations/sessions/${id}/export/docx`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = "Failed to download DOCX file";
      try {
        const err = await res.json();
        msg = err.error || msg;
      } catch {}
      throw new Error(msg);
    }
    const blob = await res.blob();
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
  },
};

export { API_BASE };
