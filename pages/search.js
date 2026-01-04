import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import ProtectedRoute from "../components/ProtectedRoute";
import { userAPI } from "../lib/api";

export default function SearchPage() {
  return (
    <ProtectedRoute allowedRoles={["user", "admin"]}>
      <SearchContent />
    </ProtectedRoute>
  );
}

function SearchContent() {
  const router = useRouter();
  const [assemblies, setAssemblies] = useState([]);
  const [parts, setParts] = useState([]);
  const [loadingAssemblies, setLoadingAssemblies] = useState(true);
  const [loadingParts, setLoadingParts] = useState(false);

  const [filters, setFilters] = useState({
    assembly: "",
    partNumber: "",
    name: "",
    voterId: "",
    section: "",
    relationName: "",
  });

  const [voters, setVoters] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch assemblies on mount
  useEffect(() => {
    const controller = new AbortController();
    userAPI
      .getAssemblies(controller.signal)
      .then((res) => {
        setAssemblies(res.assemblies || res || []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to load assemblies:", err);
        }
      })
      .finally(() => setLoadingAssemblies(false));

    return () => controller.abort();
  }, []);

  // Fetch parts when assembly changes
  useEffect(() => {
    if (!filters.assembly) {
      setParts([]);
      return;
    }

    const controller = new AbortController();
    setLoadingParts(true);
    userAPI
      .getParts(filters.assembly, controller.signal)
      .then((res) => {
        setParts(res.parts || res || []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to load parts:", err);
        }
      })
      .finally(() => setLoadingParts(false));

    return () => controller.abort();
  }, [filters.assembly]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (key === "assembly") {
      setFilters((prev) => ({ ...prev, partNumber: "" }));
    }
  };

  const searchVoters = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");

      const query = {
        ...filters,
        page,
        limit: pagination.limit,
      };

      // Remove empty values
      Object.keys(query).forEach((key) => {
        if (!query[key] && query[key] !== 0) delete query[key];
      });

      try {
        const res = await userAPI.searchVoters(query);
        setVoters(res.voters || []);
        setPagination(
          res.pagination || {
            page,
            limit: 50,
            total: res.voters?.length || 0,
            totalPages: 1,
          }
        );
      } catch (err) {
        setError(err.message || "Failed to search voters");
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit]
  );

  const handleSearch = (e) => {
    e?.preventDefault();
    searchVoters(1);
  };

  const handlePageChange = (newPage) => {
    searchVoters(newPage);
  };

  const handleVoterClick = (voterId) => {
    router.push(`/voter/${voterId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-100">
            Search Voters
          </h1>
          <p className="text-slate-300">
            Search and find voter information across assemblies
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Filters</h3>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Assembly */}
            <div className="space-y-2">
              <label htmlFor="assembly">🏛️ Assembly</label>
              <select
                id="assembly"
                value={filters.assembly}
                onChange={(e) => handleFilterChange("assembly", e.target.value)}
                disabled={loadingAssemblies}
              >
                <option value="">All Assemblies</option>
                {assemblies.map((a, idx) => {
                  // Handle both string and object formats for assemblies
                  const assemblyName =
                    typeof a === "string"
                      ? a
                      : String(a?.name || a?.assembly || "");
                  const assemblyKey =
                    typeof a === "string" ? a : a?.id || a?.name || idx;
                  if (!assemblyName) return null;
                  return (
                    <option key={`asm-${assemblyKey}`} value={assemblyName}>
                      {assemblyName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Part Number */}
            <div className="space-y-2">
              <label htmlFor="partNumber">🧩 Part Number</label>
              <select
                id="partNumber"
                value={filters.partNumber}
                onChange={(e) =>
                  handleFilterChange("partNumber", e.target.value)
                }
                disabled={!filters.assembly || loadingParts}
              >
                <option value="">All Parts</option>
                {parts.map((p) => (
                  <option key={p.part_number || p} value={p.part_number || p}>
                    Part {p.part_number || p}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label htmlFor="name">🔎 Name</label>
              <input
                id="name"
                type="text"
                placeholder="Enter name"
                value={filters.name}
                onChange={(e) => handleFilterChange("name", e.target.value)}
              />
            </div>

            {/* Voter ID */}
            <div className="space-y-2">
              <label htmlFor="voterId">🪪 Voter ID</label>
              <input
                id="voterId"
                type="text"
                placeholder="Enter voter ID"
                value={filters.voterId}
                onChange={(e) => handleFilterChange("voterId", e.target.value)}
              />
            </div>

            {/* Section */}
            <div className="space-y-2">
              <label htmlFor="section">📍 Section</label>
              <input
                id="section"
                type="text"
                placeholder="Enter section"
                value={filters.section}
                onChange={(e) => handleFilterChange("section", e.target.value)}
              />
            </div>

            {/* Relation Name */}
            <div className="space-y-2">
              <label htmlFor="relationName">👨‍👩‍👧 Father/Husband Name</label>
              <input
                id="relationName"
                type="text"
                placeholder="Enter relation name"
                value={filters.relationName}
                onChange={(e) =>
                  handleFilterChange("relationName", e.target.value)
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Searching..." : "Search"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setFilters({
                  assembly: "",
                  partNumber: "",
                  name: "",
                  voterId: "",
                  section: "",
                  relationName: "",
                });
                setVoters([]);
              }}
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-rose-900/50 text-rose-100 rounded-lg border border-rose-700">
          {error}
        </div>
      )}

      {/* Results */}
      {voters.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">
              Results ({pagination.total || voters.length} voters)
            </h3>
          </div>

          <div className="table-scroll">
            <table className="w-full text-sm sticky-header">
              <thead className="text-left">
                <tr className="text-slate-200">
                  <th className="p-2">Serial</th>
                  <th className="p-2">Voter ID</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Father/Husband</th>
                  <th className="p-2">House #</th>
                  <th className="p-2">Age</th>
                  <th className="p-2">Gender</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {voters.map((voter) => (
                  <tr
                    key={voter.id || voter.voter_id}
                    className="border-b border-ink-400/40 hover:bg-ink-100/50 cursor-pointer"
                    onClick={() => handleVoterClick(voter.id || voter.voter_id)}
                  >
                    <td className="p-2 text-slate-200">
                      {voter.serial_number || "—"}
                    </td>
                    <td className="p-2 text-slate-200 font-mono">
                      {voter.voter_id || "—"}
                    </td>
                    <td className="p-2 font-semibold text-slate-100">
                      {voter.name || "—"}
                    </td>
                    <td className="p-2 text-slate-200">
                      {voter.relation_name || "—"}
                    </td>
                    <td className="p-2 text-slate-200">
                      {voter.house_number || "—"}
                    </td>
                    <td className="p-2 text-slate-200">{voter.age ?? "—"}</td>
                    <td className="p-2 text-slate-200 capitalize">
                      {voter.gender || "—"}
                    </td>
                    <td className="p-2">
                      <button
                        className="btn btn-secondary text-xs py-1 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVoterClick(voter.id || voter.voter_id);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-slate-300">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary"
                  disabled={pagination.page === 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-primary"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Results */}
      {!loading && voters.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            No Results
          </h3>
          <p className="text-slate-300">
            Use the filters above to search for voters
          </p>
        </div>
      )}
    </div>
  );
}
