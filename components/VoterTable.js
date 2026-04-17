import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import CsvExportButton from "./CsvExportButton";
import { VoterImage } from "./VoterSlip";
import toast from "react-hot-toast";

// Fields that contain translatable text
const TRANSLATABLE_FIELDS = ["name", "relation_type", "section", "assembly"];

// Simple translation function using Google Translate API (free)
async function translateText(text, targetLang = "en") {
  if (!text || text === "—") return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(
      text,
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

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "y"].includes(normalized);
  }
  return false;
}

function getAdjudicationValue(voter) {
  return normalizeBoolean(
    voter?.underAdjudication ??
      voter?.under_adjudication ??
      voter?.isUnderAdjudication ??
      voter?.is_under_adjudication,
  );
}

function buildAdjudicationSnapshot(voterList = [], getVoterKey) {
  const snapshot = {};
  voterList.forEach((voter, index) => {
    snapshot[getVoterKey(voter, index)] = getAdjudicationValue(voter);
  });
  return snapshot;
}

export default function VoterTable({
  voters = [],
  loading,
  error,
  pagination,
  onPageChange,
  onLimitChange,
  onRetry,
  onSaveAdjudicationChanges,
}) {
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedVoters, setTranslatedVoters] = useState([]);
  const [translating, setTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [adjudicationSort, setAdjudicationSort] = useState("none");
  const [isEditMode, setIsEditMode] = useState(false);
  const [savingAdjudication, setSavingAdjudication] = useState(false);
  const [savedAdjudication, setSavedAdjudication] = useState({});
  const [draftAdjudication, setDraftAdjudication] = useState({});

  useEffect(() => {
    setPage(1);
    setIsTranslated(false);
    setTranslatedVoters([]);
    setAdjudicationSort("none");
  }, [voters]);

  const displayVoters = isTranslated ? translatedVoters : voters;
  const isServerPaginated =
    Boolean(pagination) &&
    (typeof onPageChange === "function" || typeof onLimitChange === "function");
  const serverPage = Math.max(1, Number(pagination?.page || 1));
  const serverLimit = Math.max(1, Number(pagination?.limit || 25));
  const serverTotal = Math.max(0, Number(pagination?.total || 0));
  const serverTotalPages = Math.max(0, Number(pagination?.totalPages || 0));
  const pages = Math.max(1, Math.ceil(displayVoters.length / pageSize));

  useEffect(() => {
    setPage((prev) => Math.min(prev, pages));
  }, [pages]);

  const sortedDisplayVoters = useMemo(() => {
    if (adjudicationSort === "none") return displayVoters;

    const direction = adjudicationSort === "desc" ? -1 : 1;
    return [...displayVoters].sort((a, b) => {
      const aVal = getAdjudicationValue(a) ? 1 : 0;
      const bVal = getAdjudicationValue(b) ? 1 : 0;
      if (aVal !== bVal) {
        return direction * (aVal - bVal);
      }

      return String(a?.name || "").localeCompare(
        String(b?.name || ""),
        undefined,
        {
          sensitivity: "base",
        },
      );
    });
  }, [adjudicationSort, displayVoters]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedDisplayVoters.slice(start, start + pageSize);
  }, [sortedDisplayVoters, page, pageSize]);
  const rows = isServerPaginated ? sortedDisplayVoters : paged;

  const visibleStart = isServerPaginated
    ? serverTotal === 0
      ? 0
      : (serverPage - 1) * serverLimit + 1
    : displayVoters.length === 0
      ? 0
      : (page - 1) * pageSize + 1;
  const visibleEnd = isServerPaginated
    ? Math.min(serverPage * serverLimit, serverTotal)
    : Math.min(page * pageSize, sortedDisplayVoters.length);
  const displayTotal = isServerPaginated
    ? serverTotal
    : sortedDisplayVoters.length;

  const getVoterKey = useCallback((voter, index) => {
    return String(
      voter?.id ||
        voter?.voter_id ||
        `${voter?.serial_number || "row"}-${index}`,
    );
  }, []);

  useEffect(() => {
    const snapshot = buildAdjudicationSnapshot(voters, getVoterKey);
    setSavedAdjudication(snapshot);
    setDraftAdjudication(snapshot);
  }, [voters, getVoterKey]);

  const hasUnsavedAdjudicationChanges = useMemo(() => {
    const keys = new Set([
      ...Object.keys(savedAdjudication),
      ...Object.keys(draftAdjudication),
    ]);
    for (const key of keys) {
      if (Boolean(savedAdjudication[key]) !== Boolean(draftAdjudication[key])) {
        return true;
      }
    }
    return false;
  }, [draftAdjudication, savedAdjudication]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isEditMode || !hasUnsavedAdjudicationChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedAdjudicationChanges, isEditMode]);

  const handleToggleEdit = useCallback(() => {
    setDraftAdjudication(savedAdjudication);
    setIsEditMode(true);
  }, [savedAdjudication]);

  const handleCancelEdit = useCallback(() => {
    setDraftAdjudication(savedAdjudication);
    setIsEditMode(false);
  }, [savedAdjudication]);

  const handleAdjudicationToggle = useCallback(
    async (key, voterId, checked) => {
      const rowKey = String(key);
      const nextValue = Boolean(checked);
      const previousValue = Boolean(savedAdjudication[rowKey]);

      setDraftAdjudication((prev) => ({
        ...prev,
        [rowKey]: nextValue,
      }));

      if (previousValue === nextValue) return;

      if (typeof onSaveAdjudicationChanges !== "function") {
        toast.error("Adjudication update is not available.");
        setDraftAdjudication((prev) => ({
          ...prev,
          [rowKey]: previousValue,
        }));
        return;
      }

      const normalizedVoterId = String(voterId || "").trim();
      if (!normalizedVoterId) {
        toast.error("Adjudication update failed: voter id missing.");
        setDraftAdjudication((prev) => ({
          ...prev,
          [rowKey]: previousValue,
        }));
        return;
      }

      setSavingAdjudication(true);
      try {
        await onSaveAdjudicationChanges([
          { voterId: normalizedVoterId, underAdjudication: nextValue },
        ]);
        setSavedAdjudication((prev) => ({
          ...prev,
          [rowKey]: nextValue,
        }));
      } catch (err) {
        const status = Number(err?.status || 0);
        if (status === 404 || status === 405) {
          toast.error(
            "Save failed: adjudication update API route is missing on backend.",
          );
        } else {
          toast.error(err?.message || "Failed to update adjudication status.");
        }

        setDraftAdjudication((prev) => ({
          ...prev,
          [rowKey]: previousValue,
        }));
      } finally {
        setSavingAdjudication(false);
      }
    },
    [onSaveAdjudicationChanges, savedAdjudication],
  );

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
          }),
        );
        translated.push(...translatedBatch);
        setTranslationProgress(
          Math.round((translated.length / voters.length) * 100),
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
    <div className="card space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-sm text-slate-200">
          Showing {visibleStart}-{visibleEnd} of {displayTotal} voters
          {isTranslated && (
            <span className="ml-2 text-emerald-400 font-medium">
              (Translated)
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm w-full sm:w-auto">
          {/* Translate Button */}
          <button
            type="button"
            onClick={handleTranslate}
            disabled={translating || loading || !voters.length}
            className={`translate-btn flex-1 sm:flex-none ${
              isTranslated ? "translate-btn-active" : ""
            }`}
            title={
              isTranslated ? "Show original language" : "Translate to English"
            }
          >
            {translating ? (
              <>
                <span className="translate-spinner" />
                <span className="hidden sm:inline">
                  Translating... {translationProgress}%
                </span>
                <span className="sm:hidden">{translationProgress}%</span>
              </>
            ) : isTranslated ? (
              <>
                <span className="text-lg">🌐</span>
                <span className="hidden sm:inline">Show Original</span>
              </>
            ) : (
              <>
                <span className="text-lg">🇬🇧</span>
                <span className="hidden sm:inline">Translate</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <label
              htmlFor="pageSize"
              className="text-slate-300 hidden sm:inline"
            >
              Per page
            </label>
            <select
              id="pageSize"
              className="w-20 sm:w-24 text-sm"
              value={isServerPaginated ? serverLimit : pageSize}
              onChange={(e) => {
                const nextLimit = Number(e.target.value);
                if (isServerPaginated) {
                  onLimitChange?.(nextLimit);
                } else {
                  setPageSize(nextLimit);
                  setPage(1);
                }
              }}
            >
              {[10, 25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <CsvExportButton
            voters={displayVoters}
            disabled={loading || !displayVoters.length}
          />
          {!isEditMode && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleToggleEdit}
              disabled={loading || !voters.length}
            >
              Edit Adjudication
            </button>
          )}
          {isEditMode && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelEdit}
                disabled={savingAdjudication}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsEditMode(false)}
                disabled={savingAdjudication}
              >
                Done
              </button>
            </>
          )}
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span>{error}</span>
            {typeof onRetry === "function" && (
              <button
                type="button"
                className="btn btn-secondary text-xs py-1 px-3"
                onClick={onRetry}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
      {loading && <div className="p-3 text-slate-300">Loading voters…</div>}
      {!loading && !error && voters.length === 0 && (
        <div className="p-3 text-slate-300">
          No voters found for these filters.
        </div>
      )}

      {!loading && !error && voters.length > 0 && (
        <>
          {/* Mobile Card View */}
          <div className="voter-cards-mobile">
            {rows.map((voter, index) => {
              const rowKey = getVoterKey(voter, index);
              const adjudicationValue = isEditMode
                ? Boolean(draftAdjudication[rowKey])
                : getAdjudicationValue(voter);

              const cardContent = (
                <>
                  <div className="voter-card-mobile-header">
                    <VoterImage voter={voter} size="medium" />
                    <div className="voter-card-mobile-info">
                      <h4 className="voter-card-mobile-name">
                        {voter.name || "—"}
                      </h4>
                      <p className="voter-card-mobile-id">
                        {voter.voter_id || "—"}
                      </p>
                    </div>
                    <div className="voter-card-mobile-badge">
                      <span className="text-xs capitalize">
                        {voter.gender || "—"}
                      </span>
                      <span className="text-sm font-bold">
                        {voter.age ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="voter-card-mobile-details">
                    <div className="voter-card-mobile-detail">
                      <span className="detail-icon">⚖️</span>
                      <span className="detail-label">Under Adjudication:</span>
                      {isEditMode ? (
                        <input
                          type="checkbox"
                          checked={adjudicationValue}
                          disabled={savingAdjudication}
                          onChange={(e) =>
                            handleAdjudicationToggle(
                              rowKey,
                              voter?.id || voter?.voter_id,
                              e.target.checked,
                            )
                          }
                          aria-label="Under adjudication"
                        />
                      ) : (
                        <span
                          className={`detail-value font-semibold ${
                            adjudicationValue
                              ? "text-amber-300"
                              : "text-slate-300"
                          }`}
                        >
                          {adjudicationValue ? "Yes" : "No"}
                        </span>
                      )}
                    </div>
                    <div className="voter-card-mobile-detail">
                      <span className="detail-icon">🏠</span>
                      <span className="detail-label">House:</span>
                      <span className="detail-value">
                        {voter.house_number || "—"}
                      </span>
                    </div>
                    <div className="voter-card-mobile-detail">
                      <span className="detail-icon">👨‍👧</span>
                      <span className="detail-label">Relation:</span>
                      <span className="detail-value">
                        {voter.relation_type || "—"}
                      </span>
                    </div>
                    <div className="voter-card-mobile-detail">
                      <span className="detail-icon">📍</span>
                      <span className="detail-label">Section:</span>
                      <span className="detail-value">
                        {voter.section || "—"}
                      </span>
                    </div>
                    <div className="voter-card-mobile-detail">
                      <span className="detail-icon">🔢</span>
                      <span className="detail-label">Serial:</span>
                      <span className="detail-value">
                        {voter.serial_number || "—"}
                      </span>
                    </div>
                  </div>
                  <div className="voter-card-mobile-footer">
                    <span className="text-xs text-slate-400">
                      Part {voter.part_number || "—"} • {voter.assembly || "—"}
                    </span>
                    {!isEditMode && (
                      <span className="btn-view-mobile">View Details →</span>
                    )}
                  </div>
                </>
              );

              if (isEditMode) {
                return (
                  <div key={`mobile-${rowKey}`} className="voter-card-mobile">
                    {cardContent}
                  </div>
                );
              }

              return (
                <Link
                  key={`mobile-${rowKey}`}
                  href={`/voter/${voter.id || voter.voter_id}`}
                  className="voter-card-mobile"
                >
                  {cardContent}
                </Link>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="table-scroll voter-table-desktop">
            <table className="w-full text-sm sticky-header">
              <thead className="text-left">
                <tr className="text-slate-200">
                  <th className="p-2">Photo</th>
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
                  <th className="p-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => {
                        setAdjudicationSort((prev) => {
                          if (prev === "none") return "desc";
                          if (prev === "desc") return "asc";
                          return "none";
                        });
                      }}
                      title="Toggle adjudication sort"
                    >
                      <span>Under Adjudication</span>
                      <span className="text-xs text-slate-400">
                        {adjudicationSort === "desc"
                          ? "▼"
                          : adjudicationSort === "asc"
                            ? "▲"
                            : "↕"}
                      </span>
                    </button>
                  </th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((voter, index) => {
                  const rowKey = getVoterKey(voter, index);
                  const adjudicationValue = isEditMode
                    ? Boolean(draftAdjudication[rowKey])
                    : getAdjudicationValue(voter);

                  return (
                    <tr
                      key={rowKey}
                      className="border-b border-ink-400/40 hover:bg-ink-100/50 cursor-pointer transition-colors"
                    >
                      <td className="p-2">
                        <VoterImage voter={voter} size="small" />
                      </td>
                      <td className="p-2 font-semibold text-slate-100">
                        {voter.name || "—"}
                      </td>
                      <td className="p-2 text-slate-200 font-mono text-xs">
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
                      <td
                        className="p-2 text-slate-200 max-w-[150px] truncate"
                        title={voter.section}
                      >
                        {voter.section || "—"}
                      </td>
                      <td
                        className="p-2 text-slate-200 max-w-[150px] truncate"
                        title={voter.assembly}
                      >
                        {voter.assembly || "—"}
                      </td>
                      <td className="p-2 text-slate-200">
                        {voter.serial_number || "—"}
                      </td>
                      <td className="p-2">
                        {isEditMode ? (
                          <input
                            type="checkbox"
                            checked={adjudicationValue}
                            disabled={savingAdjudication}
                            onChange={(e) =>
                              handleAdjudicationToggle(
                                rowKey,
                                voter?.id || voter?.voter_id,
                                e.target.checked,
                              )
                            }
                            aria-label="Under adjudication"
                          />
                        ) : adjudicationValue ? (
                          <span className="inline-flex items-center rounded-full border border-amber-600/60 bg-amber-900/40 px-2 py-0.5 text-xs font-semibold text-amber-200">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-500/60 bg-slate-800/60 px-2 py-0.5 text-xs font-semibold text-slate-300">
                            No
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        {!isEditMode && (
                          <Link
                            href={`/voter/${voter.id || voter.voter_id}`}
                            className="btn btn-primary text-xs py-1 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="mr-1">👁️</span> View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading &&
        !error &&
        (isServerPaginated
          ? serverTotalPages > 1
          : voters.length > pageSize) && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-ink-400/30">
            <div className="text-sm text-slate-300 order-2 sm:order-1">
              Page {isServerPaginated ? serverPage : page} of{" "}
              {isServerPaginated ? serverTotalPages || 1 : pages}
            </div>
            <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
              <button
                type="button"
                className="btn btn-secondary flex-1 sm:flex-none"
                disabled={isServerPaginated ? serverPage <= 1 : page === 1}
                onClick={() => {
                  if (isServerPaginated) {
                    onPageChange?.(Math.max(1, serverPage - 1));
                  } else {
                    setPage((p) => Math.max(1, p - 1));
                  }
                }}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1 sm:flex-none"
                disabled={
                  isServerPaginated
                    ? serverTotalPages === 0 || serverPage >= serverTotalPages
                    : page === pages
                }
                onClick={() => {
                  if (isServerPaginated) {
                    onPageChange?.(serverPage + 1);
                  } else {
                    setPage((p) => Math.min(pages, p + 1));
                  }
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
