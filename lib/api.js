const rawBase = process.env.NEXT_PUBLIC_API_BASE;
const API_BASE = (() => {
  if (!rawBase || rawBase === "/") return ""; // same-origin, rely on Next rewrite
  const withProtocol = rawBase.startsWith("http")
    ? rawBase
    : `http://${rawBase}`;
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;
})();

const API_PREFIX = (API_BASE || "/api").replace(/\/$/, "");

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function fetchWithRetry(path, options = {}) {
  const { retries = 1, backoff = 400, signal } = options;
  const controller = new AbortController();
  const mergedSignal = signal || controller.signal;

  const attempt = async (count) => {
    try {
      const url = `${API_PREFIX}${path}`;
      const res = await fetch(url, {
        ...options,
        signal: mergedSignal,
      });
      if (!res.ok) {
        if (res.status >= 500 && count < retries) {
          await sleep(backoff);
          return attempt(count + 1);
        }
        const text = await res.text();
        throw new Error(text || `Request failed with ${res.status}`);
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

export { API_BASE };
