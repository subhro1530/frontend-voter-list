import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import ProtectedRoute from "../../components/ProtectedRoute";
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
  { id: "govtAccom", label: "11. Govt. Accommodation" },
  { id: "profession", label: "12. Profession & Income" },
  { id: "contracts", label: "13. Contracts with Govt." },
  { id: "education", label: "14. Education" },
  { id: "verification", label: "15. Verification" },
];

// ═══════════════════════════════════════════════════════════════════
//  PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function ManualEntryPage() {
  const router = useRouter();
  const { sessionId: querySessionId } = router.query;
  const { user } = useAuth();

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

  // Section 11
  const [governmentAccommodation, setGovernmentAccommodation] = useState({
    occupied: "No",
    address: "",
    noDues: "No",
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

  // ── Nav state ──
  const [activeSectionId, setActiveSectionId] = useState("election");
  const [expandedImmovable, setExpandedImmovable] = useState({});
  const [expandedPan, setExpandedPan] = useState({ 0: true });

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
        populateForm(d);
      })
      .catch((err) =>
        toast.error("Failed to load session: " + (err.message || "")),
      )
      .finally(() => setLoadingSession(false));
  }, [querySessionId]);

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
    if (d.governmentAccommodation)
      setGovernmentAccommodation({
        occupied: "No",
        address: "",
        noDues: "No",
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
  }

  // ── Build payload ──
  function buildPayload() {
    const payload = {
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
    };
    if (sessionId) payload.sessionId = sessionId;
    return payload;
  }

  // ── Save ──
  async function handleSave() {
    setSaving(true);
    try {
      const res = await affidavitAPI.manualEntry(buildPayload());
      if (res.sessionId && !sessionId) {
        setSessionId(res.sessionId);
        router.replace(
          { pathname: router.pathname, query: { sessionId: res.sessionId } },
          undefined,
          { shallow: true },
        );
      }
      toast.success("Draft saved successfully!");
    } catch (err) {
      toast.error("Save failed: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  // ── Export ──
  async function handleExport() {
    if (!sessionId) {
      toast.error("Please save the draft first before exporting.");
      return;
    }
    setExporting(true);
    try {
      await affidavitAPI.exportDocx(sessionId, candidateName);
      toast.success("DOCX downloaded!");
    } catch (err) {
      toast.error("Export failed: " + (err.message || ""));
    } finally {
      setExporting(false);
    }
  }

  // ── Scroll to section ──
  function scrollToSection(id) {
    setActiveSectionId(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <div className="flex gap-6">
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
        <div className="flex-1 min-w-0 space-y-6 pb-32">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-semibold text-slate-50 flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20 text-2xl border border-indigo-400/50 shadow-card">
                    📝
                  </span>
                  Form 26 — Manual Entry
                </h1>
                <p className="text-slate-400 mt-2 ml-14">
                  Fill the affidavit form manually. All fields are optional.
                  {sessionId && (
                    <span className="ml-2 text-emerald-400 text-xs">
                      Session: {sessionId.slice(0, 8)}…
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/admin/dashboard"
                  className="btn btn-secondary text-sm"
                >
                  ← Back
                </Link>
              </div>
            </div>
          </motion.div>

          {/* ═══ Section 1: Election Details ═══ */}
          <SectionCard
            id="election"
            title="1. Election Details"
            subtitle='Header fields: "AFFIDAVIT TO BE FILED BY THE CANDIDATE ALONGWITH NOMINATION PAPER BEFORE THE RETURNING OFFICER FOR ELECTION TO ____ (NAME OF THE HOUSE) FROM ____ CONSTITUENCY"'
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field
                label="Name of the House"
                placeholder='e.g. "Legislative Assembly"'
                value={houseName}
                onChange={setHouseName}
              />
              <Field
                label="Constituency Name"
                placeholder='e.g. "116 BIDHANNAGAR"'
                value={constituency}
                onChange={setConstituency}
              />
              <Field
                label="State"
                placeholder='e.g. "WEST BENGAL"'
                value={state}
                onChange={setState}
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
              />
              <Field
                label="Father's / Mother's / Husband's Name"
                value={fatherMotherHusbandName}
                onChange={setFatherMotherHusbandName}
              />
              <Field
                label="Age (years)"
                value={age}
                onChange={setAge}
                placeholder="Just the number"
              />
              <Field
                label="Political Party Name"
                value={party}
                onChange={setParty}
                placeholder="Leave blank if independent"
              />
            </div>
            <TextareaField
              label="Full Postal Address"
              value={postalAddress}
              onChange={setPostalAddress}
              placeholder="Mention full postal address"
            />
            <div className="flex items-center gap-3 mt-4">
              <input
                type="checkbox"
                id="isIndependent"
                checked={isIndependent}
                onChange={(e) => setIsIndependent(e.target.checked)}
                className="w-5 h-5 rounded border-ink-400 bg-ink-100 text-neon-500 focus:ring-neon-400"
              />
              <label htmlFor="isIndependent" className="text-sm text-slate-300">
                Contesting as Independent
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Field
                label="Enrolled Constituency & State"
                value={enrolledConstituency}
                onChange={setEnrolledConstituency}
              />
              <Field
                label="Serial No. in Electoral Roll"
                value={serialNumber}
                onChange={setSerialNumber}
              />
              <Field
                label="Part No. in Electoral Roll"
                value={partNumber}
                onChange={setPartNumber}
              />
              <Field
                label="Telephone Number(s)"
                value={telephone}
                onChange={setTelephone}
              />
              <Field
                label="Email ID"
                value={email}
                onChange={setEmail}
                placeholder="if any"
              />
              <Field
                label="Social Media Account (i)"
                value={socialMedia1}
                onChange={setSocialMedia1}
                placeholder="if any"
              />
              <Field
                label="Social Media Account (ii)"
                value={socialMedia2}
                onChange={setSocialMedia2}
              />
              <Field
                label="Social Media Account (iii)"
                value={socialMedia3}
                onChange={setSocialMedia3}
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
                          { key: "courtName", label: "(b) Name of the Court" },
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
                      setConvictions((prev) => [...prev, DEFAULT_CONVICTION()])
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
                                label: "Investment (development/construction)",
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
              />
              <Field
                label="Date of Verification"
                value={verificationDate}
                onChange={setVerificationDate}
                placeholder="DD/MM/YYYY"
              />
            </div>
          </SectionCard>

          {/* ═══ Sticky action bar ═══ */}
          <div className="fixed bottom-12 left-0 right-0 z-40 bg-ink-50/95 backdrop-blur border-t border-ink-400 px-6 py-3">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
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
              <div className="flex gap-3">
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
                  onClick={handleExport}
                  disabled={!sessionId || exporting}
                  className={`btn text-sm ${
                    sessionId
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-card"
                      : "bg-ink-200 text-slate-500 cursor-not-allowed border border-ink-400"
                  }`}
                >
                  {exporting ? "Exporting..." : "📥 Export DOCX"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

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
