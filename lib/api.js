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
        let errorMessage;
        try {
          const errorData = await res.json();
          errorMessage =
            errorData.message ||
            errorData.error ||
            `Request failed with ${res.status}`;
        } catch {
          const text = await res.text();
          errorMessage = text || `Request failed with ${res.status}`;
        }
        throw new Error(errorMessage);
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

export async function createSession(file, apiKey) {
  const form = new FormData();
  form.append("file", file);
  if (apiKey) {
    form.append("apiKey", apiKey);
    // Also send geminiApiKey for backends that expect this field name
    form.append("geminiApiKey", apiKey);
  }
  return fetchWithRetry("/sessions", {
    method: "POST",
    body: form,
    retries: 0,
  });
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

export function resetApiKeys() {
  return fetchWithRetry("/api-keys/reset", { method: "POST", retries: 0 });
}

export function resumeSession(sessionId) {
  return fetchWithRetry(`/sessions/${sessionId}/resume`, {
    method: "POST",
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
  getAssemblies: (signal) =>
    fetchWithRetry("/user/assemblies", { method: "GET", signal }),

  getParts: (assembly, signal) =>
    fetchWithRetry(`/user/assemblies/${encodeURIComponent(assembly)}/parts`, {
      method: "GET",
      signal,
    }),

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
};

export { API_BASE };
