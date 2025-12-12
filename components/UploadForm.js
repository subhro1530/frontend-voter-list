import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createSession } from "../lib/api";

export default function UploadForm({ onCreated }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState("");

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("geminiApiKey") : "";
    if (stored) setApiKey(stored);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (apiKey) localStorage.setItem("geminiApiKey", apiKey);
      else localStorage.removeItem("geminiApiKey");
    }
  }, [apiKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Please choose a PDF file.");
    setError("");
    setLoading(true);
    setCreatedId("");
    try {
      const res = await createSession(file, apiKey.trim());
      const id = res.sessionId || res.session_id || res.id;
      setCreatedId(id);
      onCreated?.(id);
    } catch (err) {
      setError(err.message || "Failed to upload.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="upload" className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Upload PDF</h3>
          <p className="text-sm text-slate-600">
            We will post to POST /sessions and return a session id. Add your
            Gemini key if the backend expects it.
          </p>
        </div>
        <span className="badge bg-teal-50 border-teal-200 text-teal-700">
          POST /sessions
        </span>
      </div>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="file">PDF File</label>
          <input
            id="file"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="apiKey">Gemini API Key (apiKey / geminiApiKey)</label>
          <input
            id="apiKey"
            type="text"
            placeholder="Optional if backend has it"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={loading}
          />
        </div>
        {error && (
          <div className="p-3 bg-rose-50 text-rose-800 rounded-lg border border-rose-200">
            {error}
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Uploading…" : "Upload & Create Session"}
        </button>
      </form>
      {loading && (
        <p className="text-sm text-slate-600">
          Processing… this can take a moment.
        </p>
      )}
      {createdId && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 space-y-2">
          <div className="font-semibold">Session created</div>
          <div className="text-sm break-all">ID: {createdId}</div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              onClick={() => router.push(`/sessions/${createdId}`)}
            >
              Open session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
