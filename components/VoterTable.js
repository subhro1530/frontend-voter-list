import { useMemo, useState, useEffect, useCallback } from "react";
import CsvExportButton from "./CsvExportButton";

// Fields that contain translatable text
const TRANSLATABLE_FIELDS = ["name", "relation_type", "section", "assembly"];

// Simple translation function using Google Translate API (free)
async function translateText(text, targetLang = "en") {
  if (!text || text === "—") return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(
      text
    )}`;
    const res = await fetch(url);
    const data = await res.json();
    // Response format: [[["translated text","original text",...],...],...]
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0][0][0];
    }
    return text;
  } catch (err) {
    console.warn("Translation failed:", err);
    return text;
  }
}

export default function VoterTable({ voters = [], loading, error }) {
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedVoters, setTranslatedVoters] = useState([]);
  const [translating, setTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);

  useEffect(() => {
    setPage(1);
    setIsTranslated(false);
    setTranslatedVoters([]);
  }, [voters]);

  const displayVoters = isTranslated ? translatedVoters : voters;
  const pages = Math.max(1, Math.ceil(displayVoters.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayVoters.slice(start, start + pageSize);
  }, [displayVoters, page, pageSize]);

  const handleTranslate = useCallback(async () => {
    if (translating) return;

    if (isTranslated) {
      // Toggle back to original
      setIsTranslated(false);
      return;
    }

    setTranslating(true);
    setTranslationProgress(0);

    try {
      const batchSize = 5;
      const translated = [];

      for (let i = 0; i < voters.length; i += batchSize) {
        const batch = voters.slice(i, i + batchSize);
        const translatedBatch = await Promise.all(
          batch.map(async (voter) => {
            const translatedVoter = { ...voter };
            for (const field of TRANSLATABLE_FIELDS) {
              if (voter[field] && voter[field] !== "—") {
                translatedVoter[field] = await translateText(voter[field]);
              }
            }
            return translatedVoter;
          })
        );
        translated.push(...translatedBatch);
        setTranslationProgress(
          Math.round((translated.length / voters.length) * 100)
        );
      }

      setTranslatedVoters(translated);
      setIsTranslated(true);
    } catch (err) {
      console.error("Translation failed:", err);
    } finally {
      setTranslating(false);
      setTranslationProgress(0);
    }
  }, [voters, isTranslated, translating]);

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-200">
          Showing {paged.length} of {displayVoters.length} voters
          {isTranslated && (
            <span className="ml-2 text-emerald-400 font-medium">
              (Translated to English)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {/* Translate Button */}
          <button
            onClick={handleTranslate}
            disabled={translating || loading || !voters.length}
            className={`translate-btn ${
              isTranslated ? "translate-btn-active" : ""
            }`}
            title={
              isTranslated ? "Show original language" : "Translate to English"
            }
          >
            {translating ? (
              <>
                <span className="translate-spinner" />
                <span>Translating... {translationProgress}%</span>
              </>
            ) : isTranslated ? (
              <>
                <span className="text-lg">🌐</span>
                <span>Show Original</span>
              </>
            ) : (
              <>
                <span className="text-lg">🇬🇧</span>
                <span>Translate to English</span>
              </>
            )}
          </button>

          <label htmlFor="pageSize" className="text-slate-300">
            Page size
          </label>
          <select
            id="pageSize"
            className="w-24"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {[10, 25, 50, 100, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <CsvExportButton
            voters={displayVoters}
            disabled={loading || !displayVoters.length}
          />
        </div>
      </div>

      {/* Translation Progress Bar */}
      {translating && (
        <div className="translation-progress">
          <div className="translation-progress-bar">
            <div
              className="translation-progress-fill"
              style={{ width: `${translationProgress}%` }}
            />
          </div>
          <span className="translation-progress-text">
            Translating voter data... {translationProgress}%
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-900/40 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      )}
      {loading && <div className="p-3 text-slate-300">Loading voters…</div>}
      {!loading && !error && voters.length === 0 && (
        <div className="p-3 text-slate-300">
          No voters found for these filters.
        </div>
      )}

      {!loading && !error && voters.length > 0 && (
        <div className="table-scroll">
          <table className="w-full text-sm sticky-header">
            <thead className="text-left">
              <tr className="text-slate-200">
                <th className="p-2">Name</th>
                <th className="p-2">Voter ID</th>
                <th className="p-2">Gender</th>
                <th className="p-2">Age</th>
                <th className="p-2">House #</th>
                <th className="p-2">Relation</th>
                <th className="p-2">Part</th>
                <th className="p-2">Section</th>
                <th className="p-2">Assembly</th>
                <th className="p-2">Serial</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((voter) => (
                <tr
                  key={`${voter.voter_id}-${voter.serial_number}`}
                  className="border-b border-ink-400/40 hover:bg-ink-100/50"
                >
                  <td className="p-2 font-semibold text-slate-100">
                    {voter.name || "—"}
                  </td>
                  <td className="p-2 text-slate-200">
                    {voter.voter_id || "—"}
                  </td>
                  <td className="p-2 text-slate-200 capitalize">
                    {voter.gender || "—"}
                  </td>
                  <td className="p-2 text-slate-200">{voter.age ?? "—"}</td>
                  <td className="p-2 text-slate-200">
                    {voter.house_number || "—"}
                  </td>
                  <td className="p-2 text-slate-200">
                    {voter.relation_type || "—"}
                  </td>
                  <td className="p-2 text-slate-200">
                    {voter.part_number || "—"}
                  </td>
                  <td className="p-2 text-slate-200">{voter.section || "—"}</td>
                  <td className="p-2 text-slate-200">
                    {voter.assembly || "—"}
                  </td>
                  <td className="p-2 text-slate-200">
                    {voter.serial_number || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && voters.length > pageSize && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-slate-300">
            Page {page} of {pages}
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="btn btn-primary"
              disabled={page === pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
