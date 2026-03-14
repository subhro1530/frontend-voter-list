const rawBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const API_BASE = (() => {
  if (!rawBase || rawBase === "/") return "";
  const withProtocol = rawBase.startsWith("http")
    ? rawBase
    : `http://${rawBase}`;
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;
})();

const API_PREFIX = (API_BASE || "/api").replace(/\/$/, "");
const BOOTH_SESSION_STORAGE_KEY_PREFIX = "booth-selection";

function normalizeBooth(boothNo) {
  return String(boothNo ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function getBoothVoterSessionStorageKey(
  electionResultSessionId,
  boothNo,
) {
  return `${BOOTH_SESSION_STORAGE_KEY_PREFIX}:${String(electionResultSessionId)}:${normalizeBooth(boothNo)}`;
}

function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function getRememberedBoothVoterSessionId(electionResultSessionId, boothNo) {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem(
      getBoothVoterSessionStorageKey(electionResultSessionId, boothNo),
    ) || ""
  );
}

function setRememberedBoothVoterSessionId(
  electionResultSessionId,
  boothNo,
  voterSessionId,
) {
  if (typeof window === "undefined") return;

  const key = getBoothVoterSessionStorageKey(electionResultSessionId, boothNo);
  if (voterSessionId) {
    localStorage.setItem(key, String(voterSessionId));
    return;
  }

  localStorage.removeItem(key);
}

async function parseResponseOrThrow(res) {
  const contentType = res.headers.get("content-type") || "";

  if (res.ok) {
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return res.text();
  }

  let message = `Request failed with ${res.status}`;
  try {
    if (contentType.includes("application/json")) {
      const errorData = await res.json();
      message =
        errorData.message || errorData.error || errorData.details || message;
    } else {
      const text = await res.text();
      if (text) message = text;
    }
  } catch {
    // Keep fallback message when response body parsing fails.
  }

  const error = new Error(message);
  error.status = res.status;
  throw error;
}

async function fetchBoothVoters({
  electionResultSessionId,
  boothNo,
  voterSessionId,
  limit = 200,
  signal,
}) {
  const token = getAuthToken();
  const normalizedBooth = normalizeBooth(boothNo);

  const baseParams = new URLSearchParams();
  if (limit) {
    baseParams.set("limit", String(limit));
  }
  if (voterSessionId) {
    baseParams.set("voterSessionId", String(voterSessionId));
  }

  const pathQuery = baseParams.toString();
  const pathUrl = `${API_PREFIX}/election-results/sessions/${encodeURIComponent(String(electionResultSessionId))}/booths/${encodeURIComponent(normalizedBooth)}/voter-list${pathQuery ? `?${pathQuery}` : ""}`;

  const slashSafeParams = new URLSearchParams(baseParams);
  slashSafeParams.set("boothNo", normalizedBooth);
  const slashSafeUrl = `${API_PREFIX}/election-results/sessions/${encodeURIComponent(String(electionResultSessionId))}/booths/voter-list?${slashSafeParams.toString()}`;

  const request = async (url) => {
    const res = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
      signal,
    });
    return parseResponseOrThrow(res);
  };

  const prefersSlashSafe = normalizedBooth.includes("/");
  const firstUrl = prefersSlashSafe ? slashSafeUrl : pathUrl;
  const secondUrl = prefersSlashSafe ? pathUrl : slashSafeUrl;

  try {
    return await request(firstUrl);
  } catch (error) {
    const shouldTryAlternative =
      error?.status === 404 || error?.status === 405 || error?.status === 501;

    if (!shouldTryAlternative) {
      throw error;
    }

    return request(secondUrl);
  }
}

function resolveSelectedVoterSessionId(payload, fallback) {
  return (
    payload?.selectedSession?.id ||
    payload?.selectedSession?.sessionId ||
    payload?.selectedVoterSessionId ||
    fallback ||
    ""
  );
}

export async function openBoothVoters({
  electionResultSessionId,
  boothNo,
  voterSessionId,
  limit = 200,
  signal,
}) {
  const preferredVoterSessionId =
    voterSessionId ||
    getRememberedBoothVoterSessionId(electionResultSessionId, boothNo);

  try {
    const payload = await fetchBoothVoters({
      electionResultSessionId,
      boothNo,
      voterSessionId: preferredVoterSessionId,
      limit,
      signal,
    });

    const resolvedSelectedId = resolveSelectedVoterSessionId(
      payload,
      preferredVoterSessionId,
    );
    setRememberedBoothVoterSessionId(
      electionResultSessionId,
      boothNo,
      resolvedSelectedId,
    );

    return {
      ...payload,
      _meta: {
        usedRememberedVoterSessionId: Boolean(preferredVoterSessionId),
        retriedWithoutVoterSessionId: false,
      },
    };
  } catch (error) {
    const shouldRetryWithoutSession =
      error?.status === 400 && Boolean(preferredVoterSessionId);

    if (!shouldRetryWithoutSession) {
      throw error;
    }

    const payload = await fetchBoothVoters({
      electionResultSessionId,
      boothNo,
      limit,
      signal,
    });

    const resolvedSelectedId = resolveSelectedVoterSessionId(payload, "");
    setRememberedBoothVoterSessionId(
      electionResultSessionId,
      boothNo,
      resolvedSelectedId,
    );

    return {
      ...payload,
      _meta: {
        usedRememberedVoterSessionId: true,
        retriedWithoutVoterSessionId: true,
      },
    };
  }
}

export async function switchBoothVoterSession({
  electionResultSessionId,
  boothNo,
  voterSessionId,
  limit = 200,
  signal,
}) {
  setRememberedBoothVoterSessionId(
    electionResultSessionId,
    boothNo,
    voterSessionId,
  );

  return openBoothVoters({
    electionResultSessionId,
    boothNo,
    voterSessionId,
    limit,
    signal,
  });
}
