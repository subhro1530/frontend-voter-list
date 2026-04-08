import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import ProtectedRoute from "../../components/ProtectedRoute";
import Layout from "../../components/Layout";
import { affidavitAPI } from "../../lib/api";
import toast from "react-hot-toast";

// ─── Default structures ────────────────────────────────────────────

const DEFAULT_PAN_ENTRY = (slNo, label) => ({
  slNo: String(slNo),
  name: "",
  pan: "",
  label,
  years: [{ year: "", income: "" }],
});

const PAN_PERSONS = [
  "Self",
  "Spouse",
  "HUF (If Candidate is Karta/Coparcener)",
  "Dependent 1",
  "Dependent 2",
  "Dependent 3",
];

const DEFAULT_PENDING_CASE = () => ({
  firNo: "",
  caseNo: "",
  sections: "",
  description: "",
  chargesFramed: "",
  chargesDate: "",
  appealFiled: "",
});

const DEFAULT_CONVICTION = () => ({
  caseNo: "",
  courtName: "",
  sections: "",
  description: "",
  convictionDate: "",
  punishment: "",
  appealFiled: "",
  appealStatus: "",
});

const DEFAULT_PROPERTY = () => ({
  location: "",
  surveyNo: "",
  area: "",
  inherited: "",
  purchaseDate: "",
  purchaseCost: "",
  investment: "",
  marketValue: "",
});

const MOVABLE_ASSET_ROWS = [
  { key: "cash", label: "(i) Cash in hand" },
  {
    key: "bank",
    label:
      "(ii) Deposits in Bank accounts (FDRs, Term Deposits, Savings, etc.)",
  },
  {
    key: "bonds",
    label: "(iii) Investment in Bonds, Debentures, Shares, Units, Mutual Funds",
  },
  {
    key: "nss",
    label:
      "(iv) NSS, Postal Savings, Insurance Policies, Post Office/Insurance investments",
  },
  {
    key: "loans",
    label:
      "(v) Personal loans/advances given to any person or entity, receivables",
  },
  {
    key: "motor",
    label:
      "(vi) Motor Vehicles/Aircrafts/Yachts/Ships (Make, Reg. No., Year, Amount)",
  },
  {
    key: "jewell",
    label: "(vii) Jewellery, bullion and valuable things (weight and value)",
  },
  {
    key: "other",
    label: "(viii) Any other assets such as value of claims/interest",
  },
  { key: "total", label: "(ix) Gross Total Value" },
];

const PERSON_SUFFIXES = ["Self", "Spouse", "HUF", "Dep1", "Dep2", "Dep3"];

const LIABILITY_ROWS = [
  {
    key: "bankLoans",
    label: "(i) Loans/dues to Banks/FIs (Name, Amount, Nature)",
  },
  {
    key: "otherLoans",
    label: "(ii) Loans/dues to other individuals/entities",
  },
  { key: "otherLiab", label: "(iii) Any other liability" },
  { key: "total", label: "(iv) Grand Total of Liabilities" },
];

const GOVT_DUES_ROWS = [
  { key: "transport", label: "(iii) Dues to Govt. transport department" },
  { key: "incomeTax", label: "(iv) Income Tax dues" },
  { key: "gst", label: "(v) GST dues" },
  { key: "municipal", label: "(vi) Municipal/Property tax dues" },
  { key: "other", label: "(vii) Any other dues" },
  { key: "total", label: "(viii) Grand Total of Government Dues" },
];

const IMMOVABLE_CATEGORIES = [
  { id: "agricultural", label: "(i) Agricultural Land" },
  { id: "nonAgricultural", label: "(ii) Non-Agricultural Land" },
  {
    id: "commercial",
    label: "(iii) Commercial Buildings (including apartments)",
  },
  {
    id: "residential",
    label: "(iv) Residential Buildings (including apartments)",
  },
  { id: "others", label: "(v) Others (such as interest in property)" },
];

// ─── Section nav ────────────────────────────────────────────────────

const SECTIONS = [
  { id: "election", label: "1. Election Details" },
  { id: "personal", label: "2. Personal Details" },
  { id: "pan", label: "3. PAN & Income Tax" },
  { id: "pending", label: "4. Pending Criminal Cases" },
  { id: "convictions", label: "5. Cases of Conviction" },
  { id: "partyInfo", label: "6. Party Information (6A)" },
  { id: "movable", label: "7. Movable Assets" },
  { id: "immovable", label: "8. Immovable Assets" },
  { id: "liabilities", label: "9. Liabilities" },
  { id: "govtDues", label: "10. Government Dues" },
  { id: "disputedLiab", label: "10A. Disputed Liabilities" },
  { id: "govtAccom", label: "11. Govt. Accommodation" },
  { id: "profession", label: "12. Profession & Income" },
  { id: "contracts", label: "13. Contracts with Govt." },
  { id: "education", label: "14. Education" },
  { id: "verification", label: "15. Verification" },
  { id: "oathCommissioner", label: "16. Oath Commissioner" },
];

const HIGH_IMPACT_FIELDS = [
  { path: "houseName", label: "Name of the House" },
  { path: "constituency", label: "Constituency Name" },
  { path: "candidateName", label: "Candidate Full Name" },
  {
    path: "fatherMotherHusbandName",
    label: "Father's / Mother's / Husband's Name",
  },
  { path: "postalAddress", label: "Full Postal Address" },
  { path: "verificationPlace", label: "Place of Verification" },
  { path: "verificationDate", label: "Date of Verification" },
  {
    path: "oathCommissionerName",
    label: "Name of Oath Commissioner / Notary",
  },
  { path: "oathCommissionerDesignation", label: "Designation" },
];

const CALLOUT_PATHS = new Set([
  "houseName",
  "constituency",
  "state",
  "candidateName",
  "fatherMotherHusbandName",
  "age",
  "postalAddress",
  "party",
  "verificationPlace",
  "verificationDate",
  "oathCommissionerName",
  "oathCommissionerDesignation",
  "oathCommissionerSealNo",
]);

const PLACEMENT_GROUPS = [
  {
    id: "candidate-election",
    title: "Candidate & Election",
    matcher: (path) =>
      [
        "houseName",
        "constituency",
        "state",
        "candidateName",
        "fatherMotherHusbandName",
        "age",
        "postalAddress",
        "party",
        "isIndependent",
        "enrolledConstituency",
        "serialNumber",
        "partNumber",
        "telephone",
        "email",
        "socialMedia1",
        "socialMedia2",
        "socialMedia3",
      ].some((key) => path === key || path.startsWith(`${key}.`)),
  },
  {
    id: "criminal-assets-liabilities",
    title: "Criminal / Assets / Liabilities tables",
    matcher: (path) =>
      [
        "panEntries",
        "hasPendingCases",
        "pendingCases",
        "hasConvictions",
        "convictions",
        "informedParty",
        "movableAssets",
        "immovableAssets",
        "liabilities",
        "governmentDues",
        "disputedLiabilities",
        "governmentAccommodation",
        "selfProfession",
        "spouseProfession",
        "selfIncome",
        "spouseIncome",
        "dependentIncome",
        "contractsCandidate",
        "contractsSpouse",
        "contractsDependents",
        "contractsHUF",
        "contractsPartnershipFirms",
        "contractsPrivateCompanies",
        "educationalQualification",
      ].some((key) => path === key || path.startsWith(`${key}.`)),
  },
  {
    id: "verification",
    title: "Verification / Oath Commissioner",
    matcher: (path) =>
      [
        "verificationPlace",
        "verificationDate",
        "oathCommissionerName",
        "oathCommissionerDesignation",
        "oathCommissionerSealNo",
      ].some((key) => path === key || path.startsWith(`${key}.`)),
  },
  {
    id: "raw-dump",
    title: "Raw Input Field Dump",
    matcher: () => true,
  },
];

const SCHEMA_META_KEYS = new Set([
  "type",
  "description",
  "title",
  "required",
  "enum",
  "default",
  "items",
  "properties",
  "$schema",
  "$id",
  "examples",
  "nullable",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
]);

const KNOWN_SCALAR_PATHS = new Set([
  "houseName",
  "constituency",
  "state",
  "candidateName",
  "fatherMotherHusbandName",
  "age",
  "postalAddress",
  "party",
  "isIndependent",
  "enrolledConstituency",
  "serialNumber",
  "partNumber",
  "telephone",
  "email",
  "socialMedia1",
  "socialMedia2",
  "socialMedia3",
  "candidatePhotoUrl",
  "candidateSignatureUrl",
  "hasPendingCases",
  "hasConvictions",
  "informedParty",
  "disputedLiabilities",
  "selfProfession",
  "spouseProfession",
  "selfIncome",
  "spouseIncome",
  "dependentIncome",
  "contractsCandidate",
  "contractsSpouse",
  "contractsDependents",
  "contractsHUF",
  "contractsPartnershipFirms",
  "contractsPrivateCompanies",
  "educationalQualification",
  "verificationPlace",
  "verificationDate",
  "oathCommissionerName",
  "oathCommissionerDesignation",
  "oathCommissionerSealNo",
  "governmentAccommodation.occupied",
  "governmentAccommodation.address",
  "governmentAccommodation.noDues",
  "governmentAccommodation.duesDate",
  "governmentAccommodation.rentDues",
  "governmentAccommodation.electricityDues",
  "governmentAccommodation.waterDues",
  "governmentAccommodation.telephoneDues",
]);

const KNOWN_DYNAMIC_PREFIXES = [
  "panEntries",
  "pendingCases",
  "convictions",
  "movableAssets",
  "immovableAssets",
  "liabilities",
  "governmentDues",
];

function parsePathSegments(path) {
  if (!path) return [];
  const segments = [];
  path.split(".").forEach((part) => {
    const matches = part.match(/[^\[\]]+|\[(\d*)\]/g) || [];
    matches.forEach((token) => {
      if (token.startsWith("[")) {
        const index = token.replace(/[\[\]]/g, "");
        segments.push(index === "" ? 0 : Number(index));
      } else {
        segments.push(token);
      }
    });
  });
  return segments;
}

function getPathValue(obj, path) {
  return parsePathSegments(path).reduce((acc, segment) => {
    if (acc == null) return undefined;
    return acc[segment];
  }, obj);
}

function setPathValue(target, path, value) {
  const segments = parsePathSegments(path);
  if (!segments.length) return;
  let cursor = target;
  for (let i = 0; i < segments.length; i += 1) {
    const key = segments[i];
    const isLast = i === segments.length - 1;
    const next = segments[i + 1];
    if (isLast) {
      cursor[key] = value;
      return;
    }
    if (cursor[key] == null) {
      cursor[key] = typeof next === "number" ? [] : {};
    }
    cursor = cursor[key];
  }
}

function isValueFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some((item) => isValueFilled(item));
  if (typeof value === "object") {
    return Object.values(value).some((item) => isValueFilled(item));
  }
  return false;
}

function flattenLeafValues(source, basePath = "", acc = []) {
  if (Array.isArray(source)) {
    source.forEach((item, idx) => {
      flattenLeafValues(item, `${basePath}[${idx}]`, acc);
    });
    if (!source.length && basePath) acc.push({ path: basePath, value: "" });
    return acc;
  }
  if (source && typeof source === "object") {
    const entries = Object.entries(source);
    if (!entries.length && basePath) {
      acc.push({ path: basePath, value: "" });
      return acc;
    }
    entries.forEach(([key, value]) => {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      flattenLeafValues(value, nextPath, acc);
    });
    return acc;
  }
  if (basePath) acc.push({ path: basePath, value: source });
  return acc;
}

function collectSchemaLeafPaths(node, basePath = "", acc = []) {
  if (!node) return acc;

  if (Array.isArray(node)) {
    if (!node.length && basePath) acc.push(basePath);
    node.forEach((item, idx) => {
      const arrayPath = basePath ? `${basePath}[${idx}]` : `[${idx}]`;
      collectSchemaLeafPaths(item, arrayPath, acc);
    });
    return acc;
  }

  if (typeof node !== "object") {
    if (basePath) acc.push(basePath);
    return acc;
  }

  if (Array.isArray(node.fields)) {
    node.fields.forEach((field) => {
      const explicitPath = field.path || field.name || field.key;
      if (!explicitPath) return;
      const fieldPath = basePath ? `${basePath}.${explicitPath}` : explicitPath;
      if (field.type === "object" || field.properties || field.fields) {
        collectSchemaLeafPaths(field, fieldPath, acc);
      } else if (field.type === "array") {
        collectSchemaLeafPaths(field.items || {}, `${fieldPath}[]`, acc);
      } else {
        acc.push(fieldPath);
      }
    });
    return acc;
  }

  if (node.properties && typeof node.properties === "object") {
    Object.entries(node.properties).forEach(([key, child]) => {
      const childPath = basePath ? `${basePath}.${key}` : key;
      collectSchemaLeafPaths(child, childPath, acc);
    });
    return acc;
  }

  if (node.type === "array" || node.items) {
    collectSchemaLeafPaths(node.items || {}, `${basePath}[]`, acc);
    return acc;
  }

  if (node.type && node.type !== "object") {
    if (basePath) acc.push(basePath);
    return acc;
  }

  const childEntries = Object.entries(node).filter(
    ([key]) => !SCHEMA_META_KEYS.has(key),
  );
  if (childEntries.length) {
    childEntries.forEach(([key, value]) => {
      const childPath = basePath ? `${basePath}.${key}` : key;
      collectSchemaLeafPaths(value, childPath, acc);
    });
    return acc;
  }

  if (basePath) acc.push(basePath);
  return acc;
}

function isKnownSchemaPath(path) {
  if (!path || path === "sessionId") return true;
  const normalized = path.replace(/\[\d*\]/g, "");
  if (KNOWN_SCALAR_PATHS.has(normalized)) return true;
  return KNOWN_DYNAMIC_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}.`),
  );
}

function classifyPlacement(path) {
  const group =
    PLACEMENT_GROUPS.find((candidate) => candidate.matcher(path)) ||
    PLACEMENT_GROUPS[PLACEMENT_GROUPS.length - 1];
  const destinations = ["Summary"];
  if (group.id !== "raw-dump") destinations.unshift("Template");
  if (CALLOUT_PATHS.has(path)) destinations.splice(1, 0, "Callout");
  return {
    groupId: group.id,
    groupTitle: group.title,
    destinations,
  };
}

function prettifyPathLabel(path) {
  const last = path
    .replace(/\[\d+\]/g, "")
    .split(".")
    .filter(Boolean)
    .pop();
  if (!last) return path;
  return last
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
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

function pickFirstFiniteNumber(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function normalizeMissingFieldList(rawValue) {
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => String(item));
  }
  if (typeof rawValue === "string") {
    return rawValue
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeDbAudit(rawAudit) {
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

// ═══════════════════════════════════════════════════════════════════
//  PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function ManualEntryPage() {
  const router = useRouter();
  const { sessionId: querySessionId } = router.query;
  useAuth();

  // ── form state ──
  const [sessionId, setSessionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);

  // Section 1
  const [houseName, setHouseName] = useState("");
  const [constituency, setConstituency] = useState("");
  const [state, setState] = useState("");

  // Section 2
  const [candidateName, setCandidateName] = useState("");
  const [fatherMotherHusbandName, setFatherMotherHusbandName] = useState("");
  const [age, setAge] = useState("");
  const [postalAddress, setPostalAddress] = useState("");
  const [party, setParty] = useState("");
  const [isIndependent, setIsIndependent] = useState(false);
  const [enrolledConstituency, setEnrolledConstituency] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [socialMedia1, setSocialMedia1] = useState("");
  const [socialMedia2, setSocialMedia2] = useState("");
  const [socialMedia3, setSocialMedia3] = useState("");
  const [candidatePhotoUrl, setCandidatePhotoUrl] = useState("");
  const [candidateSignatureUrl, setCandidateSignatureUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  // Section 3
  const [panEntries, setPanEntries] = useState(
    PAN_PERSONS.map((label, i) => DEFAULT_PAN_ENTRY(i + 1, label)),
  );

  // Section 4
  const [hasPendingCases, setHasPendingCases] = useState("No");
  const [pendingCases, setPendingCases] = useState([]);

  // Section 5
  const [hasConvictions, setHasConvictions] = useState("No");
  const [convictions, setConvictions] = useState([]);

  // Section 6
  const [informedParty, setInformedParty] = useState("");

  // Section 7
  const [movableAssets, setMovableAssets] = useState({});

  // Section 8
  const [immovableAssets, setImmovableAssets] = useState({
    agricultural: [],
    nonAgricultural: [],
    commercial: [],
    residential: [],
    others: [],
  });

  // Section 9
  const [liabilities, setLiabilities] = useState({});

  // Section 10
  const [governmentDues, setGovernmentDues] = useState({});

  // Section 10A
  const [disputedLiabilities, setDisputedLiabilities] = useState("");

  // Section 11
  const [governmentAccommodation, setGovernmentAccommodation] = useState({
    occupied: "No",
    address: "",
    noDues: "No",
    duesDate: "",
    rentDues: "",
    electricityDues: "",
    waterDues: "",
    telephoneDues: "",
  });

  // Section 12
  const [selfProfession, setSelfProfession] = useState("");
  const [spouseProfession, setSpouseProfession] = useState("");
  const [selfIncome, setSelfIncome] = useState("");
  const [spouseIncome, setSpouseIncome] = useState("");
  const [dependentIncome, setDependentIncome] = useState("");

  // Section 13
  const [contractsCandidate, setContractsCandidate] = useState("");
  const [contractsSpouse, setContractsSpouse] = useState("");
  const [contractsDependents, setContractsDependents] = useState("");
  const [contractsHUF, setContractsHUF] = useState("");
  const [contractsPartnershipFirms, setContractsPartnershipFirms] =
    useState("");
  const [contractsPrivateCompanies, setContractsPrivateCompanies] =
    useState("");

  // Section 14
  const [educationalQualification, setEducationalQualification] = useState("");

  // Section 15
  const [verificationPlace, setVerificationPlace] = useState("");
  const [verificationDate, setVerificationDate] = useState("");

  // Section 16
  const [oathCommissionerName, setOathCommissionerName] = useState("");
  const [oathCommissionerDesignation, setOathCommissionerDesignation] =
    useState("");
  const [oathCommissionerSealNo, setOathCommissionerSealNo] = useState("");

  // ── Nav state ──
  const [activeSectionId, setActiveSectionId] = useState("election");
  const [expandedImmovable, setExpandedImmovable] = useState({});
  const [expandedPan, setExpandedPan] = useState({ 0: true });
  const [schemaPaths, setSchemaPaths] = useState([]);
  const [schemaLoadError, setSchemaLoadError] = useState("");
  const [sessionFormData, setSessionFormData] = useState(null);
  const [additionalFieldValues, setAdditionalFieldValues] = useState({});
  const [showExportChecklist, setShowExportChecklist] = useState(false);
  const [saveDiagnostics, setSaveDiagnostics] = useState(null);
  const [strictTemplateAudit, setStrictTemplateAudit] = useState(false);
  const [mobileViewTab, setMobileViewTab] = useState("form");
  const [validationIssues, setValidationIssues] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewRenderError, setPreviewRenderError] = useState("");
  const [previewBlobUrl, setPreviewBlobUrl] = useState("");
  const [previewPageCount, setPreviewPageCount] = useState(0);
  const [previewCurrentPage, setPreviewCurrentPage] = useState(1);
  const [previewLastRefreshedAt, setPreviewLastRefreshedAt] = useState(null);
  const [previewStale, setPreviewStale] = useState(true);
  const [sessionValidation, setSessionValidation] = useState({
    valid: null,
    missingRequired: [],
    totalFieldEntries: null,
    details: null,
    templateAudit: null,
    lastCheckedAt: null,
    error: "",
  });
  const [validationLoading, setValidationLoading] = useState(false);
  const previewHostRef = useRef(null);
  const previewScrollRef = useRef(null);
  const previewRequestIdRef = useRef(0);
  const previewAbortRef = useRef(null);
  const previewBlobUrlRef = useRef("");
  const lastPreviewDigestRef = useRef("");

  // ── Load backend schema for completeness and fallback fields ──
  useEffect(() => {
    let cancelled = false;
    affidavitAPI
      .getFormSchema()
      .then((schemaRes) => {
        if (cancelled) return;
        const schemaRoot =
          schemaRes?.schema || schemaRes?.formSchema || schemaRes;
        const rawPaths = collectSchemaLeafPaths(schemaRoot || {});
        const uniquePaths = [...new Set(rawPaths)].filter(Boolean).sort();
        setSchemaPaths(uniquePaths);
      })
      .catch((err) => {
        if (cancelled) return;
        setSchemaLoadError(err?.message || "Could not load affidavit schema");
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // ── Load existing session ──
  useEffect(() => {
    if (!querySessionId) return;
    setLoadingSession(true);
    affidavitAPI
      .getSession(querySessionId)
      .then((data) => {
        setSessionId(querySessionId);
        const d = data.formData || data.session?.formData || data || {};
        setSessionFormData(d);
        populateForm(d);
        refreshSessionValidation(querySessionId);
      })
      .catch((err) =>
        toast.error("Failed to load session: " + (err.message || "")),
      )
      .finally(() => setLoadingSession(false));
  }, [querySessionId]);

  const additionalSchemaPaths = useMemo(
    () => schemaPaths.filter((path) => !isKnownSchemaPath(path)),
    [schemaPaths],
  );

  const loadedUnknownPaths = useMemo(() => {
    if (!sessionFormData) return [];
    return [
      ...new Set(
        flattenLeafValues(sessionFormData)
          .map((entry) => entry.path)
          .filter((path) => path && !isKnownSchemaPath(path)),
      ),
    ].sort();
  }, [sessionFormData]);

  const additionalFieldPaths = useMemo(
    () =>
      [...new Set([...additionalSchemaPaths, ...loadedUnknownPaths])].sort(),
    [additionalSchemaPaths, loadedUnknownPaths],
  );

  useEffect(() => {
    if (!additionalFieldPaths.length) return;
    setAdditionalFieldValues((prev) => {
      let changed = false;
      const next = { ...prev };
      const source = sessionFormData || {};
      additionalFieldPaths.forEach((path) => {
        if (next[path] !== undefined) return;
        const incoming = Object.prototype.hasOwnProperty.call(source, path)
          ? source[path]
          : getPathValue(source, path);
        next[path] = incoming ?? "";
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [additionalFieldPaths, sessionFormData]);

  function populateForm(d) {
    if (d.houseName) setHouseName(d.houseName);
    if (d.constituency) setConstituency(d.constituency);
    if (d.state) setState(d.state);
    if (d.candidateName) setCandidateName(d.candidateName);
    if (d.fatherMotherHusbandName)
      setFatherMotherHusbandName(d.fatherMotherHusbandName);
    if (d.age) setAge(d.age);
    if (d.postalAddress) setPostalAddress(d.postalAddress);
    if (d.party) setParty(d.party);
    if (d.isIndependent != null) setIsIndependent(d.isIndependent);
    if (d.enrolledConstituency) setEnrolledConstituency(d.enrolledConstituency);
    if (d.serialNumber) setSerialNumber(d.serialNumber);
    if (d.partNumber) setPartNumber(d.partNumber);
    if (d.telephone) setTelephone(d.telephone);
    if (d.email) setEmail(d.email);
    if (d.socialMedia1) setSocialMedia1(d.socialMedia1);
    if (d.socialMedia2) setSocialMedia2(d.socialMedia2);
    if (d.socialMedia3) setSocialMedia3(d.socialMedia3);
    if (d.candidatePhotoUrl) setCandidatePhotoUrl(d.candidatePhotoUrl);
    if (d.candidateSignatureUrl)
      setCandidateSignatureUrl(d.candidateSignatureUrl);
    if (d.panEntries?.length) {
      setPanEntries(
        d.panEntries.map((e, i) => ({
          ...DEFAULT_PAN_ENTRY(i + 1, PAN_PERSONS[i] || `Person ${i + 1}`),
          ...e,
          years: e.years?.length ? e.years : [{ year: "", income: "" }],
        })),
      );
    }
    if (d.hasPendingCases) setHasPendingCases(d.hasPendingCases);
    if (d.pendingCases?.length) setPendingCases(d.pendingCases);
    if (d.hasConvictions) setHasConvictions(d.hasConvictions);
    if (d.convictions?.length) setConvictions(d.convictions);
    if (d.informedParty) setInformedParty(d.informedParty);
    if (d.movableAssets) setMovableAssets(d.movableAssets);
    if (d.immovableAssets)
      setImmovableAssets({
        agricultural: [],
        nonAgricultural: [],
        commercial: [],
        residential: [],
        others: [],
        ...d.immovableAssets,
      });
    if (d.liabilities) setLiabilities(d.liabilities);
    if (d.governmentDues) setGovernmentDues(d.governmentDues);
    if (d.disputedLiabilities) setDisputedLiabilities(d.disputedLiabilities);
    if (d.governmentAccommodation)
      setGovernmentAccommodation({
        occupied: "No",
        address: "",
        noDues: "No",
        duesDate: "",
        rentDues: "",
        electricityDues: "",
        waterDues: "",
        telephoneDues: "",
        ...d.governmentAccommodation,
      });
    if (d.selfProfession) setSelfProfession(d.selfProfession);
    if (d.spouseProfession) setSpouseProfession(d.spouseProfession);
    if (d.selfIncome) setSelfIncome(d.selfIncome);
    if (d.spouseIncome) setSpouseIncome(d.spouseIncome);
    if (d.dependentIncome) setDependentIncome(d.dependentIncome);
    if (d.contractsCandidate) setContractsCandidate(d.contractsCandidate);
    if (d.contractsSpouse) setContractsSpouse(d.contractsSpouse);
    if (d.contractsDependents) setContractsDependents(d.contractsDependents);
    if (d.contractsHUF) setContractsHUF(d.contractsHUF);
    if (d.contractsPartnershipFirms)
      setContractsPartnershipFirms(d.contractsPartnershipFirms);
    if (d.contractsPrivateCompanies)
      setContractsPrivateCompanies(d.contractsPrivateCompanies);
    if (d.educationalQualification)
      setEducationalQualification(d.educationalQualification);
    if (d.verificationPlace) setVerificationPlace(d.verificationPlace);
    if (d.verificationDate) setVerificationDate(d.verificationDate);
    if (d.oathCommissionerName) setOathCommissionerName(d.oathCommissionerName);
    if (d.oathCommissionerDesignation)
      setOathCommissionerDesignation(d.oathCommissionerDesignation);
    if (d.oathCommissionerSealNo)
      setOathCommissionerSealNo(d.oathCommissionerSealNo);
  }

  // ── Build payload ──
  function buildCorePayload() {
    return {
      houseName,
      constituency,
      state,
      candidateName,
      fatherMotherHusbandName,
      age,
      postalAddress,
      party,
      isIndependent,
      enrolledConstituency,
      serialNumber,
      partNumber,
      telephone,
      email,
      socialMedia1,
      socialMedia2,
      socialMedia3,
      candidatePhotoUrl,
      candidateSignatureUrl,
      panEntries: panEntries.map(({ label, ...rest }) => rest),
      hasPendingCases,
      pendingCases: hasPendingCases === "Yes" ? pendingCases : [],
      hasConvictions,
      convictions: hasConvictions === "Yes" ? convictions : [],
      informedParty,
      movableAssets,
      immovableAssets,
      liabilities,
      governmentDues,
      disputedLiabilities,
      governmentAccommodation,
      selfProfession,
      spouseProfession,
      selfIncome,
      spouseIncome,
      dependentIncome,
      contractsCandidate,
      contractsSpouse,
      contractsDependents,
      contractsHUF,
      contractsPartnershipFirms,
      contractsPrivateCompanies,
      educationalQualification,
      verificationPlace,
      verificationDate,
      oathCommissionerName,
      oathCommissionerDesignation,
      oathCommissionerSealNo,
    };
  }

  function buildPayload(includeSessionId = true) {
    const payload = buildCorePayload();
    Object.entries(additionalFieldValues).forEach(([path, value]) => {
      if (value === undefined) return;
      // Preserve unknown placeholder keys exactly as entered.
      payload[path] = value;
      if (path.includes(".") || path.includes("[")) {
        // Also retain nested shape for backends expecting object traversal.
        setPathValue(payload, path, value);
      }
    });
    if (includeSessionId && sessionId) payload.sessionId = sessionId;
    return payload;
  }

  const payloadSnapshot = buildPayload(false);
  const flattenedPayload = flattenLeafValues(payloadSnapshot).filter(
    ({ path }) => path !== "sessionId",
  );
  const filledCount = flattenedPayload.filter(({ value }) =>
    isValueFilled(value),
  ).length;
  const totalCount = flattenedPayload.length;

  const templateCount = flattenedPayload.filter(({ path }) => {
    const placement = classifyPlacement(path);
    return placement.destinations.includes("Template");
  }).length;

  const highImpactMissing = HIGH_IMPACT_FIELDS.filter(
    ({ path }) => !isValueFilled(getPathValue(payloadSnapshot, path)),
  );

  const highImpactMissingByPath = useMemo(
    () =>
      new Map(
        highImpactMissing.map((field) => [
          field.path,
          `${field.label} is recommended before final export.`,
        ]),
      ),
    [highImpactMissing],
  );

  const payloadDigest = JSON.stringify(payloadSnapshot);

  const exportProgressPercent = totalCount
    ? Math.round((filledCount / totalCount) * 100)
    : 0;

  function collectValidationIssues() {
    const issues = [];

    if (hasPendingCases === "Yes" && !pendingCases.length) {
      issues.push({
        key: "pendingCases",
        severity: "warning",
        message: "Pending Criminal Cases: Add at least one case row.",
      });
    }

    pendingCases.forEach((row, idx) => {
      const required = ["firNo", "caseNo", "sections", "description"];
      const anyFilled = Object.values(row || {}).some((value) =>
        isValueFilled(value),
      );
      if (!anyFilled) return;
      required.forEach((key) => {
        if (isValueFilled(row?.[key])) return;
        issues.push({
          key: `pendingCases[${idx}].${key}`,
          severity: "warning",
          message: `Pending Criminal Cases > Case #${idx + 1} > ${key} is missing.`,
        });
      });
    });

    if (hasConvictions === "Yes" && !convictions.length) {
      issues.push({
        key: "convictions",
        severity: "warning",
        message: "Cases of Conviction: Add at least one conviction row.",
      });
    }

    convictions.forEach((row, idx) => {
      const required = ["caseNo", "courtName", "sections", "punishment"];
      const anyFilled = Object.values(row || {}).some((value) =>
        isValueFilled(value),
      );
      if (!anyFilled) return;
      required.forEach((key) => {
        if (isValueFilled(row?.[key])) return;
        issues.push({
          key: `convictions[${idx}].${key}`,
          severity: "warning",
          message: `Cases of Conviction > Entry #${idx + 1} > ${key} is missing.`,
        });
      });
    });

    panEntries.forEach((entry, pIdx) => {
      (entry?.years || []).forEach((yearRow, yIdx) => {
        const anyFilled = Object.values(yearRow || {}).some((value) =>
          isValueFilled(value),
        );
        if (!anyFilled) return;
        if (!isValueFilled(yearRow?.year)) {
          issues.push({
            key: `panEntries[${pIdx}].years[${yIdx}].year`,
            severity: "warning",
            message: `PAN Table > ${entry.label} > Year row #${yIdx + 1} is missing Financial Year.`,
          });
        }
        if (!isValueFilled(yearRow?.income)) {
          issues.push({
            key: `panEntries[${pIdx}].years[${yIdx}].income`,
            severity: "warning",
            message: `PAN Table > ${entry.label} > Year row #${yIdx + 1} is missing Income amount.`,
          });
        }
      });
    });

    IMMOVABLE_CATEGORIES.forEach((category) => {
      (immovableAssets[category.id] || []).forEach((row, idx) => {
        const anyFilled = Object.values(row || {}).some((value) =>
          isValueFilled(value),
        );
        if (!anyFilled) return;
        ["location", "surveyNo", "area", "marketValue"].forEach((key) => {
          if (isValueFilled(row?.[key])) return;
          issues.push({
            key: `immovableAssets.${category.id}[${idx}].${key}`,
            severity: "warning",
            message: `Immovable Assets > ${category.label} > Property #${idx + 1} > ${key} is missing.`,
          });
        });
      });
    });

    if (
      governmentAccommodation.occupied === "Yes" &&
      !isValueFilled(governmentAccommodation.address)
    ) {
      issues.push({
        key: "governmentAccommodation.address",
        severity: "warning",
        message:
          "Government Accommodation: Address is required when occupation is Yes.",
      });
    }
    if (
      governmentAccommodation.occupied === "Yes" &&
      governmentAccommodation.noDues === "No"
    ) {
      [
        "duesDate",
        "rentDues",
        "electricityDues",
        "waterDues",
        "telephoneDues",
      ].forEach((key) => {
        if (isValueFilled(governmentAccommodation[key])) return;
        issues.push({
          key: `governmentAccommodation.${key}`,
          severity: "warning",
          message: `Government Accommodation dues: ${key} is missing.`,
        });
      });
    }

    setValidationIssues(issues);
    return issues;
  }

  function applyValidationFromHeaders(validation) {
    if (!validation || typeof validation !== "object") return;
    const missingRequired = Array.isArray(validation.missingRequired)
      ? validation.missingRequired
      : [];
    const hasValidationSignal =
      validation.valid !== null || missingRequired.length;
    if (!hasValidationSignal) return;

    setSessionValidation((prev) => ({
      ...prev,
      valid:
        typeof validation.valid === "boolean" ? validation.valid : prev.valid,
      missingRequired:
        typeof validation.valid === "boolean" && validation.valid
          ? []
          : missingRequired.length
            ? missingRequired
            : prev.missingRequired,
      lastCheckedAt: new Date(),
      error: "",
    }));
  }

  async function refreshSessionValidation(targetSessionId, options = {}) {
    const showToast = Boolean(options.showToast);
    const includeTemplateAudit =
      options.includeTemplateAudit ?? strictTemplateAudit;

    if (!targetSessionId) {
      setSessionValidation((prev) => ({
        ...prev,
        valid: null,
        missingRequired: [],
        totalFieldEntries: null,
        details: null,
        templateAudit: null,
        lastCheckedAt: null,
        error: "",
      }));
      return null;
    }

    setValidationLoading(true);
    try {
      const res = await affidavitAPI.getSessionValidation(targetSessionId, {
        includeTemplateAudit,
        signal: options.signal,
      });
      const missingRequired = Array.isArray(res?.missingRequired)
        ? res.missingRequired
        : [];
      const nextState = {
        valid: typeof res?.valid === "boolean" ? res.valid : false,
        missingRequired,
        totalFieldEntries: Number.isFinite(Number(res?.totalFieldEntries))
          ? Number(res.totalFieldEntries)
          : null,
        details: res?.details || null,
        templateAudit: res?.templateAudit || null,
        lastCheckedAt: new Date(),
        error: "",
      };
      setSessionValidation(nextState);
      if (showToast) {
        toast.success(
          nextState.valid
            ? "Validation: all required fields look complete."
            : "Validation: required fields still need attention.",
        );
      }
      return nextState;
    } catch (err) {
      setSessionValidation((prev) => ({
        ...prev,
        valid: null,
        missingRequired: prev?.missingRequired || [],
        details: prev?.details || null,
        lastCheckedAt: new Date(),
        error: err?.message || "Validation check failed.",
      }));
      if (showToast) {
        toast.error(err?.message || "Validation check failed.");
      }
      return null;
    } finally {
      setValidationLoading(false);
    }
  }

  useEffect(() => {
    collectValidationIssues();
  }, [
    hasPendingCases,
    pendingCases,
    hasConvictions,
    convictions,
    panEntries,
    immovableAssets,
    governmentAccommodation,
  ]);

  useEffect(
    () => () => {
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
      }
      if (previewBlobUrlRef.current) {
        window.URL.revokeObjectURL(previewBlobUrlRef.current);
      }
    },
    [],
  );

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
    if (!previewHostRef.current) {
      return false;
    }
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
      const previewResult =
        source === "session" && sessionId
          ? await affidavitAPI.previewDocxFromSessionDetailed(sessionId, {
              signal: controller.signal,
            })
          : await affidavitAPI.previewDocxFromPayloadDetailed(
              buildPayload(false),
              {
                signal: controller.signal,
              },
            );

      const previewBlob = previewResult?.blob;
      if (!previewBlob) {
        throw new Error("No preview document returned by backend.");
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
          renderErr?.message || "Could not render DOCX in browser preview.",
        );
      }

      setPreviewLastRefreshedAt(new Date());
      setPreviewStale(false);
      lastPreviewDigestRef.current = payloadDigest;
      applyValidationFromHeaders(previewResult?.validation);
      if (
        source === "session" &&
        sessionId &&
        previewResult?.validation?.valid === null
      ) {
        refreshSessionValidation(sessionId);
      }
      if (showToast) {
        toast.success("Preview refreshed.");
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      if (requestId !== previewRequestIdRef.current) return;
      setPreviewError(err?.message || "Failed to generate document preview.");
      if (showToast) {
        toast.error("Preview refresh failed.");
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
    requestPreview({
      source: sessionId && !previewStale ? "session" : "payload",
      showToast: true,
    });
  }

  function handleDownloadPreviewDocx() {
    if (!previewBlobUrl) {
      toast.error("No preview document available yet.");
      return;
    }
    const link = document.createElement("a");
    link.href = previewBlobUrl;
    link.download = candidateName
      ? `AffidavitPreview_${candidateName.replace(/[^a-zA-Z0-9]/g, "_")}.docx`
      : "AffidavitPreview.docx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  useEffect(() => {
    setPreviewStale(payloadDigest !== lastPreviewDigestRef.current);
    const timer = setTimeout(() => {
      requestPreview({ source: "payload" });
    }, 420);
    return () => clearTimeout(timer);
  }, [payloadDigest]);

  useEffect(() => {
    if (!sessionId) return;
    if (previewBlobUrlRef.current) return;
    requestPreview({ source: "session" });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    refreshSessionValidation(sessionId, {
      includeTemplateAudit: strictTemplateAudit,
    });
  }, [strictTemplateAudit, sessionId]);

  useEffect(() => {
    if (!previewBlobUrl || !previewHostRef.current) return;
    if (previewHostRef.current.childElementCount > 0) return;
    fetch(previewBlobUrl)
      .then((res) => res.blob())
      .then((blob) => renderDocxPreview(blob))
      .catch((err) => {
        setPreviewRenderError(
          err?.message || "Could not render cached DOCX preview.",
        );
      });
  }, [previewBlobUrl, mobileViewTab]);

  // ── Image upload handler ──
  async function handleImageUpload(file, fieldName) {
    if (!file) return;
    const isPhoto = fieldName === "candidatePhotoUrl";
    if (isPhoto) setUploadingPhoto(true);
    else setUploadingSignature(true);
    try {
      const res = await affidavitAPI.uploadImage(file);
      if (res.url) {
        if (isPhoto) setCandidatePhotoUrl(res.url);
        else setCandidateSignatureUrl(res.url);
        toast.success(`${isPhoto ? "Photo" : "Signature"} uploaded!`);
      }
    } catch (err) {
      toast.error("Upload failed: " + (err.message || ""));
    } finally {
      if (isPhoto) setUploadingPhoto(false);
      else setUploadingSignature(false);
    }
  }

  // ── Save ──
  async function handleSave() {
    setSaving(true);
    try {
      const payload = buildPayload();
      const res = await affidavitAPI.manualEntry(payload);
      const nextSessionId = res.sessionId || sessionId;
      if (res.sessionId && !sessionId) {
        setSessionId(res.sessionId);
        router.replace(
          { pathname: router.pathname, query: { sessionId: res.sessionId } },
          undefined,
          { shallow: true },
        );
      }

      const normalizedAudit = normalizeDbAudit(
        res?.dbAudit || res?.session?.dbAudit,
      );
      setSaveDiagnostics({
        sessionId: nextSessionId || null,
        exportUrl: res?.exportUrl || "",
        dbAudit: normalizedAudit,
        savedAt: new Date(),
      });
      setSessionFormData(payload);

      if (nextSessionId) {
        await refreshSessionValidation(nextSessionId, {
          includeTemplateAudit: strictTemplateAudit,
        });
      }
      toast.success("Draft saved successfully!");
      return nextSessionId;
    } catch (err) {
      toast.error("Save failed: " + (err.message || "Unknown error"));
      throw err;
    } finally {
      setSaving(false);
    }
  }

  function handleValidate() {
    if (sessionId) {
      refreshSessionValidation(sessionId, {
        showToast: true,
        includeTemplateAudit: strictTemplateAudit,
      });
    }
    const issues = collectValidationIssues();
    if (!issues.length) {
      toast.success("Validation passed. No structural issues found.");
      return;
    }
    toast.error(`Validation found ${issues.length} issue(s).`);
  }

  async function executeExportFlow() {
    setExporting(true);
    try {
      const id = await handleSave();
      if (!id) {
        throw new Error("Could not create a session for export.");
      }
      const exportResult = await affidavitAPI.exportDocx(id, candidateName);
      applyValidationFromHeaders(exportResult?.validation);
      toast.success("DOCX downloaded!");
    } catch (err) {
      toast.error("Export failed: " + (err.message || ""));
    } finally {
      setExporting(false);
      setShowExportChecklist(false);
    }
  }

  // ── Export ──
  async function handleExport() {
    let validationResult = null;
    let nextSessionId = sessionId;
    if (!nextSessionId) {
      try {
        nextSessionId = await handleSave();
      } catch {
        return;
      }
    }

    if (nextSessionId) {
      validationResult = await refreshSessionValidation(nextSessionId, {
        includeTemplateAudit: strictTemplateAudit,
      });
    }

    const issues = collectValidationIssues();
    const backendMissingRequired = validationResult?.missingRequired || [];
    const backendNeedsAttention =
      validationResult?.valid === false || backendMissingRequired.length > 0;
    if (highImpactMissing.length || issues.length || backendNeedsAttention) {
      setShowExportChecklist(true);
      return;
    }
    await executeExportFlow();
  }

  // ── Scroll to section ──
  function scrollToSection(id) {
    setActiveSectionId(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const persistedMissingFields = saveDiagnostics?.dbAudit?.missingFields || [];
  const saveExpectedCount = saveDiagnostics?.dbAudit?.expectedPersistedCount;
  const savePersistedCount = saveDiagnostics?.dbAudit?.savedCount;
  const saveStatusNeedsAttention = persistedMissingFields.length > 0;
  const saveStatusLabel = saveStatusNeedsAttention
    ? "Needs attention"
    : saveDiagnostics
      ? "Saved"
      : "Not saved";
  const lastSavedText = saveDiagnostics?.savedAt
    ? new Date(saveDiagnostics.savedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Not saved yet";
  const validationDetailEntries = useMemo(() => {
    const details = sessionValidation?.details;
    if (!details || typeof details !== "object" || Array.isArray(details)) {
      return [];
    }
    return Object.entries(details)
      .slice(0, 8)
      .map(([key, value]) => {
        if (value == null) return `${key}: -`;
        if (typeof value === "object") {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${String(value)}`;
      });
  }, [sessionValidation?.details]);
  const templateAuditEntries = useMemo(() => {
    const audit = sessionValidation?.templateAudit;
    if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
      return [];
    }
    return Object.entries(audit)
      .slice(0, 8)
      .map(([key, value]) => {
        if (value == null) return `${key}: -`;
        if (typeof value === "object") {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${String(value)}`;
      });
  }, [sessionValidation?.templateAudit]);

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
        <aside className="hidden 2xl:block w-52 shrink-0">
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
                    ? "bg-blue-500/20 text-blue-100 border border-blue-400/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-ink-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main form area ── */}
        <div className="flex-[1.2] min-w-0 space-y-6 pb-32">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-50 flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/20 text-2xl border border-blue-400/50 shadow-card">
                    📝
                  </span>
                  Form 26 — Manual Entry
                </h1>
                <p className="text-slate-400 mt-2 ml-14">
                  Fill the affidavit form manually. Every value is included in
                  the generated DOCX preview and export output.
                  {sessionId && (
                    <span className="ml-2 text-emerald-400 text-xs">
                      Session: {sessionId.slice(0, 8)}…
                    </span>
                  )}
                </p>
                {schemaLoadError && (
                  <p className="text-amber-300 text-xs mt-2 ml-14">
                    Schema warning: {schemaLoadError}. Manual entry still works
                    and payload is preserved.
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
                    ? "bg-blue-500/20 border border-blue-400/50 text-blue-100"
                    : "border border-ink-400 text-slate-300"
                }`}
              >
                Form
              </button>
              <button
                type="button"
                onClick={() => setMobileViewTab("preview")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  mobileViewTab === "preview"
                    ? "bg-blue-500/20 border border-blue-400/50 text-blue-100"
                    : "border border-ink-400 text-slate-300"
                }`}
              >
                Document Preview
              </button>
            </div>
          </div>

          <div className="card border-blue-400/20">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Persistence and Validation Diagnostics
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Save status: {saveStatusLabel} | Last saved: {lastSavedText}
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={strictTemplateAudit}
                  onChange={(e) => setStrictTemplateAudit(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-400 bg-ink-100"
                />
                Strict template audit
              </label>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
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
                <p className="text-slate-400">Missing fields</p>
                <p className="text-slate-100 font-semibold">
                  {persistedMissingFields.length}
                </p>
              </div>
              <div className="rounded-lg border border-ink-400 bg-ink-100/60 px-3 py-2">
                <p className="text-slate-400">Validation entries</p>
                <p className="text-slate-100 font-semibold">
                  {sessionValidation?.totalFieldEntries ?? "-"}
                </p>
              </div>
            </div>

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

            {strictTemplateAudit && templateAuditEntries.length > 0 && (
              <div className="mt-3 rounded-lg border border-blue-400/40 bg-blue-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
                  Template audit
                </p>
                <ul className="mt-1 text-xs text-blue-100 space-y-1 max-h-24 overflow-auto pr-1">
                  {templateAuditEntries.map((line, idx) => (
                    <li key={`template-audit-${idx}`}>• {line}</li>
                  ))}
                </ul>
              </div>
            )}

            {saveDiagnostics?.exportUrl && (
              <p className="mt-3 text-xs text-slate-400 break-all">
                Export URL ready: {saveDiagnostics.exportUrl}
              </p>
            )}
          </div>

          <div
            className={
              mobileViewTab === "preview" ? "hidden lg:block" : "space-y-6"
            }
          >
            {/* ═══ Section 1: Election Details ═══ */}
            <SectionCard
              id="election"
              title="1. Election Details"
              subtitle='Header fields: "AFFIDAVIT TO BE FILED BY THE CANDIDATE ALONGWITH NOMINATION PAPER BEFORE THE RETURNING OFFICER FOR ELECTION TO ____ (NAME OF THE HOUSE) FROM ____ CONSTITUENCY"'
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                <Field
                  label="Name of the House"
                  placeholder='e.g. "Legislative Assembly"'
                  value={houseName}
                  onChange={setHouseName}
                  path="houseName"
                  warning={highImpactMissingByPath.get("houseName")}
                />
                <Field
                  label="Constituency Name"
                  placeholder='e.g. "116 BIDHANNAGAR"'
                  value={constituency}
                  onChange={setConstituency}
                  path="constituency"
                  warning={highImpactMissingByPath.get("constituency")}
                />
                <Field
                  label="State"
                  placeholder='e.g. "WEST BENGAL"'
                  value={state}
                  onChange={setState}
                  path="state"
                />
              </div>
            </SectionCard>

            {/* ═══ Section 2: Part A — Personal Details ═══ */}
            <SectionCard
              id="personal"
              title="2. Part A — Personal Details"
              subtitle="I ____ son/daughter/wife of ____ Aged ____ years, resident of ____, a candidate set up by ____ / contesting as Independent..."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Candidate Full Name"
                  value={candidateName}
                  onChange={setCandidateName}
                  path="candidateName"
                  warning={highImpactMissingByPath.get("candidateName")}
                />
                <Field
                  label="Father's / Mother's / Husband's Name"
                  value={fatherMotherHusbandName}
                  onChange={setFatherMotherHusbandName}
                  path="fatherMotherHusbandName"
                  warning={highImpactMissingByPath.get(
                    "fatherMotherHusbandName",
                  )}
                />
                <Field
                  label="Age (years)"
                  value={age}
                  onChange={setAge}
                  placeholder="Just the number"
                  path="age"
                />
                <Field
                  label="Political Party Name"
                  value={party}
                  onChange={setParty}
                  placeholder="Leave blank if independent"
                  path="party"
                />
              </div>
              <TextareaField
                label="Full Postal Address"
                value={postalAddress}
                onChange={setPostalAddress}
                placeholder="Mention full postal address"
                path="postalAddress"
                warning={highImpactMissingByPath.get("postalAddress")}
              />
              <div className="flex items-center gap-3 mt-4">
                <input
                  type="checkbox"
                  id="isIndependent"
                  checked={isIndependent}
                  onChange={(e) => setIsIndependent(e.target.checked)}
                  className="w-5 h-5 rounded border-ink-400 bg-ink-100 text-neon-500 focus:ring-neon-400"
                />
                <label
                  htmlFor="isIndependent"
                  className="text-sm text-slate-300"
                >
                  Contesting as Independent
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Field
                  label="Enrolled Constituency & State"
                  value={enrolledConstituency}
                  onChange={setEnrolledConstituency}
                  path="enrolledConstituency"
                />
                <Field
                  label="Serial No. in Electoral Roll"
                  value={serialNumber}
                  onChange={setSerialNumber}
                  path="serialNumber"
                />
                <Field
                  label="Part No. in Electoral Roll"
                  value={partNumber}
                  onChange={setPartNumber}
                  path="partNumber"
                />
                <Field
                  label="Telephone Number(s)"
                  value={telephone}
                  onChange={setTelephone}
                  path="telephone"
                />
                <Field
                  label="Email ID"
                  value={email}
                  onChange={setEmail}
                  placeholder="if any"
                  path="email"
                />
                <Field
                  label="Social Media Account (i)"
                  value={socialMedia1}
                  onChange={setSocialMedia1}
                  placeholder="if any"
                  path="socialMedia1"
                />
                <Field
                  label="Social Media Account (ii)"
                  value={socialMedia2}
                  onChange={setSocialMedia2}
                  path="socialMedia2"
                />
                <Field
                  label="Social Media Account (iii)"
                  value={socialMedia3}
                  onChange={setSocialMedia3}
                  path="socialMedia3"
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
                  label="Deponent Signature"
                  value={candidateSignatureUrl}
                  uploading={uploadingSignature}
                  onFileSelect={(file) =>
                    handleImageUpload(file, "candidateSignatureUrl")
                  }
                  onClear={() => setCandidateSignatureUrl("")}
                />
              </div>
            </SectionCard>

            {/* ═══ Section 3: PAN & Income Tax ═══ */}
            <SectionCard
              id="pan"
              title="3. PAN & Income Tax Details"
              subtitle="Details of Permanent Account Number (PAN) and status of filing of Income Tax Return. It is mandatory for PAN holder to mention PAN; if no PAN, state 'No PAN allotted'."
            >
              <div className="space-y-3">
                {panEntries.map((entry, pIdx) => (
                  <div
                    key={pIdx}
                    className="border border-ink-400 rounded-xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPan((prev) => ({
                          ...prev,
                          [pIdx]: !prev[pIdx],
                        }))
                      }
                      className="w-full flex items-center justify-between px-4 py-3 bg-ink-100/50 hover:bg-ink-100 transition-colors text-left"
                    >
                      <span className="text-sm font-medium text-slate-200">
                        {entry.slNo}. {entry.label || PAN_PERSONS[pIdx]}
                        {entry.name && (
                          <span className="text-slate-400 ml-2">
                            — {entry.name}
                          </span>
                        )}
                      </span>
                      <span className="text-slate-500 text-lg">
                        {expandedPan[pIdx] ? "▾" : "▸"}
                      </span>
                    </button>
                    {expandedPan[pIdx] && (
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Field
                            label="Name"
                            value={entry.name}
                            onChange={(v) => {
                              const arr = [...panEntries];
                              arr[pIdx] = { ...arr[pIdx], name: v };
                              setPanEntries(arr);
                            }}
                          />
                          <Field
                            label="PAN"
                            value={entry.pan}
                            onChange={(v) => {
                              const arr = [...panEntries];
                              arr[pIdx] = { ...arr[pIdx], pan: v };
                              setPanEntries(arr);
                            }}
                            placeholder="PAN number or 'No PAN allotted'"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Financial Year Entries (last 5 years)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const arr = [...panEntries];
                                arr[pIdx] = {
                                  ...arr[pIdx],
                                  years: [
                                    ...arr[pIdx].years,
                                    { year: "", income: "" },
                                  ],
                                };
                                setPanEntries(arr);
                              }}
                              className="text-xs text-neon-300 hover:text-neon-200"
                            >
                              + Add Year
                            </button>
                          </div>
                          {entry.years.map((yr, yIdx) => (
                            <div
                              key={yIdx}
                              className="flex items-center gap-3 mb-2"
                            >
                              <input
                                className="flex-1 text-sm"
                                placeholder="e.g. 2024-25"
                                value={yr.year}
                                onChange={(e) => {
                                  const arr = [...panEntries];
                                  const years = [...arr[pIdx].years];
                                  years[yIdx] = {
                                    ...years[yIdx],
                                    year: e.target.value,
                                  };
                                  arr[pIdx] = { ...arr[pIdx], years };
                                  setPanEntries(arr);
                                }}
                              />
                              <input
                                className="flex-1 text-sm"
                                placeholder="Total Income (Rs.)"
                                value={yr.income}
                                onChange={(e) => {
                                  const arr = [...panEntries];
                                  const years = [...arr[pIdx].years];
                                  years[yIdx] = {
                                    ...years[yIdx],
                                    income: e.target.value,
                                  };
                                  arr[pIdx] = { ...arr[pIdx], years };
                                  setPanEntries(arr);
                                }}
                              />
                              {entry.years.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const arr = [...panEntries];
                                    const years = arr[pIdx].years.filter(
                                      (_, i) => i !== yIdx,
                                    );
                                    arr[pIdx] = { ...arr[pIdx], years };
                                    setPanEntries(arr);
                                  }}
                                  className="text-rose-400 hover:text-rose-300 text-sm"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* ═══ Section 4: Pending Criminal Cases ═══ */}
            <SectionCard
              id="pending"
              title="4. Pending Criminal Cases"
              subtitle="(5) Pending criminal cases — Details should be entered in BOLD letters, separately for each case, in reverse chronological order."
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Any pending criminal cases?
                </label>
                <select
                  value={hasPendingCases}
                  onChange={(e) => setHasPendingCases(e.target.value)}
                  className="w-full md:w-64"
                >
                  <option value="No">No — No pending criminal cases</option>
                  <option value="Yes">Yes — Cases are pending</option>
                </select>
              </div>
              <AnimatePresence>
                {hasPendingCases === "Yes" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    {pendingCases.map((c, idx) => (
                      <div
                        key={idx}
                        className="border border-ink-400 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-200">
                            Case #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingCases((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="text-rose-400 hover:text-rose-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[
                            {
                              key: "firNo",
                              label: "(a) FIR No. with Police Station",
                            },
                            {
                              key: "caseNo",
                              label: "(b) Case No. with Court Name",
                            },
                            {
                              key: "sections",
                              label: "(c) Sections of Acts/Codes",
                            },
                            {
                              key: "description",
                              label: "(d) Brief description of offence",
                            },
                            {
                              key: "chargesFramed",
                              label: "(e) Charges framed? (YES/NO)",
                            },
                            {
                              key: "chargesDate",
                              label: "(f) Date charges were framed",
                            },
                            {
                              key: "appealFiled",
                              label: "(g) Appeal/revision filed? (YES/NO)",
                            },
                          ].map((f) => (
                            <Field
                              key={f.key}
                              label={f.label}
                              value={c[f.key] || ""}
                              onChange={(v) => {
                                const arr = [...pendingCases];
                                arr[idx] = { ...arr[idx], [f.key]: v };
                                setPendingCases(arr);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setPendingCases((prev) => [
                          ...prev,
                          DEFAULT_PENDING_CASE(),
                        ])
                      }
                      className="btn btn-secondary text-sm"
                    >
                      + Add Pending Case
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </SectionCard>

            {/* ═══ Section 5: Convictions ═══ */}
            <SectionCard
              id="convictions"
              title="5. Cases of Conviction"
              subtitle="(6) Cases of conviction — I declare that I have not been convicted / I have been convicted for the offences mentioned below."
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Any convictions?
                </label>
                <select
                  value={hasConvictions}
                  onChange={(e) => setHasConvictions(e.target.value)}
                  className="w-full md:w-64"
                >
                  <option value="No">No — No convictions</option>
                  <option value="Yes">Yes — I have been convicted</option>
                </select>
              </div>
              <AnimatePresence>
                {hasConvictions === "Yes" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    {convictions.map((c, idx) => (
                      <div
                        key={idx}
                        className="border border-ink-400 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-200">
                            Conviction #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setConvictions((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="text-rose-400 hover:text-rose-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[
                            { key: "caseNo", label: "(a) Case No." },
                            {
                              key: "courtName",
                              label: "(b) Name of the Court",
                            },
                            {
                              key: "sections",
                              label: "(c) Sections of Acts/Codes",
                            },
                            {
                              key: "description",
                              label: "(d) Brief description of offence",
                            },
                            {
                              key: "convictionDate",
                              label: "(e) Date of conviction order",
                            },
                            {
                              key: "punishment",
                              label: "(f) Punishment imposed",
                            },
                            {
                              key: "appealFiled",
                              label: "(g) Appeal filed? (YES/NO)",
                            },
                            {
                              key: "appealStatus",
                              label: "(h) Appeal details & present status",
                            },
                          ].map((f) => (
                            <Field
                              key={f.key}
                              label={f.label}
                              value={c[f.key] || ""}
                              onChange={(v) => {
                                const arr = [...convictions];
                                arr[idx] = { ...arr[idx], [f.key]: v };
                                setConvictions(arr);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setConvictions((prev) => [
                          ...prev,
                          DEFAULT_CONVICTION(),
                        ])
                      }
                      className="btn btn-secondary text-sm"
                    >
                      + Add Conviction Entry
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </SectionCard>

            {/* ═══ Section 6: Party Information ═══ */}
            <SectionCard
              id="partyInfo"
              title="6. Party Information (6A)"
              subtitle="(6A) I have given full and up-to-date information to my political party about all pending criminal cases against me..."
            >
              <TextareaField
                label="Information given to political party about criminal cases"
                value={informedParty}
                onChange={setInformedParty}
                placeholder="Write NOT APPLICABLE if 5(i) and 6(i) selected"
              />
            </SectionCard>

            {/* ═══ Section 7: Movable Assets ═══ */}
            <SectionCard
              id="movable"
              title="7. Movable Assets"
              subtitle="(7) Details of the assets (movable) of myself, my spouse and all dependents. 'Dependent' means parents, son(s), daughter(s) or any person related by blood or marriage who are dependent on the candidate."
            >
              <p className="text-xs text-slate-500 mb-3 italic">
                Assets in joint name indicating extent of joint ownership should
                also be given. Details of offshore assets must be included.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-400">
                      <th className="text-left py-2 px-2 text-slate-400 font-medium min-w-[200px]">
                        Asset Type
                      </th>
                      {PERSON_SUFFIXES.map((p) => (
                        <th
                          key={p}
                          className="text-left py-2 px-2 text-slate-400 font-medium min-w-[140px]"
                        >
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MOVABLE_ASSET_ROWS.map((row) => (
                      <tr key={row.key} className="border-b border-ink-400/40">
                        <td className="py-2 px-2 text-slate-300 text-xs">
                          {row.label}
                        </td>
                        {PERSON_SUFFIXES.map((suffix) => {
                          const fieldKey = `${row.key}${suffix}`;
                          return (
                            <td key={suffix} className="py-1 px-1">
                              <input
                                className="w-full text-xs py-1.5 px-2"
                                value={movableAssets[fieldKey] || ""}
                                onChange={(e) =>
                                  setMovableAssets((prev) => ({
                                    ...prev,
                                    [fieldKey]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* ═══ Section 8: Immovable Assets ═══ */}
            <SectionCard
              id="immovable"
              title="8. Immovable Assets"
              subtitle="B. Details of Immovable assets. Properties in joint ownership indicating extent of joint ownership must be indicated. Each land/building/apartment should be mentioned separately. Include offshore assets."
            >
              <div className="space-y-3">
                {IMMOVABLE_CATEGORIES.map((cat) => (
                  <div
                    key={cat.id}
                    className="border border-ink-400 rounded-xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedImmovable((prev) => ({
                          ...prev,
                          [cat.id]: !prev[cat.id],
                        }))
                      }
                      className="w-full flex items-center justify-between px-4 py-3 bg-ink-100/50 hover:bg-ink-100 transition-colors text-left"
                    >
                      <span className="text-sm font-medium text-slate-200">
                        {cat.label}
                        <span className="text-slate-500 ml-2 text-xs">
                          ({(immovableAssets[cat.id] || []).length} entries)
                        </span>
                      </span>
                      <span className="text-slate-500 text-lg">
                        {expandedImmovable[cat.id] ? "▾" : "▸"}
                      </span>
                    </button>
                    {expandedImmovable[cat.id] && (
                      <div className="p-4 space-y-4">
                        {(immovableAssets[cat.id] || []).map((prop, pIdx) => (
                          <div
                            key={pIdx}
                            className="border border-ink-400/60 rounded-lg p-3 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-300">
                                Property #{pIdx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setImmovableAssets((prev) => ({
                                    ...prev,
                                    [cat.id]: prev[cat.id].filter(
                                      (_, i) => i !== pIdx,
                                    ),
                                  }));
                                }}
                                className="text-rose-400 hover:text-rose-300 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {[
                                { key: "location", label: "Location(s)" },
                                { key: "surveyNo", label: "Survey Number(s)" },
                                { key: "area", label: "Area (acres/sq.ft)" },
                                {
                                  key: "inherited",
                                  label: "Inherited? (Yes/No)",
                                },
                                {
                                  key: "purchaseDate",
                                  label: "Date of Purchase",
                                },
                                {
                                  key: "purchaseCost",
                                  label: "Cost at time of purchase (Rs.)",
                                },
                                {
                                  key: "investment",
                                  label:
                                    "Investment (development/construction)",
                                },
                                {
                                  key: "marketValue",
                                  label: "Approximate current market value",
                                },
                              ].map((f) => (
                                <Field
                                  key={f.key}
                                  label={f.label}
                                  value={prop[f.key] || ""}
                                  onChange={(v) => {
                                    setImmovableAssets((prev) => {
                                      const arr = [...(prev[cat.id] || [])];
                                      arr[pIdx] = { ...arr[pIdx], [f.key]: v };
                                      return { ...prev, [cat.id]: arr };
                                    });
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setImmovableAssets((prev) => ({
                              ...prev,
                              [cat.id]: [
                                ...(prev[cat.id] || []),
                                DEFAULT_PROPERTY(),
                              ],
                            }));
                          }}
                          className="btn btn-secondary text-xs"
                        >
                          + Add Property
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* ═══ Section 9: Liabilities ═══ */}
            <SectionCard
              id="liabilities"
              title="9. Liabilities"
              subtitle="Details of liabilities/dues to public financial institutions and government. Please give separate details of name of bank, institution, entity or individual and amount."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-400">
                      <th className="text-left py-2 px-2 text-slate-400 font-medium min-w-[200px]">
                        Liability Type
                      </th>
                      {PERSON_SUFFIXES.map((p) => (
                        <th
                          key={p}
                          className="text-left py-2 px-2 text-slate-400 font-medium min-w-[140px]"
                        >
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LIABILITY_ROWS.map((row) => (
                      <tr key={row.key} className="border-b border-ink-400/40">
                        <td className="py-2 px-2 text-slate-300 text-xs">
                          {row.label}
                        </td>
                        {PERSON_SUFFIXES.map((suffix) => {
                          const fieldKey = `${row.key}${suffix}`;
                          return (
                            <td key={suffix} className="py-1 px-1">
                              <input
                                className="w-full text-xs py-1.5 px-2"
                                value={liabilities[fieldKey] || ""}
                                onChange={(e) =>
                                  setLiabilities((prev) => ({
                                    ...prev,
                                    [fieldKey]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* ═══ Section 10: Government Dues ═══ */}
            <SectionCard
              id="govtDues"
              title="10. Government Dues"
              subtitle="(ii) Government Dues — includes accommodation, transport, taxes, etc."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-400">
                      <th className="text-left py-2 px-2 text-slate-400 font-medium min-w-[200px]">
                        Dues Type
                      </th>
                      {PERSON_SUFFIXES.map((p) => (
                        <th
                          key={p}
                          className="text-left py-2 px-2 text-slate-400 font-medium min-w-[140px]"
                        >
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {GOVT_DUES_ROWS.map((row) => (
                      <tr key={row.key} className="border-b border-ink-400/40">
                        <td className="py-2 px-2 text-slate-300 text-xs">
                          {row.label}
                        </td>
                        {PERSON_SUFFIXES.map((suffix) => {
                          const fieldKey = `${row.key}${suffix}`;
                          return (
                            <td key={suffix} className="py-1 px-1">
                              <input
                                className="w-full text-xs py-1.5 px-2"
                                value={governmentDues[fieldKey] || ""}
                                onChange={(e) =>
                                  setGovernmentDues((prev) => ({
                                    ...prev,
                                    [fieldKey]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* ═══ Section 10A: Disputed Liabilities ═══ */}
            <SectionCard
              id="disputedLiab"
              title="10A. Disputed Liabilities"
              subtitle="Any liabilities that are disputed by the candidate."
            >
              <TextareaField
                label="Details of disputed liabilities"
                value={disputedLiabilities}
                onChange={setDisputedLiabilities}
                placeholder="Write NIL if no disputed liabilities"
                rows={4}
              />
            </SectionCard>

            {/* ═══ Section 11: Government Accommodation ═══ */}
            <SectionCard
              id="govtAccom"
              title="11. Government Accommodation"
              subtitle="Dues to departments dealing with Government accommodation — Has the Deponent been in occupation of accommodation provided by the Government at any time during the last ten years?"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Occupied Govt. accommodation in last 10 years?
                  </label>
                  <select
                    value={governmentAccommodation.occupied}
                    onChange={(e) =>
                      setGovernmentAccommodation((prev) => ({
                        ...prev,
                        occupied: e.target.value,
                      }))
                    }
                    className="w-full md:w-64"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <AnimatePresence>
                  {governmentAccommodation.occupied === "Yes" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4"
                    >
                      <TextareaField
                        label="Address of Govt. accommodation"
                        value={governmentAccommodation.address}
                        onChange={(v) =>
                          setGovernmentAccommodation((prev) => ({
                            ...prev,
                            address: v,
                          }))
                        }
                      />
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                          No dues payable as on date? (requires No Dues
                          Certificate)
                        </label>
                        <select
                          value={governmentAccommodation.noDues}
                          onChange={(e) =>
                            setGovernmentAccommodation((prev) => ({
                              ...prev,
                              noDues: e.target.value,
                            }))
                          }
                          className="w-full md:w-64"
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </div>
                      <AnimatePresence>
                        {governmentAccommodation.noDues === "No" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-ink-400 rounded-xl p-4"
                          >
                            <Field
                              label="Dues payable as on date"
                              value={governmentAccommodation.duesDate}
                              onChange={(v) =>
                                setGovernmentAccommodation((prev) => ({
                                  ...prev,
                                  duesDate: v,
                                }))
                              }
                              placeholder="DD/MM/YYYY"
                            />
                            <Field
                              label="Rent dues (Rs.)"
                              value={governmentAccommodation.rentDues}
                              onChange={(v) =>
                                setGovernmentAccommodation((prev) => ({
                                  ...prev,
                                  rentDues: v,
                                }))
                              }
                            />
                            <Field
                              label="Electricity dues (Rs.)"
                              value={governmentAccommodation.electricityDues}
                              onChange={(v) =>
                                setGovernmentAccommodation((prev) => ({
                                  ...prev,
                                  electricityDues: v,
                                }))
                              }
                            />
                            <Field
                              label="Water dues (Rs.)"
                              value={governmentAccommodation.waterDues}
                              onChange={(v) =>
                                setGovernmentAccommodation((prev) => ({
                                  ...prev,
                                  waterDues: v,
                                }))
                              }
                            />
                            <Field
                              label="Telephone dues (Rs.)"
                              value={governmentAccommodation.telephoneDues}
                              onChange={(v) =>
                                setGovernmentAccommodation((prev) => ({
                                  ...prev,
                                  telephoneDues: v,
                                }))
                              }
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </SectionCard>

            {/* ═══ Section 12: Profession & Income ═══ */}
            <SectionCard
              id="profession"
              title="12. Profession & Income"
              subtitle="(8) Details of profession or occupation and (9A) Details of source(s) of income."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Profession — Self"
                  value={selfProfession}
                  onChange={setSelfProfession}
                />
                <Field
                  label="Profession — Spouse"
                  value={spouseProfession}
                  onChange={setSpouseProfession}
                />
                <Field
                  label="Source of Income — Self"
                  value={selfIncome}
                  onChange={setSelfIncome}
                />
                <Field
                  label="Source of Income — Spouse"
                  value={spouseIncome}
                  onChange={setSpouseIncome}
                />
                <Field
                  label="Source of Income — Dependents"
                  value={dependentIncome}
                  onChange={setDependentIncome}
                  className="md:col-span-2"
                />
              </div>
            </SectionCard>

            {/* ═══ Section 13: Contracts with Government ═══ */}
            <SectionCard
              id="contracts"
              title="13. Contracts with Appropriate Government"
              subtitle="(9B) Contracts with appropriate Government and any public company or companies."
            >
              <div className="space-y-4">
                <TextareaField
                  label="Contracts by Candidate"
                  value={contractsCandidate}
                  onChange={setContractsCandidate}
                />
                <TextareaField
                  label="Contracts by Spouse"
                  value={contractsSpouse}
                  onChange={setContractsSpouse}
                />
                <TextareaField
                  label="Contracts by Dependents"
                  value={contractsDependents}
                  onChange={setContractsDependents}
                />
                <TextareaField
                  label="Contracts by HUF/Trust"
                  value={contractsHUF}
                  onChange={setContractsHUF}
                  placeholder="HUF or trust in which candidate/spouse/dependents have interest"
                />
                <TextareaField
                  label="Contracts by Partnership Firms"
                  value={contractsPartnershipFirms}
                  onChange={setContractsPartnershipFirms}
                  placeholder="Partnership firms in which candidate/spouse/dependents are partners"
                />
                <TextareaField
                  label="Contracts by Private Companies"
                  value={contractsPrivateCompanies}
                  onChange={setContractsPrivateCompanies}
                  placeholder="Private companies in which candidate/spouse/dependents have share"
                />
              </div>
            </SectionCard>

            {/* ═══ Section 14: Education ═══ */}
            <SectionCard
              id="education"
              title="14. Educational Qualification"
              subtitle="(10) My educational qualification is as under."
            >
              <TextareaField
                label="Highest Educational Qualification"
                value={educationalQualification}
                onChange={setEducationalQualification}
                placeholder="Full form of certificate/diploma/degree, name of School/College/University, and year of completion."
                rows={4}
              />
            </SectionCard>

            {/* ═══ Section 15: Verification ═══ */}
            <SectionCard
              id="verification"
              title="15. Verification"
              subtitle="Verified at ____ this the ____ day of ____"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Place of Verification"
                  value={verificationPlace}
                  onChange={setVerificationPlace}
                  path="verificationPlace"
                  warning={highImpactMissingByPath.get("verificationPlace")}
                />
                <Field
                  label="Date of Verification"
                  value={verificationDate}
                  onChange={setVerificationDate}
                  placeholder="DD/MM/YYYY"
                  path="verificationDate"
                  warning={highImpactMissingByPath.get("verificationDate")}
                />
              </div>
            </SectionCard>

            {/* ═══ Section 16: Oath Commissioner / Notary Details ═══ */}
            <SectionCard
              id="oathCommissioner"
              title="16. Oath Commissioner / Notary Details"
              subtitle="Before me, ____ (Name of the Oath Commissioner / Magistrate / Notary). The affidavit must be sworn before an Oath Commissioner, First Class Magistrate, or Notary Public."
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field
                  label="Name of Oath Commissioner / Notary"
                  value={oathCommissionerName}
                  onChange={setOathCommissionerName}
                  path="oathCommissionerName"
                  warning={highImpactMissingByPath.get("oathCommissionerName")}
                />
                <Field
                  label="Designation"
                  value={oathCommissionerDesignation}
                  onChange={setOathCommissionerDesignation}
                  placeholder='e.g. "Notary Public" / "Oath Commissioner"'
                  path="oathCommissionerDesignation"
                  warning={highImpactMissingByPath.get(
                    "oathCommissionerDesignation",
                  )}
                />
                <Field
                  label="Seal / Registration No."
                  value={oathCommissionerSealNo}
                  onChange={setOathCommissionerSealNo}
                  path="oathCommissionerSealNo"
                />
              </div>
            </SectionCard>

            {additionalFieldPaths.length > 0 && (
              <SectionCard
                id="additionalFields"
                title="Additional Fields"
                subtitle="Fallback fields from backend schema that are not yet modeled in this UI. Values entered here are preserved and sent in manual-entry payload."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {additionalFieldPaths.map((path) => (
                    <Field
                      key={path}
                      label={prettifyPathLabel(path)}
                      value={additionalFieldValues[path] || ""}
                      onChange={(value) =>
                        setAdditionalFieldValues((prev) => ({
                          ...prev,
                          [path]: value,
                        }))
                      }
                      placeholder={path}
                      path={path}
                      helperText="This value is sent as-is in preview, save, and export payloads."
                    />
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          <div
            className={
              mobileViewTab === "preview" ? "lg:hidden card" : "hidden"
            }
          >
            <DocxPreviewPanel
              previewLoading={previewLoading}
              previewError={previewError}
              previewRenderError={previewRenderError}
              previewBlobUrl={previewBlobUrl}
              previewPageCount={previewPageCount}
              previewCurrentPage={previewCurrentPage}
              previewLastRefreshedAt={previewLastRefreshedAt}
              previewStale={previewStale}
              previewScrollRef={previewScrollRef}
              previewHostRef={previewHostRef}
              onPreviewDocument={handlePreviewDocument}
              onRefreshPreview={handleRefreshPreview}
              onOpenExportDocx={handleExport}
              onDownloadRawDocx={handleDownloadPreviewDocx}
              validationState={sessionValidation}
              validationLoading={validationLoading}
              compact
            />
          </div>

          {/* ═══ Sticky action bar ═══ */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-ink-50/95 backdrop-blur border-t border-ink-400 px-4 py-3">
            <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="text-sm text-slate-400">
                {sessionId ? (
                  <span>
                    Session:{" "}
                    <span className="text-emerald-400 font-mono">
                      {sessionId.slice(0, 8)}…
                    </span>
                  </span>
                ) : (
                  <span>New affidavit — save to create session</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 md:flex md:gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary text-sm"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
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
                      Saving...
                    </span>
                  ) : (
                    "💾 Save Draft"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleValidate}
                  className="btn btn-secondary text-sm"
                >
                  ✅ Validate
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting || saving}
                  className="btn text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-card disabled:opacity-60"
                >
                  {exporting ? "Exporting..." : "📥 Export DOCX"}
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showExportChecklist && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="fixed bottom-28 right-4 z-50 w-[min(96vw,560px)] card border-amber-500/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-display font-semibold text-slate-100">
                      Pre-export checklist
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Validation found fields that still need attention. You can
                      still export, but review is recommended.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExportChecklist(false)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    ✕
                  </button>
                </div>

                {highImpactMissing.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-amber-300 mb-1">
                      High-impact empty fields
                    </p>
                    <ul className="space-y-1 text-sm text-slate-200 max-h-28 overflow-auto pr-1">
                      {highImpactMissing.map((field) => (
                        <li key={field.path}>• {field.label}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationIssues.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-amber-300 mb-1">
                      Structured data warnings
                    </p>
                    <ul className="space-y-1 text-sm text-slate-200 max-h-36 overflow-auto pr-1">
                      {validationIssues.slice(0, 8).map((issue) => (
                        <li key={issue.key}>• {issue.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(sessionValidation?.missingRequired || []).length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-amber-300 mb-1">
                      Backend required fields
                    </p>
                    <ul className="space-y-1 text-sm text-slate-200 max-h-36 overflow-auto pr-1">
                      {sessionValidation.missingRequired
                        .slice(0, 10)
                        .map((field, idx) => (
                          <li key={`${field}-${idx}`}>• {String(field)}</li>
                        ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExportChecklist(false)}
                    className="btn btn-secondary text-sm"
                  >
                    Review First
                  </button>
                  <button
                    type="button"
                    disabled={exporting || saving}
                    onClick={executeExportFlow}
                    className="btn bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-60"
                  >
                    Continue Export
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="hidden lg:block flex-1 min-w-[520px]">
          <div className="sticky top-24 space-y-4">
            <DocxPreviewPanel
              previewLoading={previewLoading}
              previewError={previewError}
              previewRenderError={previewRenderError}
              previewBlobUrl={previewBlobUrl}
              previewPageCount={previewPageCount}
              previewCurrentPage={previewCurrentPage}
              previewLastRefreshedAt={previewLastRefreshedAt}
              previewStale={previewStale}
              previewScrollRef={previewScrollRef}
              previewHostRef={previewHostRef}
              onPreviewDocument={handlePreviewDocument}
              onRefreshPreview={handleRefreshPreview}
              onOpenExportDocx={handleExport}
              onDownloadRawDocx={handleDownloadPreviewDocx}
              validationState={sessionValidation}
              validationLoading={validationLoading}
            />
          </div>
        </aside>
      </div>
    </ProtectedRoute>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Reusable sub-components
// ═══════════════════════════════════════════════════════════════════

function SectionCard({ id, title, subtitle, children }) {
  const [isOpen, setIsOpen] = useState(true);
  const sectionOrder = SECTIONS.findIndex((section) => section.id === id);
  const delay = sectionOrder >= 0 ? sectionOrder * 0.03 : 0.02;
  return (
    <motion.div
      id={`section-${id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay }}
      className="card scroll-mt-24"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 text-left lg:pointer-events-none"
      >
        <h2 className="text-lg font-semibold text-slate-100 mb-1 font-display">
          {title}
        </h2>
        <span className="text-slate-500 text-sm lg:hidden">
          {isOpen ? "Collapse" : "Expand"}
        </span>
      </button>
      {subtitle && (
        <p className="text-xs text-slate-500 italic mb-4">{subtitle}</p>
      )}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  helperText,
  warning,
}) {
  const autoHelpers = helperText ? [helperText] : [];

  return (
    <div className={className}>
      <div className="mb-1 space-y-1">
        <label className="block text-sm font-medium text-slate-300">
          {label}
        </label>
      </div>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full"
      />
      {warning && <p className="text-[11px] text-amber-300 mt-1">{warning}</p>}
      {autoHelpers.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {autoHelpers.slice(0, 2).map((line) => (
            <p key={`${label}-${line}`} className="text-[11px] text-slate-400">
              {line}
            </p>
          ))}
        </div>
      )}
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
  helperText,
  warning,
}) {
  const autoHelpers = helperText ? [helperText] : [];

  return (
    <div className={className}>
      <div className="mb-1 space-y-1">
        <label className="block text-sm font-medium text-slate-300">
          {label}
        </label>
      </div>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full"
      />
      {warning && <p className="text-[11px] text-amber-300 mt-1">{warning}</p>}
      {autoHelpers.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {autoHelpers.slice(0, 2).map((line) => (
            <p key={`${label}-${line}`} className="text-[11px] text-slate-400">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressRing({ value }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (Math.max(0, Math.min(value, 100)) / 100) * circumference;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="rgba(148,163,184,0.25)"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          stroke="rgb(16 185 129)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-slate-100">
        {value}%
      </span>
    </div>
  );
}

function CompletenessRows({
  totalCount,
  filledCount,
  templateCount,
  summaryCount,
  progressPercent,
  highImpactMissing,
  validationIssueCount,
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="metric-card">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Total input fields
          </p>
          <p className="text-lg font-semibold text-slate-100">{totalCount}</p>
        </div>
        <div className="metric-card">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Filled fields
          </p>
          <p className="text-lg font-semibold text-emerald-300">
            {filledCount}
          </p>
        </div>
        <div className="metric-card">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Mapped-to-template
          </p>
          <p className="text-lg font-semibold text-blue-200">{templateCount}</p>
        </div>
        <div className="metric-card">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Included-via-summary
          </p>
          <p className="text-lg font-semibold text-amber-200">{summaryCount}</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-emerald-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Completeness progress: {progressPercent}%
        </p>
      </div>
      {highImpactMissing.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-200 mb-1">
            High-impact fields recommended
          </p>
          <ul className="space-y-1 text-xs text-amber-100 max-h-24 overflow-auto pr-1">
            {highImpactMissing.slice(0, 5).map((field) => (
              <li key={field.path}>• {field.label}</li>
            ))}
          </ul>
        </div>
      )}
      {validationIssueCount > 0 && (
        <p className="text-xs text-amber-300 mt-2">
          Structured table checks currently show {validationIssueCount}{" "}
          warning(s).
        </p>
      )}
    </>
  );
}

function ExportCompletenessPanel({
  totalCount,
  filledCount,
  templateCount,
  summaryCount,
  progressPercent,
  highImpactMissing,
  validationIssueCount,
  onPreviewDocument,
}) {
  return (
    <div className="card border-blue-400/30">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-display font-semibold text-slate-100">
            Export Completeness
          </h3>
          <p className="text-xs text-slate-400">Live DOCX readiness insight</p>
        </div>
        <ProgressRing value={progressPercent} />
      </div>
      <CompletenessRows
        totalCount={totalCount}
        filledCount={filledCount}
        templateCount={templateCount}
        summaryCount={summaryCount}
        progressPercent={progressPercent}
        highImpactMissing={highImpactMissing}
        validationIssueCount={validationIssueCount}
      />
      <button
        type="button"
        onClick={onPreviewDocument}
        className="btn btn-secondary text-sm mt-4 w-full"
      >
        Preview Document
      </button>
    </div>
  );
}

function DocxPreviewPanel({
  previewLoading,
  previewError,
  previewRenderError,
  previewBlobUrl,
  previewPageCount,
  previewCurrentPage,
  previewLastRefreshedAt,
  previewStale,
  previewScrollRef,
  previewHostRef,
  onPreviewDocument,
  onRefreshPreview,
  onOpenExportDocx,
  onDownloadRawDocx,
  validationState,
  validationLoading,
  compact = false,
}) {
  const refreshedAtText = previewLastRefreshedAt
    ? new Date(previewLastRefreshedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Not yet generated";
  const validationNeedsAttention =
    validationState?.valid === false ||
    (validationState?.missingRequired || []).length > 0;
  const validationLabel =
    validationState?.valid === true && !validationNeedsAttention
      ? "Valid"
      : "Needs attention";

  return (
    <div className="card border-blue-400/25">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm md:text-base font-display font-semibold text-slate-100">
            Document Preview
          </h3>
          <p className="text-xs text-slate-400">
            Full page-by-page rendering of the generated affidavit DOCX.
          </p>
        </div>
        {previewStale && (
          <span className="inline-flex items-center rounded-full border border-amber-400/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
            Stale after edits
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <button
          type="button"
          onClick={onPreviewDocument}
          disabled={previewLoading}
          className="btn btn-secondary text-sm"
        >
          {previewLoading ? "Generating..." : "Preview Document"}
        </button>
        <button
          type="button"
          onClick={onRefreshPreview}
          disabled={previewLoading}
          className="btn btn-secondary text-sm"
        >
          Refresh Preview
        </button>
        <button
          type="button"
          onClick={onOpenExportDocx}
          className="btn bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
        >
          Open Export DOCX
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mb-3">
        <span>
          Pages:{" "}
          <span className="text-slate-100 font-semibold">
            {previewPageCount || 0}
          </span>
        </span>
        <span>
          Current:{" "}
          <span className="text-slate-100 font-semibold">
            {Math.min(previewCurrentPage, previewPageCount || 1)}
          </span>
        </span>
        <span>
          Last refreshed:{" "}
          <span className="text-slate-100 font-semibold">
            {refreshedAtText}
          </span>
        </span>
        <span>
          Validation:{" "}
          <span className="text-slate-100 font-semibold">
            {validationLabel}
          </span>
          {validationLoading && (
            <span className="text-slate-400"> (checking...)</span>
          )}
        </span>
      </div>

      {validationState?.error && (
        <div className="mb-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-100">
          Validation check error: {validationState.error}
        </div>
      )}

      {(validationState?.missingRequired || []).length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-100">
          <p className="font-semibold">Validation warnings</p>
          <ul className="mt-1 space-y-1 max-h-24 overflow-auto pr-1">
            {validationState.missingRequired.slice(0, 8).map((field, idx) => (
              <li key={`${field}-${idx}`}>• {String(field)}</li>
            ))}
          </ul>
        </div>
      )}

      {(previewError || previewRenderError) && (
        <div className="mb-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-100">
          <p className="font-semibold">Preview fallback mode</p>
          {previewError && (
            <p className="mt-1">Generation issue: {previewError}</p>
          )}
          {previewRenderError && (
            <p className="mt-1">
              Renderer issue: {previewRenderError}. You can still download the
              generated DOCX directly.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRefreshPreview}
              className="btn btn-secondary text-xs"
            >
              Retry Preview
            </button>
            <button
              type="button"
              onClick={onDownloadRawDocx}
              className="btn btn-secondary text-xs"
            >
              Download Preview DOCX
            </button>
            <button
              type="button"
              onClick={onOpenExportDocx}
              className="btn bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
            >
              Open Export DOCX
            </button>
          </div>
        </div>
      )}

      <div
        ref={previewScrollRef}
        className={`rounded-xl border border-ink-400 bg-ink-50/70 overflow-auto ${
          compact ? "h-[60vh]" : "h-[calc(100vh-22rem)] min-h-[480px]"
        }`}
      >
        <div className="docx-preview-host p-4">
          <div ref={previewHostRef} className="min-h-[220px]" />
          {!previewLoading && !previewBlobUrl && (
            <div className="rounded-lg border border-dashed border-ink-400 p-6 text-center text-sm text-slate-400">
              Click Preview Document to generate a full Word page preview.
            </div>
          )}
          {previewLoading && (
            <div className="rounded-lg border border-ink-400 p-6 text-center text-sm text-slate-300">
              Rendering DOCX preview...
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Preview renders backend generated DOCX pages only.
      </p>
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

ManualEntryPage.getLayout = function getLayout(page) {
  return <Layout fullWidth>{page}</Layout>;
};
