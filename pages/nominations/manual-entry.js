import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import { nominationAPI } from "../../lib/api";
import toast from "react-hot-toast";

// ─── Section nav ────────────────────────────────────────────────────

const SECTIONS = [
  { id: "header", label: "Election Details" },
  { id: "partI", label: "Part I — Recognised Party" },
  { id: "partII", label: "Part II — 10 Proposers" },
  { id: "partIII", label: "Part III — Candidate Declaration" },
  { id: "partIIIA", label: "Part IIIA — Criminal & Disqualification" },
  { id: "partIV", label: "Part IV — RO Record" },
  { id: "partV", label: "Part V — RO Decision" },
  { id: "partVI", label: "Part VI — Receipt & Scrutiny" },
];

// ─── Default proposer row ──────────────────────────────────────────

const EMPTY_PROPOSER = () => ({
  partNo: "",
  slNo: "",
  fullName: "",
  signature: "",
  date: "",
});

function clonePayloadBase(source) {
  if (!source || typeof source !== "object") return {};
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(source);
    } catch {
      // Fallback below.
    }
  }
  try {
    return JSON.parse(JSON.stringify(source));
  } catch {
    return { ...source };
  }
}

function toSessionId(value) {
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
}

function getDocxPageElements(root) {
  if (!root) return [];
  const strict = Array.from(
    root.querySelectorAll(".docx-wrapper article.docx > section.docx"),
  );
  if (strict.length) return strict;
  const fallback = Array.from(root.querySelectorAll("article.docx > section"));
  if (fallback.length) return fallback;
  return Array.from(root.querySelectorAll("section.docx"));
}

function normalizeNominationSessionListResponse(res) {
  const list = Array.isArray(res?.sessions)
    ? res.sessions
    : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
        ? res
        : [];
  return Array.isArray(list) ? list : [];
}

function countSchemaLeafPaths(node) {
  if (!node) return 0;
  if (Array.isArray(node)) {
    if (!node.length) return 1;
    return node.reduce((sum, child) => sum + countSchemaLeafPaths(child), 0);
  }
  if (typeof node !== "object") return 1;

  if (node.fields && Array.isArray(node.fields)) {
    return node.fields.reduce((sum, field) => {
      if (field?.fields || field?.properties || field?.items) {
        return sum + countSchemaLeafPaths(field);
      }
      return sum + 1;
    }, 0);
  }

  if (node.properties && typeof node.properties === "object") {
    return Object.values(node.properties).reduce(
      (sum, child) => sum + countSchemaLeafPaths(child),
      0,
    );
  }

  if (node.items) {
    return countSchemaLeafPaths(node.items);
  }

  const scalarKeys = Object.keys(node).filter(
    (key) =>
      ![
        "type",
        "description",
        "title",
        "required",
        "enum",
        "default",
        "nullable",
      ].includes(key),
  );

  if (!scalarKeys.length) return 1;
  return scalarKeys.reduce(
    (sum, key) => sum + countSchemaLeafPaths(node[key]),
    0,
  );
}

function pickFirstFiniteNumber(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function pickFirstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function normalizeMissingFieldList(rawValue) {
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch {
      // Fallback to CSV parsing.
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeNominationDbAudit(rawAudit) {
  if (!rawAudit || typeof rawAudit !== "object") {
    return {
      expectedPersistedCount: null,
      savedCount: null,
      missingFields: [],
      raw: rawAudit || null,
    };
  }

  const expectedPersistedCount = pickFirstFiniteNumber(
    rawAudit.expectedPersistedCount,
    rawAudit.expectedCount,
    rawAudit.expected,
    rawAudit.totalFieldEntries,
    rawAudit.totalFields,
  );

  const savedCount = pickFirstFiniteNumber(
    rawAudit.savedCount,
    rawAudit.persistedCount,
    rawAudit.saved,
    rawAudit.writtenCount,
  );

  const missingFields = normalizeMissingFieldList(
    rawAudit.missingFields ||
      rawAudit.missingRequired ||
      rawAudit.missing ||
      rawAudit.notPersisted,
  );

  return {
    expectedPersistedCount,
    savedCount,
    missingFields,
    raw: rawAudit,
  };
}

function deriveTemplateAuditPassed(templateAudit, templateMissing = []) {
  if (Array.isArray(templateMissing) && templateMissing.length > 0) {
    return false;
  }

  if (typeof templateAudit === "boolean") return templateAudit;

  if (templateAudit && typeof templateAudit === "object") {
    const candidateKeys = ["valid", "passed", "ok", "success"];
    for (const key of candidateKeys) {
      if (typeof templateAudit[key] === "boolean") {
        return templateAudit[key];
      }
    }

    if (typeof templateAudit.status === "string") {
      const normalized = templateAudit.status.trim().toLowerCase();
      if (["pass", "passed", "ok", "success", "valid"].includes(normalized)) {
        return true;
      }
      if (["fail", "failed", "invalid", "error"].includes(normalized)) {
        return false;
      }
    }
  }

  if (typeof templateAudit === "string") {
    const normalized = templateAudit.trim().toLowerCase();
    if (
      ["true", "pass", "passed", "ok", "success", "valid"].includes(normalized)
    ) {
      return true;
    }
    if (["false", "fail", "failed", "invalid", "error"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function flattenTemplateAuditWarnings(templateAudit) {
  if (!templateAudit) return [];
  if (Array.isArray(templateAudit)) {
    return templateAudit
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (typeof templateAudit === "string") {
    return templateAudit.trim() ? [templateAudit.trim()] : [];
  }
  if (typeof templateAudit !== "object") {
    return [];
  }

  const lines = [];
  const stack = [["", templateAudit]];

  while (stack.length && lines.length < 16) {
    const [prefix, value] = stack.pop();
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        stack.push([`${prefix}[${index}]`, item]);
      });
      continue;
    }

    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, child]) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        stack.push([nextPrefix, child]);
      });
      continue;
    }

    if (value === false) {
      lines.push(prefix || "Template audit check failed");
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const looksWarning =
        ["missing", "fail", "invalid", "error", "unresolved"].some((token) =>
          trimmed.toLowerCase().includes(token),
        ) ||
        ["missing", "failed", "error", "unresolved"].some((token) =>
          (prefix || "").toLowerCase().includes(token),
        );
      if (looksWarning) {
        lines.push(prefix ? `${prefix}: ${trimmed}` : trimmed);
      }
    }
  }

  return lines;
}

function normalizeNominationPreviewMetadata(rawValue) {
  const root = rawValue && typeof rawValue === "object" ? rawValue : {};
  const previewState =
    root.previewState && typeof root.previewState === "object"
      ? root.previewState
      : {};
  return {
    pageCount: pickFirstFiniteNumber(
      previewState.pageCount,
      previewState.pages,
      root.pageCount,
      root.pages,
    ),
    renderedAt:
      pickFirstNonEmptyString(
        previewState.lastRenderedAt,
        previewState.renderedAt,
        previewState.generatedAt,
        root.lastRenderedAt,
        root.renderedAt,
      ) || null,
    renderedFromSessionId:
      pickFirstNonEmptyString(
        previewState.lastRenderedFromSessionId,
        previewState.sessionId,
        root.sessionId,
      ) || null,
    templateAudit:
      root.templateAudit !== undefined
        ? root.templateAudit
        : previewState.templateAudit || null,
    raw: root,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function NominationManualEntryPage() {
  const router = useRouter();
  const { sessionId: querySessionId } = router.query;
  useAuth();

  // ── form state ──
  const [sessionId, setSessionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);

  // Header
  const [state, setState] = useState("");
  const [candidatePhotoUrl, setCandidatePhotoUrl] = useState("");
  const [candidateSignatureUrl, setCandidateSignatureUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  // Part I — Recognised Party Nomination
  const [partI_constituency, setPartI_constituency] = useState("");
  const [partI_candidateName, setPartI_candidateName] = useState("");
  const [partI_fatherName, setPartI_fatherName] = useState("");
  const [partI_postalAddress, setPartI_postalAddress] = useState("");
  const [partI_candidateSlNo, setPartI_candidateSlNo] = useState("");
  const [partI_candidatePartNo, setPartI_candidatePartNo] = useState("");
  const [partI_candidateConstituency, setPartI_candidateConstituency] =
    useState("");
  const [partI_proposerName, setPartI_proposerName] = useState("");
  const [partI_proposerSlNo, setPartI_proposerSlNo] = useState("");
  const [partI_proposerPartNo, setPartI_proposerPartNo] = useState("");
  const [partI_proposerConstituency, setPartI_proposerConstituency] =
    useState("");
  const [partI_date, setPartI_date] = useState("");

  // Part II — 10 Proposers
  const [partII_constituency, setPartII_constituency] = useState("");
  const [partII_candidateName, setPartII_candidateName] = useState("");
  const [partII_fatherName, setPartII_fatherName] = useState("");
  const [partII_postalAddress, setPartII_postalAddress] = useState("");
  const [partII_candidateSlNo, setPartII_candidateSlNo] = useState("");
  const [partII_candidatePartNo, setPartII_candidatePartNo] = useState("");
  const [partII_candidateConstituency, setPartII_candidateConstituency] =
    useState("");
  const [proposers, setProposers] = useState(
    Array.from({ length: 10 }, () => EMPTY_PROPOSER()),
  );

  // Part III — Candidate Declaration
  const [age, setAge] = useState("");
  const [recognisedParty, setRecognisedParty] = useState("");
  const [unrecognisedParty, setUnrecognisedParty] = useState("");
  const [symbol1, setSymbol1] = useState("");
  const [symbol2, setSymbol2] = useState("");
  const [symbol3, setSymbol3] = useState("");
  const [language, setLanguage] = useState("");
  const [casteTribe, setCasteTribe] = useState("");
  const [scStState, setScStState] = useState("");
  const [scStArea, setScStArea] = useState("");
  const [assemblyState, setAssemblyState] = useState("");
  const [partIII_date, setPartIII_date] = useState("");

  // Part IIIA — Criminal Record
  const [convicted, setConvicted] = useState("No");
  const [criminal_firNos, setCriminal_firNos] = useState("");
  const [criminal_policeStation, setCriminal_policeStation] = useState("");
  const [criminal_district, setCriminal_district] = useState("");
  const [criminal_state, setCriminal_state] = useState("");
  const [criminal_sections, setCriminal_sections] = useState("");
  const [criminal_convictionDates, setCriminal_convictionDates] = useState("");
  const [criminal_courts, setCriminal_courts] = useState("");
  const [criminal_punishment, setCriminal_punishment] = useState("");
  const [criminal_releaseDates, setCriminal_releaseDates] = useState("");
  const [criminal_appealFiled, setCriminal_appealFiled] = useState("No");
  const [criminal_appealParticulars, setCriminal_appealParticulars] =
    useState("");
  const [criminal_appealCourts, setCriminal_appealCourts] = useState("");
  const [criminal_appealStatus, setCriminal_appealStatus] = useState("");
  const [criminal_disposalDates, setCriminal_disposalDates] = useState("");
  const [criminal_orderNature, setCriminal_orderNature] = useState("");

  // Part IIIA — Disqualification Declarations
  const [officeOfProfit, setOfficeOfProfit] = useState("No");
  const [officeOfProfit_details, setOfficeOfProfit_details] = useState("");
  const [insolvency, setInsolvency] = useState("No");
  const [insolvency_discharged, setInsolvency_discharged] = useState("");
  const [foreignAllegiance, setForeignAllegiance] = useState("No");
  const [foreignAllegiance_details, setForeignAllegiance_details] =
    useState("");
  const [disqualification_8A, setDisqualification_8A] = useState("No");
  const [disqualification_period, setDisqualification_period] = useState("");
  const [dismissalForCorruption, setDismissalForCorruption] = useState("No");
  const [dismissal_date, setDismissal_date] = useState("");
  const [govContracts, setGovContracts] = useState("No");
  const [govContracts_details, setGovContracts_details] = useState("");
  const [managingAgent, setManagingAgent] = useState("No");
  const [managingAgent_details, setManagingAgent_details] = useState("");
  const [disqualification_10A, setDisqualification_10A] = useState("No");
  const [section10A_date, setSection10A_date] = useState("");

  // Part IIIA — Place & Date
  const [partIIIA_place, setPartIIIA_place] = useState("");
  const [partIIIA_date, setPartIIIA_date] = useState("");

  // Part IV — RO Record
  const [partIV_serialNo, setPartIV_serialNo] = useState("");
  const [partIV_hour, setPartIV_hour] = useState("");
  const [partIV_date, setPartIV_date] = useState("");
  const [partIV_deliveredBy, setPartIV_deliveredBy] = useState("");
  const [partIV_roDate, setPartIV_roDate] = useState("");

  // Part V — RO Decision
  const [partV_decision, setPartV_decision] = useState("");
  const [partV_date, setPartV_date] = useState("");

  // Part VI — Receipt & Scrutiny
  const [partVI_serialNo, setPartVI_serialNo] = useState("");
  const [partVI_candidateName, setPartVI_candidateName] = useState("");
  const [partVI_constituency, setPartVI_constituency] = useState("");
  const [partVI_hour, setPartVI_hour] = useState("");
  const [partVI_date, setPartVI_date] = useState("");
  const [partVI_scrutinyHour, setPartVI_scrutinyHour] = useState("");
  const [partVI_scrutinyDate, setPartVI_scrutinyDate] = useState("");
  const [partVI_scrutinyPlace, setPartVI_scrutinyPlace] = useState("");
  const [partVI_roDate, setPartVI_roDate] = useState("");

  // ── Nav state ──
  const [activeSectionId, setActiveSectionId] = useState("header");
  const [mobileViewTab, setMobileViewTab] = useState("form");

  // ── Save and schema state ──
  const [sessionFormData, setSessionFormData] = useState(null);
  const [schemaFieldCount, setSchemaFieldCount] = useState(null);
  const [schemaLoadError, setSchemaLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [lastSaveExportUrl, setLastSaveExportUrl] = useState("");
  const [saveDiagnostics, setSaveDiagnostics] = useState(null);
  const [strictTemplateAudit, setStrictTemplateAudit] = useState(false);

  const [sessionValidation, setSessionValidation] = useState({
    valid: null,
    missingRequired: [],
    details: null,
    previewState: null,
    validationSnapshot: null,
    templateAudit: null,
    lastCheckedAt: null,
    error: "",
  });
  const [validationLoading, setValidationLoading] = useState(false);

  const [previewMetadata, setPreviewMetadata] = useState({
    pageCount: null,
    renderedAt: null,
    renderedFromSessionId: null,
    templateAudit: null,
    raw: null,
    error: "",
  });

  // ── Preview state ──
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewRenderError, setPreviewRenderError] = useState("");
  const [previewBlobUrl, setPreviewBlobUrl] = useState("");
  const [previewPageCount, setPreviewPageCount] = useState(0);
  const [previewCurrentPage, setPreviewCurrentPage] = useState(1);
  const [previewStale, setPreviewStale] = useState(true);
  const [previewLastRefreshedAt, setPreviewLastRefreshedAt] = useState(null);
  const [previewLastRenderedSessionId, setPreviewLastRenderedSessionId] =
    useState("");
  const [
    previewLastRenderedFromSessionAt,
    setPreviewLastRenderedFromSessionAt,
  ] = useState(null);
  const [previewDiagnostics, setPreviewDiagnostics] = useState({
    valid: null,
    missingRequired: [],
    templateAudit: null,
    templateMissing: [],
    templateAuditPassed: null,
    pageCount: null,
  });
  const [previewSource, setPreviewSource] = useState("none");
  const previewHostRef = useRef(null);
  const previewScrollRef = useRef(null);
  const previewAbortRef = useRef(null);
  const previewBlobUrlRef = useRef("");
  const previewRequestIdRef = useRef(0);
  const previewRefreshTimerRef = useRef(null);
  const lastPreviewDigestRef = useRef("");

  // ── Session list/search state ──
  const [sessions, setSessions] = useState([]);
  const [sessionListLoading, setSessionListLoading] = useState(false);
  const [sessionSearchLoading, setSessionSearchLoading] = useState(false);
  const [sessionListError, setSessionListError] = useState("");
  const [sessionActionLoading, setSessionActionLoading] = useState("");
  const [sessionSearch, setSessionSearch] = useState({
    candidate: "",
    party: "",
    constituency: "",
    state: "",
  });

  const resolvedQuerySessionId = toSessionId(querySessionId);

  // ── Scroll-based sidebar tracking ──
  useEffect(() => {
    const sectionIds = SECTIONS.map((s) => s.id);
    const observers = [];
    sectionIds.forEach((id) => {
      const el = document.getElementById(`section-${id}`);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSectionId(id);
        },
        { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [loadingSession]);

  // ── Load backend form schema for future dynamic rendering parity ──
  useEffect(() => {
    let cancelled = false;
    nominationAPI
      .getFormSchema()
      .then((schemaRes) => {
        if (cancelled) return;
        const schemaRoot =
          schemaRes?.schema || schemaRes?.formSchema || schemaRes || {};
        setSchemaFieldCount(countSchemaLeafPaths(schemaRoot));
        setSchemaLoadError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setSchemaLoadError(err?.message || "Could not load nomination schema");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadNominationSessions({ filters = sessionSearch } = {}) {
    const hasFilters = Object.values(filters || {}).some(
      (value) => value !== undefined && value !== null && value !== "",
    );

    if (hasFilters) setSessionSearchLoading(true);
    else setSessionListLoading(true);
    setSessionListError("");

    try {
      const response = hasFilters
        ? await nominationAPI.search(filters)
        : await nominationAPI.getSessions();
      setSessions(normalizeNominationSessionListResponse(response));
    } catch (err) {
      setSessionListError(
        err?.message || "Failed to load nomination sessions.",
      );
    } finally {
      if (hasFilters) setSessionSearchLoading(false);
      else setSessionListLoading(false);
    }
  }

  useEffect(() => {
    loadNominationSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load existing session ──
  useEffect(() => {
    if (!resolvedQuerySessionId) return;
    setLoadingSession(true);
    nominationAPI
      .getSession(resolvedQuerySessionId)
      .then((data) => {
        setSessionId(resolvedQuerySessionId);
        const d = data.formData || data.session?.formData || data || {};
        setSessionFormData(d);
        resetFormState();
        if (previewAbortRef.current) {
          previewAbortRef.current.abort();
        }
        if (previewBlobUrlRef.current) {
          window.URL.revokeObjectURL(previewBlobUrlRef.current);
          previewBlobUrlRef.current = "";
        }
        if (previewHostRef.current) {
          previewHostRef.current.innerHTML = "";
        }
        setPreviewBlobUrl("");
        setPreviewPageCount(0);
        setPreviewCurrentPage(1);
        setPreviewError("");
        setPreviewRenderError("");
        setPreviewLastRefreshedAt(null);
        setPreviewStale(true);
        setPreviewLastRenderedSessionId("");
        setPreviewLastRenderedFromSessionAt(null);
        setPreviewDiagnostics({
          valid: null,
          missingRequired: [],
          templateAudit: null,
          templateMissing: [],
          templateAuditPassed: null,
          pageCount: null,
        });
        setPreviewMetadata({
          pageCount: null,
          renderedAt: null,
          renderedFromSessionId: null,
          templateAudit: null,
          raw: null,
          error: "",
        });
        setSessionValidation({
          valid: null,
          missingRequired: [],
          details: null,
          previewState: null,
          validationSnapshot: null,
          templateAudit: null,
          lastCheckedAt: null,
          error: "",
        });
        setPreviewSource("none");
        setSaveDiagnostics(null);
        setLastSavedAt(null);
        setLastSaveExportUrl("");
        lastPreviewDigestRef.current = "";
        populateForm(d);
        refreshSessionStatus(resolvedQuerySessionId);
      })
      .catch((err) => toast.error(err?.message || "Failed to load session."))
      .finally(() => setLoadingSession(false));
  }, [resolvedQuerySessionId]);

  function resetFormState() {
    setState("");
    setCandidatePhotoUrl("");
    setCandidateSignatureUrl("");

    setPartI_constituency("");
    setPartI_candidateName("");
    setPartI_fatherName("");
    setPartI_postalAddress("");
    setPartI_candidateSlNo("");
    setPartI_candidatePartNo("");
    setPartI_candidateConstituency("");
    setPartI_proposerName("");
    setPartI_proposerSlNo("");
    setPartI_proposerPartNo("");
    setPartI_proposerConstituency("");
    setPartI_date("");

    setPartII_constituency("");
    setPartII_candidateName("");
    setPartII_fatherName("");
    setPartII_postalAddress("");
    setPartII_candidateSlNo("");
    setPartII_candidatePartNo("");
    setPartII_candidateConstituency("");
    setProposers(Array.from({ length: 10 }, () => EMPTY_PROPOSER()));

    setAge("");
    setRecognisedParty("");
    setUnrecognisedParty("");
    setSymbol1("");
    setSymbol2("");
    setSymbol3("");
    setLanguage("");
    setCasteTribe("");
    setScStState("");
    setScStArea("");
    setAssemblyState("");
    setPartIII_date("");

    setConvicted("No");
    setCriminal_firNos("");
    setCriminal_policeStation("");
    setCriminal_district("");
    setCriminal_state("");
    setCriminal_sections("");
    setCriminal_convictionDates("");
    setCriminal_courts("");
    setCriminal_punishment("");
    setCriminal_releaseDates("");
    setCriminal_appealFiled("No");
    setCriminal_appealParticulars("");
    setCriminal_appealCourts("");
    setCriminal_appealStatus("");
    setCriminal_disposalDates("");
    setCriminal_orderNature("");

    setOfficeOfProfit("No");
    setOfficeOfProfit_details("");
    setInsolvency("No");
    setInsolvency_discharged("");
    setForeignAllegiance("No");
    setForeignAllegiance_details("");
    setDisqualification_8A("No");
    setDisqualification_period("");
    setDismissalForCorruption("No");
    setDismissal_date("");
    setGovContracts("No");
    setGovContracts_details("");
    setManagingAgent("No");
    setManagingAgent_details("");
    setDisqualification_10A("No");
    setSection10A_date("");

    setPartIIIA_place("");
    setPartIIIA_date("");

    setPartIV_serialNo("");
    setPartIV_hour("");
    setPartIV_date("");
    setPartIV_deliveredBy("");
    setPartIV_roDate("");

    setPartV_decision("");
    setPartV_date("");

    setPartVI_serialNo("");
    setPartVI_candidateName("");
    setPartVI_constituency("");
    setPartVI_hour("");
    setPartVI_date("");
    setPartVI_scrutinyHour("");
    setPartVI_scrutinyDate("");
    setPartVI_scrutinyPlace("");
    setPartVI_roDate("");
  }

  // ── Populate form from loaded data ──
  function populateForm(d) {
    if (d.state) setState(d.state);
    if (d.candidatePhotoUrl) setCandidatePhotoUrl(d.candidatePhotoUrl);
    if (d.candidateSignatureUrl)
      setCandidateSignatureUrl(d.candidateSignatureUrl);
    // Part I
    if (d.partI_constituency) setPartI_constituency(d.partI_constituency);
    if (d.partI_candidateName) setPartI_candidateName(d.partI_candidateName);
    if (d.partI_fatherName) setPartI_fatherName(d.partI_fatherName);
    if (d.partI_postalAddress) setPartI_postalAddress(d.partI_postalAddress);
    if (d.partI_candidateSlNo) setPartI_candidateSlNo(d.partI_candidateSlNo);
    if (d.partI_candidatePartNo)
      setPartI_candidatePartNo(d.partI_candidatePartNo);
    if (d.partI_candidateConstituency)
      setPartI_candidateConstituency(d.partI_candidateConstituency);
    if (d.partI_proposerName) setPartI_proposerName(d.partI_proposerName);
    if (d.partI_proposerSlNo) setPartI_proposerSlNo(d.partI_proposerSlNo);
    if (d.partI_proposerPartNo) setPartI_proposerPartNo(d.partI_proposerPartNo);
    if (d.partI_proposerConstituency)
      setPartI_proposerConstituency(d.partI_proposerConstituency);
    if (d.partI_date) setPartI_date(d.partI_date);
    // Part II
    if (d.partII_constituency) setPartII_constituency(d.partII_constituency);
    if (d.partII_candidateName) setPartII_candidateName(d.partII_candidateName);
    if (d.partII_fatherName) setPartII_fatherName(d.partII_fatherName);
    if (d.partII_postalAddress) setPartII_postalAddress(d.partII_postalAddress);
    if (d.partII_candidateSlNo) setPartII_candidateSlNo(d.partII_candidateSlNo);
    if (d.partII_candidatePartNo)
      setPartII_candidatePartNo(d.partII_candidatePartNo);
    if (d.partII_candidateConstituency)
      setPartII_candidateConstituency(d.partII_candidateConstituency);
    if (d.proposers?.length) {
      const loaded = d.proposers.slice(0, 10);
      while (loaded.length < 10) loaded.push(EMPTY_PROPOSER());
      setProposers(loaded);
    }
    // Part III
    if (d.age) setAge(d.age);
    if (d.recognisedParty) setRecognisedParty(d.recognisedParty);
    if (d.unrecognisedParty) setUnrecognisedParty(d.unrecognisedParty);
    if (d.symbol1) setSymbol1(d.symbol1);
    if (d.symbol2) setSymbol2(d.symbol2);
    if (d.symbol3) setSymbol3(d.symbol3);
    if (d.language) setLanguage(d.language);
    if (d.casteTribe) setCasteTribe(d.casteTribe);
    if (d.scStState) setScStState(d.scStState);
    if (d.scStArea) setScStArea(d.scStArea);
    if (d.assemblyState) setAssemblyState(d.assemblyState);
    if (d.partIII_date) setPartIII_date(d.partIII_date);
    // Part IIIA — Criminal
    if (d.convicted) setConvicted(d.convicted);
    if (d.criminal_firNos) setCriminal_firNos(d.criminal_firNos);
    if (d.criminal_policeStation)
      setCriminal_policeStation(d.criminal_policeStation);
    if (d.criminal_district) setCriminal_district(d.criminal_district);
    if (d.criminal_state) setCriminal_state(d.criminal_state);
    if (d.criminal_sections) setCriminal_sections(d.criminal_sections);
    if (d.criminal_convictionDates)
      setCriminal_convictionDates(d.criminal_convictionDates);
    if (d.criminal_courts) setCriminal_courts(d.criminal_courts);
    if (d.criminal_punishment) setCriminal_punishment(d.criminal_punishment);
    if (d.criminal_releaseDates)
      setCriminal_releaseDates(d.criminal_releaseDates);
    if (d.criminal_appealFiled) setCriminal_appealFiled(d.criminal_appealFiled);
    if (d.criminal_appealParticulars)
      setCriminal_appealParticulars(d.criminal_appealParticulars);
    if (d.criminal_appealCourts)
      setCriminal_appealCourts(d.criminal_appealCourts);
    if (d.criminal_appealStatus)
      setCriminal_appealStatus(d.criminal_appealStatus);
    if (d.criminal_disposalDates)
      setCriminal_disposalDates(d.criminal_disposalDates);
    if (d.criminal_orderNature) setCriminal_orderNature(d.criminal_orderNature);
    // Part IIIA — Disqualification
    if (d.officeOfProfit) setOfficeOfProfit(d.officeOfProfit);
    if (d.officeOfProfit_details)
      setOfficeOfProfit_details(d.officeOfProfit_details);
    if (d.insolvency) setInsolvency(d.insolvency);
    if (d.insolvency_discharged)
      setInsolvency_discharged(d.insolvency_discharged);
    if (d.foreignAllegiance) setForeignAllegiance(d.foreignAllegiance);
    if (d.foreignAllegiance_details)
      setForeignAllegiance_details(d.foreignAllegiance_details);
    if (d.disqualification_8A) setDisqualification_8A(d.disqualification_8A);
    if (d.disqualification_period)
      setDisqualification_period(d.disqualification_period);
    if (d.dismissalForCorruption)
      setDismissalForCorruption(d.dismissalForCorruption);
    if (d.dismissal_date) setDismissal_date(d.dismissal_date);
    if (d.govContracts) setGovContracts(d.govContracts);
    if (d.govContracts_details) setGovContracts_details(d.govContracts_details);
    if (d.managingAgent) setManagingAgent(d.managingAgent);
    if (d.managingAgent_details)
      setManagingAgent_details(d.managingAgent_details);
    if (d.disqualification_10A) setDisqualification_10A(d.disqualification_10A);
    if (d.section10A_date) setSection10A_date(d.section10A_date);
    if (d.partIIIA_place) setPartIIIA_place(d.partIIIA_place);
    if (d.partIIIA_date) setPartIIIA_date(d.partIIIA_date);
    // Part IV
    if (d.partIV_serialNo) setPartIV_serialNo(d.partIV_serialNo);
    if (d.partIV_hour) setPartIV_hour(d.partIV_hour);
    if (d.partIV_date) setPartIV_date(d.partIV_date);
    if (d.partIV_deliveredBy) setPartIV_deliveredBy(d.partIV_deliveredBy);
    if (d.partIV_roDate) setPartIV_roDate(d.partIV_roDate);
    // Part V
    if (d.partV_decision) setPartV_decision(d.partV_decision);
    if (d.partV_date) setPartV_date(d.partV_date);
    // Part VI
    if (d.partVI_serialNo) setPartVI_serialNo(d.partVI_serialNo);
    if (d.partVI_candidateName) setPartVI_candidateName(d.partVI_candidateName);
    if (d.partVI_constituency) setPartVI_constituency(d.partVI_constituency);
    if (d.partVI_hour) setPartVI_hour(d.partVI_hour);
    if (d.partVI_date) setPartVI_date(d.partVI_date);
    if (d.partVI_scrutinyHour) setPartVI_scrutinyHour(d.partVI_scrutinyHour);
    if (d.partVI_scrutinyDate) setPartVI_scrutinyDate(d.partVI_scrutinyDate);
    if (d.partVI_scrutinyPlace) setPartVI_scrutinyPlace(d.partVI_scrutinyPlace);
    if (d.partVI_roDate) setPartVI_roDate(d.partVI_roDate);
  }

  // ── Build payload ──
  function buildPayload(includeSessionId = true) {
    const payload = clonePayloadBase(sessionFormData);

    Object.assign(payload, {
      state,
      candidatePhotoUrl,
      candidateSignatureUrl,
      // Keep top-level summary fields populated for session metadata.
      candidateName: partI_candidateName || partII_candidateName || "",
      fatherMotherHusbandName: partI_fatherName || partII_fatherName || "",
      postalAddress: partI_postalAddress || partII_postalAddress || "",
      party: recognisedParty || unrecognisedParty || "",
      constituency: partI_constituency || partII_constituency || "",
      // Part I
      partI_constituency,
      partI_candidateName,
      partI_fatherName,
      partI_postalAddress,
      partI_candidateSlNo,
      partI_candidatePartNo,
      partI_candidateConstituency,
      partI_proposerName,
      partI_proposerSlNo,
      partI_proposerPartNo,
      partI_proposerConstituency,
      partI_date,
      // Part II
      partII_constituency,
      partII_candidateName,
      partII_fatherName,
      partII_postalAddress,
      partII_candidateSlNo,
      partII_candidatePartNo,
      partII_candidateConstituency,
      // Keep proposer rows in order and cap at exactly 10 rows.
      proposers: proposers.slice(0, 10).map((row) => ({
        ...EMPTY_PROPOSER(),
        ...(row || {}),
      })),
      // Part III
      age,
      recognisedParty,
      unrecognisedParty,
      symbol1,
      symbol2,
      symbol3,
      language,
      casteTribe,
      scStState,
      scStArea,
      assemblyState,
      partIII_date,
      // Part IIIA — Criminal
      convicted,
      criminal_firNos,
      criminal_policeStation,
      criminal_district,
      criminal_state,
      criminal_sections,
      criminal_convictionDates,
      criminal_courts,
      criminal_punishment,
      criminal_releaseDates,
      criminal_appealFiled,
      criminal_appealParticulars,
      criminal_appealCourts,
      criminal_appealStatus,
      criminal_disposalDates,
      criminal_orderNature,
      // Part IIIA — Disqualification
      officeOfProfit,
      officeOfProfit_details,
      insolvency,
      insolvency_discharged,
      foreignAllegiance,
      foreignAllegiance_details,
      disqualification_8A,
      disqualification_period,
      dismissalForCorruption,
      dismissal_date,
      govContracts,
      govContracts_details,
      managingAgent,
      managingAgent_details,
      disqualification_10A,
      section10A_date,
      // Part IIIA — Place & Date
      partIIIA_place,
      partIIIA_date,
      // Part IV
      partIV_serialNo,
      partIV_hour,
      partIV_date,
      partIV_deliveredBy,
      partIV_roDate,
      // Part V
      partV_decision,
      partV_date,
      // Part VI
      partVI_serialNo,
      partVI_candidateName,
      partVI_constituency,
      partVI_hour,
      partVI_date,
      partVI_scrutinyHour,
      partVI_scrutinyDate,
      partVI_scrutinyPlace,
      partVI_roDate,
    });

    if (includeSessionId && sessionId) payload.sessionId = sessionId;
    else delete payload.sessionId;

    return payload;
  }

  const payloadSnapshot = buildPayload(false);
  const payloadDigest = JSON.stringify(payloadSnapshot);

  // ── Image upload handler ──
  async function handleImageUpload(file, fieldName) {
    if (!file) return;
    const isPhoto = fieldName === "candidatePhotoUrl";
    const uploadType = isPhoto ? "photo" : "signature";
    if (isPhoto) setUploadingPhoto(true);
    else setUploadingSignature(true);
    try {
      const res = await nominationAPI.uploadImage(file, uploadType);
      if (!res?.url) {
        throw new Error("Upload response missing image URL.");
      }
      if (isPhoto) setCandidatePhotoUrl(res.url);
      else setCandidateSignatureUrl(res.url);
      toast.success(`${isPhoto ? "Photo" : "Signature"} uploaded!`);
    } catch (err) {
      toast.error(err?.message || "Upload failed.");
    } finally {
      if (isPhoto) setUploadingPhoto(false);
      else setUploadingSignature(false);
    }
  }

  async function refreshSessionStatus(targetSessionId, options = {}) {
    if (!targetSessionId) {
      setSessionValidation((prev) => ({
        ...prev,
        valid: null,
        missingRequired: [],
        details: null,
        previewState: null,
        validationSnapshot: null,
        templateAudit: null,
        lastCheckedAt: null,
        error: "",
      }));
      setPreviewMetadata((prev) => ({
        ...prev,
        pageCount: null,
        renderedAt: null,
        renderedFromSessionId: null,
        templateAudit: null,
        raw: null,
        error: "",
      }));
      return null;
    }

    const includeTemplateAudit =
      options.includeTemplateAudit ?? strictTemplateAudit;
    const showToast = Boolean(options.showToast);

    setValidationLoading(true);

    const [validationResult, metadataResult] = await Promise.allSettled([
      nominationAPI.getSessionValidation(targetSessionId, {
        includeTemplateAudit,
        signal: options.signal,
      }),
      nominationAPI.getPreviewMetadata(targetSessionId, {
        includeTemplateAudit,
        signal: options.signal,
      }),
    ]);

    let nextValidationState = null;

    if (validationResult.status === "fulfilled") {
      const response = validationResult.value || {};
      const missingRequired = normalizeMissingFieldList(
        response.missingRequired || response.missingRequiredLabels,
      );

      nextValidationState = {
        valid:
          typeof response.valid === "boolean"
            ? response.valid
            : missingRequired.length
              ? false
              : null,
        missingRequired,
        details: response.details || null,
        previewState:
          response.previewState && typeof response.previewState === "object"
            ? response.previewState
            : null,
        validationSnapshot: response.validationSnapshot || null,
        templateAudit:
          response.templateAudit !== undefined ? response.templateAudit : null,
        lastCheckedAt: new Date(),
        error: "",
      };
      setSessionValidation(nextValidationState);
    } else {
      const message =
        validationResult.reason?.message || "Validation status fetch failed.";
      setSessionValidation((prev) => ({
        ...prev,
        valid: null,
        lastCheckedAt: new Date(),
        error: message,
      }));
    }

    if (metadataResult.status === "fulfilled") {
      const normalizedMetadata = normalizeNominationPreviewMetadata(
        metadataResult.value,
      );
      setPreviewMetadata({
        ...normalizedMetadata,
        error: "",
      });

      if (normalizedMetadata.renderedFromSessionId) {
        setPreviewLastRenderedSessionId(
          normalizedMetadata.renderedFromSessionId,
        );
      }
      if (normalizedMetadata.renderedAt) {
        setPreviewLastRenderedFromSessionAt(normalizedMetadata.renderedAt);
      }
    } else {
      const message =
        metadataResult.reason?.message || "Preview metadata fetch failed.";
      setPreviewMetadata((prev) => ({
        ...prev,
        error: message,
      }));
    }

    setValidationLoading(false);

    if (showToast) {
      if (validationResult.status === "fulfilled") {
        toast.success("Validation and preview metadata refreshed.");
      } else {
        toast.error("Validation refresh failed.");
      }
    }

    return {
      validation:
        validationResult.status === "fulfilled" ? validationResult.value : null,
      metadata:
        metadataResult.status === "fulfilled" ? metadataResult.value : null,
      nextValidationState,
    };
  }

  // ── Save ──
  async function handleSave({ showToast = true } = {}) {
    setSaving(true);
    setSaveError("");
    try {
      const payload = buildPayload();
      const res = await nominationAPI.manualEntry(payload);
      const nextSessionId = String(res?.sessionId || sessionId || "");

      if (!nextSessionId) {
        throw new Error("Save response missing sessionId.");
      }

      if (nextSessionId !== sessionId) {
        setSessionId(nextSessionId);
      }

      if (toSessionId(router.query?.sessionId) !== nextSessionId) {
        router.replace(
          { pathname: router.pathname, query: { sessionId: nextSessionId } },
          undefined,
          { shallow: true },
        );
      }

      setSessionFormData(payload);
      const savedAt = new Date();
      setLastSavedAt(savedAt);
      setLastSaveExportUrl(res?.exportUrl || "");
      setSaveDiagnostics({
        ...normalizeNominationDbAudit(res?.dbAudit || res?.session?.dbAudit),
        savedAt,
        exportUrl: res?.exportUrl || "",
        previewUrl: res?.previewUrl || "",
        validationUrl: res?.validationUrl || "",
      });

      await refreshSessionStatus(nextSessionId, {
        includeTemplateAudit: strictTemplateAudit,
      });

      loadNominationSessions({ filters: sessionSearch });

      if (showToast) {
        toast.success(res?.message || "Nomination saved.");
      }
      return nextSessionId;
    } catch (err) {
      const message = err?.message || "Save failed.";
      setSaveError(message);
      if (showToast) {
        toast.error(message);
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }

  function updateCurrentPreviewPage() {
    const scroller = previewScrollRef.current;
    const host = previewHostRef.current;
    if (!scroller || !host) return;

    const pages = getDocxPageElements(host);
    if (!pages.length) {
      setPreviewCurrentPage(1);
      return;
    }

    const topAnchor =
      scroller.getBoundingClientRect().top + scroller.clientHeight * 0.35;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    pages.forEach((page, index) => {
      const rect = page.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const distance = Math.abs(center - topAnchor);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setPreviewCurrentPage(closestIndex + 1);
  }

  useEffect(() => {
    const scroller = previewScrollRef.current;
    if (!scroller) return undefined;
    const onScroll = () => updateCurrentPreviewPage();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [previewPageCount]);

  async function renderDocxPreview(blob) {
    if (!previewHostRef.current) return false;

    previewHostRef.current.innerHTML = "";
    const previewModule = await import("docx-preview");
    await previewModule.renderAsync(blob, previewHostRef.current, undefined, {
      breakPages: true,
      inWrapper: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
    });

    const pages = getDocxPageElements(previewHostRef.current);
    setPreviewPageCount(pages.length || 1);
    setPreviewCurrentPage(1);
    requestAnimationFrame(() => updateCurrentPreviewPage());
    return true;
  }

  async function requestPreview({
    source = "payload",
    showToast = false,
  } = {}) {
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;

    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }
    const controller = new AbortController();
    previewAbortRef.current = controller;

    setPreviewLoading(true);
    setPreviewError("");
    setPreviewRenderError("");

    try {
      const preferredSource =
        source === "session" && sessionId ? "session" : "payload";
      let result = null;
      let resolvedSource = preferredSource;
      let usedFallback = false;

      if (preferredSource === "session") {
        result = await nominationAPI.previewDocxFromSessionDetailed(sessionId, {
          signal: controller.signal,
        });
      } else {
        try {
          result = await nominationAPI.previewDocxFromPayloadDetailed(
            buildPayload(false),
            {
              signal: controller.signal,
            },
          );
        } catch (livePreviewError) {
          if (!sessionId) throw livePreviewError;
          result = await nominationAPI.previewDocxFromSessionDetailed(
            sessionId,
            {
              signal: controller.signal,
            },
          );
          resolvedSource = "session";
          usedFallback = true;
          setPreviewError(
            `Live preview failed (${livePreviewError?.message || "request error"}). Showing the last saved session preview instead.`,
          );
        }
      }

      const previewBlob = result?.blob;
      if (!previewBlob) {
        throw new Error("No DOCX preview returned by backend.");
      }

      if (requestId !== previewRequestIdRef.current) return;

      if (previewBlobUrlRef.current) {
        window.URL.revokeObjectURL(previewBlobUrlRef.current);
      }
      const nextBlobUrl = window.URL.createObjectURL(previewBlob);
      previewBlobUrlRef.current = nextBlobUrl;
      setPreviewBlobUrl(nextBlobUrl);

      try {
        const rendered = await renderDocxPreview(previewBlob);
        if (!rendered) {
          setPreviewPageCount(0);
        }
      } catch (renderErr) {
        setPreviewRenderError(
          renderErr?.message || "Could not render DOCX preview in browser.",
        );
      }

      const diagnostics = result?.diagnostics || {};
      const normalizedMissingRequired = normalizeMissingFieldList(
        diagnostics.missingRequired,
      );
      const normalizedTemplateMissing = normalizeMissingFieldList(
        diagnostics.templateMissing,
      );
      const normalizedTemplateAuditPassed =
        typeof diagnostics.templateAuditPassed === "boolean"
          ? diagnostics.templateAuditPassed
          : deriveTemplateAuditPassed(
              diagnostics.templateAudit,
              normalizedTemplateMissing,
            );

      setPreviewDiagnostics({
        valid:
          typeof diagnostics.valid === "boolean" ? diagnostics.valid : null,
        missingRequired: normalizedMissingRequired,
        templateAudit:
          diagnostics.templateAudit !== undefined
            ? diagnostics.templateAudit
            : null,
        templateMissing: normalizedTemplateMissing,
        templateAuditPassed: normalizedTemplateAuditPassed,
        pageCount: pickFirstFiniteNumber(diagnostics.pageCount),
      });

      if (
        pickFirstFiniteNumber(diagnostics.pageCount) &&
        (previewHostRef.current?.childElementCount || 0) === 0
      ) {
        setPreviewPageCount(Number(diagnostics.pageCount));
      }

      setPreviewLastRefreshedAt(new Date());
      setPreviewSource(resolvedSource);

      if (resolvedSource === "session" && sessionId) {
        setPreviewLastRenderedSessionId(sessionId);
      } else {
        setPreviewLastRenderedSessionId("");
        setPreviewLastRenderedFromSessionAt(null);
      }

      lastPreviewDigestRef.current = payloadDigest;
      setPreviewStale(false);

      if (resolvedSource === "session" && sessionId) {
        refreshSessionStatus(sessionId, {
          includeTemplateAudit: strictTemplateAudit,
          signal: controller.signal,
        });
      }

      if (showToast) {
        if (usedFallback) {
          toast.success(
            "Live preview failed, showing latest saved session preview.",
          );
        } else if (resolvedSource === "session") {
          toast.success("Preview refreshed from saved session.");
        } else {
          toast.success("Preview refreshed from current form values.");
        }
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (requestId !== previewRequestIdRef.current) return;
      const message =
        err?.message ||
        "Failed to render preview. Check required fields and try again.";
      setPreviewError(message);
      if (showToast) {
        toast.error(message);
      }
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null;
      }
      if (requestId === previewRequestIdRef.current) {
        setPreviewLoading(false);
      }
    }
  }

  function handlePreviewDocument() {
    setMobileViewTab("preview");
    requestPreview({
      source: sessionId && !previewStale ? "session" : "payload",
      showToast: true,
    });
  }

  function handleRefreshPreview() {
    setMobileViewTab("preview");
    if (previewRefreshTimerRef.current) {
      clearTimeout(previewRefreshTimerRef.current);
    }
    previewRefreshTimerRef.current = setTimeout(() => {
      requestPreview({
        source: sessionId && !previewStale ? "session" : "payload",
        showToast: true,
      });
    }, 420);
  }

  function downloadRenderedPreviewBlob() {
    if (!previewBlobUrl) {
      toast.error("No preview DOCX available yet.");
      return;
    }
    const candidateName = partI_candidateName || partII_candidateName || "";
    const link = document.createElement("a");
    link.href = previewBlobUrl;
    link.download = candidateName
      ? `NominationPreview_${candidateName.replace(/[^a-zA-Z0-9]/g, "_")}.docx`
      : "NominationPreview.docx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // ── Export ──
  async function handleExport() {
    setExporting(true);
    try {
      const id = await handleSave({ showToast: false });
      const name = partI_candidateName || partII_candidateName || "";
      const exportResult = await nominationAPI.exportDocx(id, name, {
        strictTemplateAudit,
      });
      const exportDiagnostics = exportResult?.diagnostics || null;
      if (exportDiagnostics) {
        const templateMissing = normalizeMissingFieldList(
          exportDiagnostics.templateMissing,
        );
        setPreviewDiagnostics((prev) => ({
          ...prev,
          valid:
            typeof exportDiagnostics.valid === "boolean"
              ? exportDiagnostics.valid
              : prev.valid,
          missingRequired: normalizeMissingFieldList(
            exportDiagnostics.missingRequired,
          ),
          templateAudit:
            exportDiagnostics.templateAudit !== undefined
              ? exportDiagnostics.templateAudit
              : prev.templateAudit,
          templateMissing,
          templateAuditPassed:
            typeof exportDiagnostics.templateAuditPassed === "boolean"
              ? exportDiagnostics.templateAuditPassed
              : deriveTemplateAuditPassed(
                  exportDiagnostics.templateAudit,
                  templateMissing,
                ),
          pageCount:
            pickFirstFiniteNumber(exportDiagnostics.pageCount) ||
            prev.pageCount,
        }));
      }
      toast.success("DOCX downloaded.");
    } catch (err) {
      toast.error(err?.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function handleSessionSearchSubmit(event) {
    event.preventDefault();
    await loadNominationSessions({ filters: sessionSearch });
  }

  async function handleSessionSearchReset() {
    const emptyFilters = {
      candidate: "",
      party: "",
      constituency: "",
      state: "",
    };
    setSessionSearch(emptyFilters);
    await loadNominationSessions({ filters: emptyFilters });
  }

  function handleOpenSession(targetSessionId) {
    if (!targetSessionId) return;
    router.push(
      {
        pathname: router.pathname,
        query: { sessionId: targetSessionId },
      },
      undefined,
      { shallow: true },
    );
    setMobileViewTab("form");
  }

  async function handleRenameSession(entry) {
    const entryId = String(entry?.id || entry?._id || entry?.sessionId || "");
    if (!entryId) return;
    const currentName =
      entry?.name ||
      entry?.sessionName ||
      entry?.candidateName ||
      entry?.candidate ||
      "";
    const nextName = window.prompt("Rename session", currentName);
    if (nextName == null || nextName === "") return;

    const actionKey = `rename-${entryId}`;
    setSessionActionLoading(actionKey);
    try {
      await nominationAPI.renameSession(entryId, nextName);
      await loadNominationSessions({ filters: sessionSearch });
      toast.success("Session renamed.");
    } catch (err) {
      toast.error(err?.message || "Failed to rename session.");
    } finally {
      setSessionActionLoading("");
    }
  }

  async function handleDeleteSession(entry) {
    const entryId = String(entry?.id || entry?._id || entry?.sessionId || "");
    if (!entryId) return;
    const sessionLabel =
      entry?.name ||
      entry?.candidateName ||
      entry?.candidate ||
      entryId.slice(0, 8) ||
      entryId;

    if (!window.confirm(`Delete session ${sessionLabel}?`)) return;

    const actionKey = `delete-${entryId}`;
    setSessionActionLoading(actionKey);
    try {
      await nominationAPI.deleteSession(entryId);
      if (sessionId === entryId) {
        setSessionId(null);
        setSessionFormData(null);
        resetFormState();
        setSaveDiagnostics(null);
        setLastSavedAt(null);
        setLastSaveExportUrl("");
        setPreviewStale(true);
        setPreviewLastRenderedSessionId("");
        setPreviewLastRenderedFromSessionAt(null);
        setPreviewDiagnostics({
          valid: null,
          missingRequired: [],
          templateAudit: null,
          templateMissing: [],
          templateAuditPassed: null,
          pageCount: null,
        });
        setPreviewMetadata({
          pageCount: null,
          renderedAt: null,
          renderedFromSessionId: null,
          templateAudit: null,
          raw: null,
          error: "",
        });
        setSessionValidation({
          valid: null,
          missingRequired: [],
          details: null,
          previewState: null,
          validationSnapshot: null,
          templateAudit: null,
          lastCheckedAt: null,
          error: "",
        });
        setPreviewSource("none");
        if (previewBlobUrlRef.current) {
          window.URL.revokeObjectURL(previewBlobUrlRef.current);
          previewBlobUrlRef.current = "";
        }
        if (previewHostRef.current) {
          previewHostRef.current.innerHTML = "";
        }
        setPreviewBlobUrl("");
        setPreviewPageCount(0);
        setPreviewCurrentPage(1);
        setPreviewError("");
        setPreviewRenderError("");
        setPreviewLastRefreshedAt(null);
        lastPreviewDigestRef.current = "";
        router.replace({ pathname: router.pathname }, undefined, {
          shallow: true,
        });
      }
      await loadNominationSessions({ filters: sessionSearch });
      toast.success("Session deleted.");
    } catch (err) {
      toast.error(err?.message || "Failed to delete session.");
    } finally {
      setSessionActionLoading("");
    }
  }

  useEffect(() => {
    setPreviewStale(payloadDigest !== lastPreviewDigestRef.current);
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }

    if (previewRefreshTimerRef.current) {
      clearTimeout(previewRefreshTimerRef.current);
    }
    previewRefreshTimerRef.current = setTimeout(() => {
      requestPreview({ source: "payload" });
    }, 420);

    return () => {
      if (previewRefreshTimerRef.current) {
        clearTimeout(previewRefreshTimerRef.current);
      }
    };
  }, [payloadDigest]);

  useEffect(() => {
    if (!sessionId) return;
    if (previewBlobUrlRef.current) return;
    requestPreview({ source: "session" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    refreshSessionStatus(sessionId, {
      includeTemplateAudit: strictTemplateAudit,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strictTemplateAudit, sessionId]);

  useEffect(
    () => () => {
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
      }
      if (previewRefreshTimerRef.current) {
        clearTimeout(previewRefreshTimerRef.current);
      }
      if (previewBlobUrlRef.current) {
        window.URL.revokeObjectURL(previewBlobUrlRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!previewBlobUrl || !previewHostRef.current) return;
    if (previewHostRef.current.childElementCount > 0) return;
    fetch(previewBlobUrl)
      .then((res) => res.blob())
      .then((blob) => renderDocxPreview(blob))
      .catch((err) => {
        setPreviewRenderError(
          err?.message || "Could not render cached preview document.",
        );
      });
  }, [previewBlobUrl, mobileViewTab]);

  const lastSavedText = useMemo(() => {
    if (!lastSavedAt) return "Not saved yet";
    return new Date(lastSavedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [lastSavedAt]);

  const persistedMissingFields = saveDiagnostics?.missingFields || [];
  const saveExpectedCount = saveDiagnostics?.expectedPersistedCount;
  const savePersistedCount = saveDiagnostics?.savedCount;
  const persistenceStatusLabel = saveDiagnostics
    ? persistedMissingFields.length
      ? "Needs attention"
      : "Saved"
    : "Not saved";

  const effectiveMissingRequired = useMemo(
    () =>
      normalizeMissingFieldList(
        sessionValidation?.missingRequired?.length
          ? sessionValidation.missingRequired
          : previewDiagnostics.missingRequired,
      ),
    [sessionValidation?.missingRequired, previewDiagnostics?.missingRequired],
  );

  const effectiveValidationFlag =
    typeof sessionValidation?.valid === "boolean"
      ? sessionValidation.valid
      : typeof previewDiagnostics?.valid === "boolean"
        ? previewDiagnostics.valid
        : null;

  const validationNeedsAttention =
    effectiveValidationFlag === false || effectiveMissingRequired.length > 0;
  const validationLabel =
    effectiveValidationFlag === true && !validationNeedsAttention
      ? "Valid"
      : validationNeedsAttention
        ? "Needs attention"
        : "Unknown";

  const effectiveTemplateAudit =
    sessionValidation?.templateAudit ??
    previewMetadata?.templateAudit ??
    previewDiagnostics?.templateAudit;
  const effectiveTemplateMissing = useMemo(
    () => normalizeMissingFieldList(previewDiagnostics?.templateMissing),
    [previewDiagnostics?.templateMissing],
  );
  const templateAuditWarnings = useMemo(() => {
    const warningLines = [
      ...effectiveTemplateMissing,
      ...flattenTemplateAuditWarnings(effectiveTemplateAudit),
    ];
    return [...new Set(warningLines)].filter(Boolean);
  }, [effectiveTemplateMissing, effectiveTemplateAudit]);
  const templateAuditPassed = deriveTemplateAuditPassed(
    effectiveTemplateAudit,
    effectiveTemplateMissing,
  );
  const templateAuditLabel =
    templateAuditPassed === true
      ? "Pass"
      : templateAuditPassed === false || templateAuditWarnings.length
        ? "Needs attention"
        : "Unknown";

  const previewEffectivePageCount =
    previewPageCount ||
    pickFirstFiniteNumber(
      previewDiagnostics?.pageCount,
      previewMetadata?.pageCount,
      sessionValidation?.previewState?.pageCount,
      sessionValidation?.previewState?.pages,
    ) ||
    0;

  const lastRenderedFromSessionText = useMemo(() => {
    const renderedSessionId =
      previewLastRenderedSessionId || previewMetadata?.renderedFromSessionId;
    const renderedAtRaw =
      previewLastRenderedFromSessionAt ||
      previewMetadata?.renderedAt ||
      sessionValidation?.previewState?.lastRenderedAt ||
      sessionValidation?.previewState?.renderedAt ||
      null;

    const renderedAtLabel = (() => {
      if (!renderedAtRaw) return "";
      const date = new Date(renderedAtRaw);
      if (Number.isNaN(date.getTime())) return String(renderedAtRaw);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    })();

    if (!renderedSessionId && !renderedAtLabel) return "-";
    if (!renderedSessionId) return renderedAtLabel;
    const compactSession =
      renderedSessionId.length > 10
        ? `${renderedSessionId.slice(0, 8)}…`
        : renderedSessionId;
    return renderedAtLabel
      ? `${compactSession} @ ${renderedAtLabel}`
      : compactSession;
  }, [
    previewLastRenderedSessionId,
    previewMetadata?.renderedFromSessionId,
    previewLastRenderedFromSessionAt,
    previewMetadata?.renderedAt,
    sessionValidation?.previewState,
  ]);

  const validationDetailEntries = useMemo(() => {
    const details = sessionValidation?.details;
    if (!details || typeof details !== "object" || Array.isArray(details)) {
      return [];
    }
    return Object.entries(details)
      .slice(0, 10)
      .map(([key, value]) => {
        if (value == null) return `${key}: -`;
        if (typeof value === "object") {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${String(value)}`;
      });
  }, [sessionValidation?.details]);

  // ── Scroll to section ──
  function scrollToSection(id) {
    setActiveSectionId(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Update a proposer row ──
  function updateProposer(idx, key, value) {
    setProposers((prev) => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [key]: value };
      return arr;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════

  if (loadingSession) {
    return (
      <ProtectedRoute allowedRoles={["admin"]}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-neon-400 border-t-transparent" />
            <p className="text-slate-300">Loading session data...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="flex gap-4 xl:gap-6 items-start w-full">
        {/* ── Sidebar navigation ── */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 px-3">
              Form Sections
            </h3>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSectionId === s.id
                    ? "bg-neon-500/20 text-neon-200 border border-neon-400/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-ink-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main form area ── */}
        <div className="flex-[1.15] min-w-0 space-y-6 pb-32">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-50 flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-2xl border border-amber-400/50 shadow-card">
                    📜
                  </span>
                  Form 2B — Nomination Paper
                </h1>
                <p className="text-slate-400 mt-2 ml-14">
                  Election to the Legislative Assembly. All fields are optional.
                  {sessionId && (
                    <span className="ml-2 text-emerald-400 text-xs">
                      Session: {sessionId.slice(0, 8)}…
                    </span>
                  )}
                </p>
                {schemaLoadError ? (
                  <p className="text-amber-300 text-xs mt-2 ml-14">
                    Schema warning: {schemaLoadError}
                  </p>
                ) : (
                  <p className="text-slate-500 text-xs mt-2 ml-14">
                    Form schema fields discovered: {schemaFieldCount ?? "-"}
                  </p>
                )}
                {saveError && (
                  <p className="text-rose-300 text-xs mt-2 ml-14">
                    Last save issue: {saveError}
                  </p>
                )}
                {lastSaveExportUrl && (
                  <p className="text-slate-500 text-xs mt-2 ml-14 break-all">
                    Export URL: {lastSaveExportUrl}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePreviewDocument}
                  className="btn btn-secondary text-sm"
                >
                  Preview Document
                </button>
                <Link
                  href="/admin/dashboard"
                  className="btn btn-secondary text-sm"
                >
                  ← Back
                </Link>
              </div>
            </div>
          </motion.div>

          <div className="lg:hidden card p-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMobileViewTab("form")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  mobileViewTab === "form"
                    ? "bg-neon-500/20 border border-neon-400/50 text-neon-100"
                    : "border border-ink-400 text-slate-300"
                }`}
              >
                Form
              </button>
              <button
                type="button"
                onClick={handlePreviewDocument}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  mobileViewTab === "preview"
                    ? "bg-neon-500/20 border border-neon-400/50 text-neon-100"
                    : "border border-ink-400 text-slate-300"
                }`}
              >
                Document Preview
              </button>
            </div>
          </div>

          <div
            className={
              mobileViewTab === "preview" ? "hidden lg:block" : "space-y-6"
            }
          >
            {/* ═══ Election Details (Header) ═══ */}
            <SectionCard
              id="header"
              title="Election Details"
              subtitle="FORM 2B — NOMINATION PAPER — [See rule 4 (1)] — Election to the Legislative Assembly of ____"
            >
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <Field
                  label='State (fills "Election to the Legislative Assembly of ____")'
                  placeholder='e.g. "WEST BENGAL"'
                  value={state}
                  onChange={setState}
                />
              </div>

              {/* Image Uploads */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 border-t border-ink-400 pt-4">
                <ImageUploadField
                  label="Candidate Photograph"
                  value={candidatePhotoUrl}
                  uploading={uploadingPhoto}
                  onFileSelect={(file) =>
                    handleImageUpload(file, "candidatePhotoUrl")
                  }
                  onClear={() => setCandidatePhotoUrl("")}
                />
                <ImageUploadField
                  label="Candidate Signature"
                  value={candidateSignatureUrl}
                  uploading={uploadingSignature}
                  onFileSelect={(file) =>
                    handleImageUpload(file, "candidateSignatureUrl")
                  }
                  onClear={() => setCandidateSignatureUrl("")}
                />
              </div>
            </SectionCard>

            {/* ═══ Part I — Recognised Party Nomination ═══ */}
            <SectionCard
              id="partI"
              title="Part I — Nomination by Recognised Political Party"
              subtitle="For use ONLY by a candidate set up by a recognised political party. One proposer suffices. If not applicable, leave blank and fill Part II instead."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Assembly Constituency"
                  value={partI_constituency}
                  onChange={setPartI_constituency}
                />
                <Field
                  label="Candidate's Name"
                  value={partI_candidateName}
                  onChange={setPartI_candidateName}
                />
                <Field
                  label="Father's / Mother's / Husband's Name"
                  value={partI_fatherName}
                  onChange={setPartI_fatherName}
                />
                <Field
                  label="Candidate's Sl. No. in Electoral Roll"
                  value={partI_candidateSlNo}
                  onChange={setPartI_candidateSlNo}
                />
                <Field
                  label="Candidate's Part No. in Electoral Roll"
                  value={partI_candidatePartNo}
                  onChange={setPartI_candidatePartNo}
                />
                <Field
                  label="Candidate's Electoral Roll Constituency"
                  value={partI_candidateConstituency}
                  onChange={setPartI_candidateConstituency}
                />
              </div>
              <TextareaField
                label="Postal Address"
                value={partI_postalAddress}
                onChange={setPartI_postalAddress}
                className="mt-4"
              />
              <div className="mt-6 border-t border-ink-400 pt-4">
                <h4 className="text-sm font-semibold text-slate-200 mb-3">
                  Proposer (Single Proposer for Recognised Party)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label="Proposer's Name"
                    value={partI_proposerName}
                    onChange={setPartI_proposerName}
                  />
                  <Field
                    label="Proposer's Sl. No. in Electoral Roll"
                    value={partI_proposerSlNo}
                    onChange={setPartI_proposerSlNo}
                  />
                  <Field
                    label="Proposer's Part No. in Electoral Roll"
                    value={partI_proposerPartNo}
                    onChange={setPartI_proposerPartNo}
                  />
                  <Field
                    label="Proposer's Electoral Roll Constituency"
                    value={partI_proposerConstituency}
                    onChange={setPartI_proposerConstituency}
                  />
                  <Field
                    label="Date"
                    value={partI_date}
                    onChange={setPartI_date}
                    placeholder="DD/MM/YYYY"
                  />
                </div>
              </div>
            </SectionCard>

            {/* ═══ Part II — Nomination by 10 Proposers ═══ */}
            <SectionCard
              id="partII"
              title="Part II — Nomination by 10 Proposers"
              subtitle="For use ONLY by a candidate NOT set up by a recognised political party. Requires 10 electors of the constituency as proposers. If not applicable, leave blank and fill Part I instead."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Assembly Constituency"
                  value={partII_constituency}
                  onChange={setPartII_constituency}
                />
                <Field
                  label="Candidate's Name"
                  value={partII_candidateName}
                  onChange={setPartII_candidateName}
                />
                <Field
                  label="Father's / Mother's / Husband's Name"
                  value={partII_fatherName}
                  onChange={setPartII_fatherName}
                />
                <Field
                  label="Candidate's Sl. No. in Electoral Roll"
                  value={partII_candidateSlNo}
                  onChange={setPartII_candidateSlNo}
                />
                <Field
                  label="Candidate's Part No. in Electoral Roll"
                  value={partII_candidatePartNo}
                  onChange={setPartII_candidatePartNo}
                />
                <Field
                  label="Candidate's Electoral Roll Constituency"
                  value={partII_candidateConstituency}
                  onChange={setPartII_candidateConstituency}
                />
              </div>
              <TextareaField
                label="Postal Address"
                value={partII_postalAddress}
                onChange={setPartII_postalAddress}
                className="mt-4"
              />

              {/* Proposers Table */}
              <div className="mt-6 border-t border-ink-400 pt-4">
                <h4 className="text-sm font-semibold text-slate-200 mb-3">
                  Particulars of the 10 Proposers and their Signatures
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-ink-100/60">
                        <th className="border border-ink-400 px-3 py-2 text-left text-slate-300 font-medium w-10">
                          #
                        </th>
                        <th className="border border-ink-400 px-3 py-2 text-left text-slate-300 font-medium">
                          Part No. of Electoral Roll
                        </th>
                        <th className="border border-ink-400 px-3 py-2 text-left text-slate-300 font-medium">
                          S.No. in that Part
                        </th>
                        <th className="border border-ink-400 px-3 py-2 text-left text-slate-300 font-medium">
                          Full Name
                        </th>
                        <th className="border border-ink-400 px-3 py-2 text-left text-slate-300 font-medium">
                          Signature
                        </th>
                        <th className="border border-ink-400 px-3 py-2 text-left text-slate-300 font-medium">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposers.map((p, idx) => (
                        <tr key={idx} className="hover:bg-ink-100/30">
                          <td className="border border-ink-400 px-3 py-1.5 text-slate-400 font-mono text-center">
                            {idx + 1}
                          </td>
                          {[
                            { key: "partNo", ph: "Part No." },
                            { key: "slNo", ph: "Sl. No." },
                            { key: "fullName", ph: "Full Name" },
                            { key: "signature", ph: "Signed / Thumb" },
                            { key: "date", ph: "DD/MM/YYYY" },
                          ].map((col) => (
                            <td
                              key={col.key}
                              className="border border-ink-400 px-1 py-1"
                            >
                              <input
                                type="text"
                                className="w-full text-sm border-0 bg-transparent focus:ring-1 focus:ring-neon-400 rounded px-2 py-1"
                                placeholder={col.ph}
                                value={p[col.key]}
                                onChange={(e) =>
                                  updateProposer(idx, col.key, e.target.value)
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </SectionCard>

            {/* ═══ Part III — Declaration by the Candidate ═══ */}
            <SectionCard
              id="partIII"
              title="Part III — Declaration by the Candidate"
              subtitle='"I, a candidate at the above election, do hereby declare—"'
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="(a) Age (completed years)"
                  value={age}
                  onChange={setAge}
                  placeholder="e.g. 52"
                />
                <Field
                  label="(c)(i) Recognised National/State Party Name"
                  value={recognisedParty}
                  onChange={setRecognisedParty}
                  placeholder="Fill if set up by recognised party"
                />
                <Field
                  label="(c)(ii) Unrecognised Party Name"
                  value={unrecognisedParty}
                  onChange={setUnrecognisedParty}
                  placeholder="Fill if set up by registered unrecognised party"
                />
                <Field
                  label="(d)(i) Symbol — First Choice"
                  value={symbol1}
                  onChange={setSymbol1}
                />
                <Field
                  label="(d)(ii) Symbol — Second Choice"
                  value={symbol2}
                  onChange={setSymbol2}
                />
                <Field
                  label="(d)(iii) Symbol — Third Choice"
                  value={symbol3}
                  onChange={setSymbol3}
                />
                <Field
                  label="(e) Name spelt in (Language)"
                  value={language}
                  onChange={setLanguage}
                  placeholder="e.g. Bengali"
                />
                <Field
                  label="(f) Caste/Tribe (if SC/ST)"
                  value={casteTribe}
                  onChange={setCasteTribe}
                  placeholder="Leave blank if not applicable"
                />
                <Field
                  label="(f) SC/ST of which State"
                  value={scStState}
                  onChange={setScStState}
                />
                <Field
                  label="(f) SC/ST in relation to (Area)"
                  value={scStArea}
                  onChange={setScStArea}
                />
                <Field
                  label="(h) Not nominated from more than 2 constituencies in State"
                  value={assemblyState}
                  onChange={setAssemblyState}
                  placeholder="State name"
                />
                <Field
                  label="Date"
                  value={partIII_date}
                  onChange={setPartIII_date}
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </SectionCard>

            {/* ═══ Part IIIA — Criminal Record & Disqualification ═══ */}
            <SectionCard
              id="partIIIA"
              title="Part IIIA — Criminal Record & Disqualification Declarations"
              subtitle="To be filled by the candidate. Declarations under RP Act 1951 (Sections 8, 8A, 9, 9A, 10, 10A)."
            >
              {/* Criminal Record */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-200 mb-3">
                  Criminal Record
                </h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Has the candidate been convicted?
                  </label>
                  <select
                    value={convicted}
                    onChange={(e) => setConvicted(e.target.value)}
                    className="w-full md:w-64"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <AnimatePresence>
                  {convicted === "Yes" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 border border-ink-400 rounded-xl p-4"
                    >
                      <TextareaField
                        label="Case/FIR No./Nos."
                        value={criminal_firNos}
                        onChange={setCriminal_firNos}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field
                          label="Police Station(s)"
                          value={criminal_policeStation}
                          onChange={setCriminal_policeStation}
                        />
                        <Field
                          label="District(s)"
                          value={criminal_district}
                          onChange={setCriminal_district}
                        />
                        <Field
                          label="State(s)"
                          value={criminal_state}
                          onChange={setCriminal_state}
                        />
                        <Field
                          label="Date(s) of conviction(s)"
                          value={criminal_convictionDates}
                          onChange={setCriminal_convictionDates}
                        />
                        <Field
                          label="Court(s) which convicted"
                          value={criminal_courts}
                          onChange={setCriminal_courts}
                        />
                        <Field
                          label="Date(s) of release from prison"
                          value={criminal_releaseDates}
                          onChange={setCriminal_releaseDates}
                        />
                      </div>
                      <TextareaField
                        label="Section(s) and description of offence"
                        value={criminal_sections}
                        onChange={setCriminal_sections}
                      />
                      <TextareaField
                        label="Punishment(s) imposed (period of imprisonment and/or fine)"
                        value={criminal_punishment}
                        onChange={setCriminal_punishment}
                      />
                      {/* Appeal sub-section */}
                      <div className="border-t border-ink-400 pt-4">
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-slate-300 mb-1">
                            Appeal(s)/Revision(s) filed?
                          </label>
                          <select
                            value={criminal_appealFiled}
                            onChange={(e) =>
                              setCriminal_appealFiled(e.target.value)
                            }
                            className="w-full md:w-64"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <AnimatePresence>
                          {criminal_appealFiled === "Yes" && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-4"
                            >
                              <TextareaField
                                label="Date and particulars of appeal(s)"
                                value={criminal_appealParticulars}
                                onChange={setCriminal_appealParticulars}
                              />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field
                                  label="Court(s) for appeal(s)"
                                  value={criminal_appealCourts}
                                  onChange={setCriminal_appealCourts}
                                />
                                <Field
                                  label="Appeal status (disposed of / pending)"
                                  value={criminal_appealStatus}
                                  onChange={setCriminal_appealStatus}
                                />
                                <Field
                                  label="Date(s) of disposal"
                                  value={criminal_disposalDates}
                                  onChange={setCriminal_disposalDates}
                                />
                              </div>
                              <TextareaField
                                label="Nature of order(s) passed"
                                value={criminal_orderNature}
                                onChange={setCriminal_orderNature}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Disqualification Declarations */}
              <div className="border-t border-ink-400 pt-6">
                <h4 className="text-sm font-semibold text-slate-200 mb-4">
                  Disqualification Declarations
                </h4>
                <div className="space-y-5">
                  <YesNoField
                    label="Holding office of profit under Government?"
                    value={officeOfProfit}
                    onChange={setOfficeOfProfit}
                    detailLabel="Details of office held"
                    detailValue={officeOfProfit_details}
                    onDetailChange={setOfficeOfProfit_details}
                    isTextarea
                  />
                  <YesNoField
                    label="Declared insolvent / undischarged?"
                    value={insolvency}
                    onChange={setInsolvency}
                    detailLabel="Discharged from insolvency?"
                    detailValue={insolvency_discharged}
                    onDetailChange={setInsolvency_discharged}
                  />
                  <YesNoField
                    label="Under allegiance to foreign country?"
                    value={foreignAllegiance}
                    onChange={setForeignAllegiance}
                    detailLabel="Foreign allegiance details"
                    detailValue={foreignAllegiance_details}
                    onDetailChange={setForeignAllegiance_details}
                  />
                  <YesNoField
                    label="Disqualified under Section 8A of RP Act?"
                    value={disqualification_8A}
                    onChange={setDisqualification_8A}
                    detailLabel="Period of disqualification"
                    detailValue={disqualification_period}
                    onDetailChange={setDisqualification_period}
                  />
                  <YesNoField
                    label="Dismissed for corruption/disloyalty to State?"
                    value={dismissalForCorruption}
                    onChange={setDismissalForCorruption}
                    detailLabel="Date of dismissal"
                    detailValue={dismissal_date}
                    onDetailChange={setDismissal_date}
                  />
                  <YesNoField
                    label="Subsisting government contracts?"
                    value={govContracts}
                    onChange={setGovContracts}
                    detailLabel="Government contract details"
                    detailValue={govContracts_details}
                    onDetailChange={setGovContracts_details}
                    isTextarea
                  />
                  <YesNoField
                    label="Managing agent/manager/secretary of company/corporation?"
                    value={managingAgent}
                    onChange={setManagingAgent}
                    detailLabel="Company/Corporation details"
                    detailValue={managingAgent_details}
                    onDetailChange={setManagingAgent_details}
                    isTextarea
                  />
                  <YesNoField
                    label="Disqualified under Section 10A?"
                    value={disqualification_10A}
                    onChange={setDisqualification_10A}
                    detailLabel="Date of disqualification under 10A"
                    detailValue={section10A_date}
                    onDetailChange={setSection10A_date}
                  />
                </div>
              </div>
            </SectionCard>

            {/* ═══ Part IIIA — Place & Date ═══ */}
            <div id="section-partIIIA-foot" className="card scroll-mt-24">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                Part IIIA — Place & Date
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Place"
                  value={partIIIA_place}
                  onChange={setPartIIIA_place}
                />
                <Field
                  label="Date"
                  value={partIIIA_date}
                  onChange={setPartIIIA_date}
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </div>

            {/* ═══ Part IV — Returning Officer's Record ═══ */}
            <SectionCard
              id="partIV"
              title="Part IV — Returning Officer's Record"
              subtitle="To be filled in by the Returning Officer."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Serial No. of Nomination Paper"
                  value={partIV_serialNo}
                  onChange={setPartIV_serialNo}
                />
                <Field
                  label="Hour of delivery"
                  value={partIV_hour}
                  onChange={setPartIV_hour}
                  placeholder="e.g. 11:00"
                />
                <Field
                  label="Date of delivery"
                  value={partIV_date}
                  onChange={setPartIV_date}
                  placeholder="DD/MM/YYYY"
                />
                <Field
                  label="Delivered by (candidate / proposer name)"
                  value={partIV_deliveredBy}
                  onChange={setPartIV_deliveredBy}
                  placeholder='e.g. "Candidate" or proposer name'
                />
                <Field
                  label="Returning Officer Date"
                  value={partIV_roDate}
                  onChange={setPartIV_roDate}
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </SectionCard>

            {/* ═══ Part V — Decision on Scrutiny ═══ */}
            <SectionCard
              id="partV"
              title="Part V — Decision of Returning Officer on Scrutiny"
              subtitle='"I have examined this nomination paper in accordance with section 36 of the RP Act, 1951 and decide as follows:—"'
            >
              <TextareaField
                label='Decision (e.g. "accepted" or "rejected on grounds of ____")'
                value={partV_decision}
                onChange={setPartV_decision}
                rows={4}
              />
              <Field
                label="Date"
                value={partV_date}
                onChange={setPartV_date}
                placeholder="DD/MM/YYYY"
                className="mt-4 md:w-1/2"
              />
            </SectionCard>

            {/* ═══ Part VI — Receipt & Notice of Scrutiny ═══ */}
            <SectionCard
              id="partVI"
              title="Part VI — Receipt for Nomination Paper and Notice of Scrutiny"
              subtitle="Receipt to be handed over to the person presenting the nomination paper."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Serial No. of Nomination Paper"
                  value={partVI_serialNo}
                  onChange={setPartVI_serialNo}
                />
                <Field
                  label="Candidate Name"
                  value={partVI_candidateName}
                  onChange={setPartVI_candidateName}
                />
                <Field
                  label="Assembly Constituency"
                  value={partVI_constituency}
                  onChange={setPartVI_constituency}
                />
                <Field
                  label="Hour of delivery"
                  value={partVI_hour}
                  onChange={setPartVI_hour}
                  placeholder="e.g. 11:00"
                />
                <Field
                  label="Date of delivery"
                  value={partVI_date}
                  onChange={setPartVI_date}
                  placeholder="DD/MM/YYYY"
                />
                <Field
                  label="Scrutiny Hour"
                  value={partVI_scrutinyHour}
                  onChange={setPartVI_scrutinyHour}
                  placeholder="e.g. 11:00"
                />
                <Field
                  label="Scrutiny Date"
                  value={partVI_scrutinyDate}
                  onChange={setPartVI_scrutinyDate}
                  placeholder="DD/MM/YYYY"
                />
                <Field
                  label="Scrutiny Place"
                  value={partVI_scrutinyPlace}
                  onChange={setPartVI_scrutinyPlace}
                  placeholder="e.g. Office of Returning Officer, Bidhannagar"
                />
                <Field
                  label="Returning Officer Date"
                  value={partVI_roDate}
                  onChange={setPartVI_roDate}
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </SectionCard>

            {/* Bottom spacer for sticky bar */}
            <div className="h-4" />
          </div>
        </div>

        <div
          className={`${mobileViewTab === "form" ? "hidden" : "flex"} lg:flex flex-col gap-4 lg:flex-[0.95] lg:min-w-[420px] w-full pb-32`}
        >
          <div className="card border-amber-400/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Document Preview
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Live preview uses unsaved payload. If that fails, preview
                  falls back to the latest saved session.
                </p>
              </div>
              {previewStale ? (
                <span className="badge border-amber-500/60 text-amber-200 bg-amber-500/10">
                  Stale preview
                </span>
              ) : (
                <span className="badge border-emerald-500/60 text-emerald-200 bg-emerald-500/10">
                  Up to date
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 xl:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2">
                <p className="text-slate-400">Pages</p>
                <p className="text-slate-100 font-semibold">
                  {previewEffectivePageCount}
                </p>
              </div>
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2">
                <p className="text-slate-400">Current</p>
                <p className="text-slate-100 font-semibold">
                  {Math.min(
                    previewCurrentPage || 1,
                    previewEffectivePageCount || 1,
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2">
                <p className="text-slate-400">Last saved</p>
                <p className="text-slate-100 font-semibold">{lastSavedText}</p>
              </div>
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2 break-all">
                <p className="text-slate-400">Last rendered from session</p>
                <p className="text-slate-100 font-semibold break-all">
                  {lastRenderedFromSessionText}
                </p>
              </div>
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2">
                <p className="text-slate-400">Validation</p>
                <p className="text-slate-100 font-semibold">
                  {validationLabel}
                  {validationLoading && (
                    <span className="text-slate-400 font-normal">
                      {" "}
                      (checking...)
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2">
                <p className="text-slate-400">Template audit</p>
                <p className="text-slate-100 font-semibold">
                  {templateAuditLabel}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePreviewDocument}
                disabled={previewLoading}
                className="btn btn-secondary text-xs"
              >
                {previewLoading ? "Generating..." : "Preview Document"}
              </button>
              <button
                type="button"
                onClick={handleRefreshPreview}
                disabled={previewLoading || saving}
                className="btn btn-secondary text-xs"
              >
                {previewLoading ? "Refreshing..." : "Refresh Preview"}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || saving}
                className="btn btn-secondary text-xs"
              >
                {exporting ? "Downloading..." : "Download DOCX"}
              </button>
              {previewBlobUrl && (
                <button
                  type="button"
                  onClick={downloadRenderedPreviewBlob}
                  className="btn btn-secondary text-xs"
                >
                  Download Preview DOCX
                </button>
              )}
            </div>

            {previewLoading && (
              <div className="mt-4 rounded-xl border border-ink-400 bg-ink-100/50 p-6 flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-amber-400 border-t-transparent" />
                <p className="text-xs text-slate-300">
                  Rendering DOCX preview from current nomination data...
                </p>
              </div>
            )}

            {previewError && (
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
                <p className="text-xs text-rose-100">{previewError}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshPreview}
                    className="btn btn-secondary text-xs"
                  >
                    Retry Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="btn btn-secondary text-xs"
                  >
                    Download DOCX
                  </button>
                </div>
              </div>
            )}

            {!previewLoading && !previewError && !previewBlobUrl && (
              <div className="mt-4 rounded-xl border border-ink-400 bg-ink-100/40 p-5 text-center">
                <p className="text-xs text-slate-400">
                  No preview generated yet. Click Preview Document to render the
                  current form data without saving.
                </p>
              </div>
            )}

            {previewBlobUrl && (
              <div
                ref={previewScrollRef}
                className="mt-4 max-h-[70vh] overflow-auto rounded-xl border border-ink-400 bg-ink-100/30 p-3"
              >
                <div ref={previewHostRef} className="docx-preview-host" />
              </div>
            )}

            {previewRenderError && (
              <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="text-xs text-amber-100">{previewRenderError}</p>
                <p className="text-xs text-amber-200 mt-1">
                  Browser rendering failed, but DOCX download remains available.
                </p>
              </div>
            )}

            {previewLastRefreshedAt && (
              <p className="text-xs text-slate-500 mt-3">
                Last preview refresh:{" "}
                {new Date(previewLastRefreshedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}

            {previewSource !== "none" && (
              <p className="text-xs text-slate-500 mt-2">
                Preview source:{" "}
                {previewSource === "payload" ? "Live payload" : "Saved session"}
              </p>
            )}
          </div>

          <div className="card border-ink-400/80">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Persistence and Validation
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Save status: {persistenceStatusLabel} | Last saved:{" "}
                  {lastSavedText}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={strictTemplateAudit}
                  onChange={(e) => setStrictTemplateAudit(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-400 bg-ink-100"
                />
                Strict template audit on export
              </label>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2">
                <p className="text-slate-400">Expected persisted</p>
                <p className="text-slate-100 font-semibold">
                  {saveExpectedCount ?? "-"}
                </p>
              </div>
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2">
                <p className="text-slate-400">Saved</p>
                <p className="text-slate-100 font-semibold">
                  {savePersistedCount ?? "-"}
                </p>
              </div>
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2">
                <p className="text-slate-400">Missing persisted fields</p>
                <p className="text-slate-100 font-semibold">
                  {persistedMissingFields.length}
                </p>
              </div>
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2">
                <p className="text-slate-400">Missing required labels</p>
                <p className="text-slate-100 font-semibold">
                  {effectiveMissingRequired.length}
                </p>
              </div>
            </div>

            {saveError && (
              <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-100">
                Save issue: {saveError}
              </div>
            )}

            {sessionValidation?.error && (
              <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                Validation issue: {sessionValidation.error}
              </div>
            )}

            {previewMetadata?.error && (
              <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                Preview metadata issue: {previewMetadata.error}
              </div>
            )}

            {persistedMissingFields.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                  DB audit missing fields
                </p>
                <ul className="mt-1 text-xs text-amber-100 space-y-1 max-h-24 overflow-auto pr-1">
                  {persistedMissingFields.slice(0, 10).map((field, idx) => (
                    <li key={`${field}-${idx}`}>• {String(field)}</li>
                  ))}
                </ul>
              </div>
            )}

            {effectiveMissingRequired.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                  Missing required labels
                </p>
                <ul className="mt-1 text-xs text-amber-100 space-y-1 max-h-24 overflow-auto pr-1">
                  {effectiveMissingRequired.slice(0, 10).map((field, idx) => (
                    <li key={`${field}-${idx}`}>• {String(field)}</li>
                  ))}
                </ul>
              </div>
            )}

            {templateAuditWarnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-blue-400/40 bg-blue-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                  Template audit warnings
                </p>
                <ul className="mt-1 text-xs text-blue-100 space-y-1 max-h-24 overflow-auto pr-1">
                  {templateAuditWarnings.slice(0, 10).map((line, idx) => (
                    <li key={`template-warning-${idx}`}>• {line}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationDetailEntries.length > 0 && (
              <div className="mt-3 rounded-lg border border-ink-400 bg-ink-100/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Validation details
                </p>
                <ul className="mt-1 text-xs text-slate-200 space-y-1 max-h-24 overflow-auto pr-1">
                  {validationDetailEntries.map((line, idx) => (
                    <li key={`validation-detail-${idx}`}>• {line}</li>
                  ))}
                </ul>
              </div>
            )}

            {(saveDiagnostics?.previewUrl ||
              saveDiagnostics?.validationUrl) && (
              <div className="mt-3 space-y-1">
                {saveDiagnostics?.previewUrl && (
                  <p className="text-xs text-slate-400 break-all">
                    Preview URL: {saveDiagnostics.previewUrl}
                  </p>
                )}
                {saveDiagnostics?.validationUrl && (
                  <p className="text-xs text-slate-400 break-all">
                    Validation URL: {saveDiagnostics.validationUrl}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="card border-ink-400/80">
            <h2 className="text-sm font-semibold text-slate-100">
              Session Management
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Search, open, rename, and delete nomination sessions.
            </p>

            <form
              onSubmit={handleSessionSearchSubmit}
              className="mt-3 space-y-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Search candidate"
                  value={sessionSearch.candidate}
                  onChange={(e) =>
                    setSessionSearch((prev) => ({
                      ...prev,
                      candidate: e.target.value,
                    }))
                  }
                />
                <input
                  type="text"
                  placeholder="Search party"
                  value={sessionSearch.party}
                  onChange={(e) =>
                    setSessionSearch((prev) => ({
                      ...prev,
                      party: e.target.value,
                    }))
                  }
                />
                <input
                  type="text"
                  placeholder="Search constituency"
                  value={sessionSearch.constituency}
                  onChange={(e) =>
                    setSessionSearch((prev) => ({
                      ...prev,
                      constituency: e.target.value,
                    }))
                  }
                />
                <input
                  type="text"
                  placeholder="Search state"
                  value={sessionSearch.state}
                  onChange={(e) =>
                    setSessionSearch((prev) => ({
                      ...prev,
                      state: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={sessionSearchLoading}
                  className="btn btn-secondary text-xs"
                >
                  {sessionSearchLoading ? "Searching..." : "Search Sessions"}
                </button>
                <button
                  type="button"
                  onClick={handleSessionSearchReset}
                  className="btn btn-secondary text-xs"
                >
                  Reset
                </button>
              </div>
            </form>

            {sessionListError && (
              <p className="text-xs text-rose-200 mt-3">{sessionListError}</p>
            )}

            {sessionListLoading ? (
              <p className="text-xs text-slate-400 mt-3">Loading sessions...</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-slate-400 mt-3">
                No nomination sessions found.
              </p>
            ) : (
              <div className="mt-3 space-y-2 max-h-[36vh] overflow-auto pr-1">
                {sessions.map((entry, idx) => {
                  const entryId = String(
                    entry?.id || entry?._id || entry?.sessionId || "",
                  );
                  const candidate =
                    entry?.candidateName ||
                    entry?.candidate ||
                    entry?.name ||
                    "Unnamed candidate";
                  const partyName = entry?.party || "-";
                  const constituencyName = entry?.constituency || "-";
                  const stateName = entry?.state || "-";

                  return (
                    <div
                      key={entryId || idx}
                      className="rounded-xl border border-ink-400 bg-ink-100/50 p-3"
                    >
                      <p className="text-sm text-slate-100 font-semibold truncate">
                        {candidate}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Party: {partyName} | Constituency: {constituencyName}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 break-all">
                        State: {stateName} | Session: {entryId || "-"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenSession(entryId)}
                          disabled={!entryId}
                          className="btn btn-secondary text-xs"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRenameSession(entry)}
                          disabled={
                            !entryId ||
                            sessionActionLoading === `rename-${entryId}`
                          }
                          className="btn btn-secondary text-xs"
                        >
                          {sessionActionLoading === `rename-${entryId}`
                            ? "Renaming..."
                            : "Rename"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(entry)}
                          disabled={
                            !entryId ||
                            sessionActionLoading === `delete-${entryId}`
                          }
                          className="btn btn-secondary text-xs"
                        >
                          {sessionActionLoading === `delete-${entryId}`
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky action bar ── */}
      <div className="fixed bottom-12 left-0 right-0 z-40">
        <div className="mx-auto max-w-7xl px-4">
          <div className="bg-ink-200/95 backdrop-blur border border-ink-400 rounded-2xl shadow-xl px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p className="text-xs text-slate-500">
              Form 2B workflow | Last saved: {lastSavedText} | Persistence:{" "}
              {persistenceStatusLabel} | Validation: {validationLabel}
              {previewStale ? (
                <span className="text-amber-300 ml-2">Preview stale</span>
              ) : (
                <span className="text-emerald-300 ml-2">Preview current</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2 md:gap-3">
              <button
                type="button"
                onClick={handlePreviewDocument}
                disabled={previewLoading}
                className="btn btn-secondary text-sm"
              >
                {previewLoading ? "Generating..." : "Preview Document"}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSave({ showToast: true }).catch(() => {});
                }}
                disabled={saving}
                className="btn bg-neon-600 hover:bg-neon-500 text-white text-sm shadow-card"
              >
                {saving ? "Saving..." : "Save Nomination"}
              </button>
              <button
                type="button"
                onClick={handleRefreshPreview}
                disabled={previewLoading || saving}
                className="btn btn-secondary text-sm"
              >
                {previewLoading ? "Refreshing..." : "Refresh Preview"}
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || saving}
                className="btn bg-emerald-600 hover:bg-emerald-500 text-white text-sm shadow-card"
              >
                {exporting ? "Downloading..." : "Download DOCX"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

NominationManualEntryPage.getLayout = function getLayout(page) {
  return <Layout fullWidth>{page}</Layout>;
};

// ═══════════════════════════════════════════════════════════════════
//  Reusable sub-components
// ═══════════════════════════════════════════════════════════════════

function SectionCard({ id, title, subtitle, children }) {
  return (
    <motion.div
      id={`section-${id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card scroll-mt-24"
    >
      <h2 className="text-lg font-semibold text-slate-100 mb-1">{title}</h2>
      {subtitle && (
        <p className="text-xs text-slate-500 italic mb-4">{subtitle}</p>
      )}
      {children}
    </motion.div>
  );
}

function Field({ label, value, onChange, placeholder, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full"
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  className = "",
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full"
      />
    </div>
  );
}

function ImageUploadField({ label, value, uploading, onFileSelect, onClear }) {
  const fileRef = useRef(null);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {label}
      </label>
      {value ? (
        <div className="flex items-start gap-3">
          <img
            src={value}
            alt={label}
            className="h-24 w-24 object-cover rounded-lg border border-ink-400"
          />
          <button
            type="button"
            onClick={onClear}
            className="text-rose-400 hover:text-rose-300 text-xs mt-1"
          >
            ✕ Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) onFileSelect(e.target.files[0]);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="btn btn-secondary text-sm"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Uploading...
              </span>
            ) : (
              "📷 Upload Image"
            )}
          </button>
          <span className="text-xs text-slate-500">JPEG or PNG, max 5 MB</span>
        </div>
      )}
    </div>
  );
}

function YesNoField({
  label,
  value,
  onChange,
  detailLabel,
  detailValue,
  onDetailChange,
  isTextarea = false,
}) {
  return (
    <div className="border border-ink-400 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="flex-1 text-sm font-medium text-slate-300">
          {label}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full sm:w-32"
        >
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      </div>
      <AnimatePresence>
        {value === "Yes" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3"
          >
            {isTextarea ? (
              <TextareaField
                label={detailLabel}
                value={detailValue}
                onChange={onDetailChange}
              />
            ) : (
              <Field
                label={detailLabel}
                value={detailValue}
                onChange={onDetailChange}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
