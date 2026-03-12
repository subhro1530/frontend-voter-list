import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import ProtectedRoute from "../../components/ProtectedRoute";
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

// ═══════════════════════════════════════════════════════════════════
//  PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function NominationManualEntryPage() {
  const router = useRouter();
  const { sessionId: querySessionId } = router.query;
  const { user } = useAuth();

  // ── form state ──
  const [sessionId, setSessionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);

  // Header
  const [state, setState] = useState("");

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
    nominationAPI
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

  // ── Populate form from loaded data ──
  function populateForm(d) {
    if (d.state) setState(d.state);
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
  function buildPayload() {
    const payload = {
      state,
      // Derive top-level fields for session listing
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
      proposers: proposers.filter(
        (p) => p.partNo || p.slNo || p.fullName || p.signature || p.date,
      ),
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
      criminal_firNos: convicted === "Yes" ? criminal_firNos : "",
      criminal_policeStation: convicted === "Yes" ? criminal_policeStation : "",
      criminal_district: convicted === "Yes" ? criminal_district : "",
      criminal_state: convicted === "Yes" ? criminal_state : "",
      criminal_sections: convicted === "Yes" ? criminal_sections : "",
      criminal_convictionDates:
        convicted === "Yes" ? criminal_convictionDates : "",
      criminal_courts: convicted === "Yes" ? criminal_courts : "",
      criminal_punishment: convicted === "Yes" ? criminal_punishment : "",
      criminal_releaseDates: convicted === "Yes" ? criminal_releaseDates : "",
      criminal_appealFiled: convicted === "Yes" ? criminal_appealFiled : "No",
      criminal_appealParticulars:
        convicted === "Yes" && criminal_appealFiled === "Yes"
          ? criminal_appealParticulars
          : "",
      criminal_appealCourts:
        convicted === "Yes" && criminal_appealFiled === "Yes"
          ? criminal_appealCourts
          : "",
      criminal_appealStatus:
        convicted === "Yes" && criminal_appealFiled === "Yes"
          ? criminal_appealStatus
          : "",
      criminal_disposalDates:
        convicted === "Yes" && criminal_appealFiled === "Yes"
          ? criminal_disposalDates
          : "",
      criminal_orderNature:
        convicted === "Yes" && criminal_appealFiled === "Yes"
          ? criminal_orderNature
          : "",
      // Part IIIA — Disqualification
      officeOfProfit,
      officeOfProfit_details:
        officeOfProfit === "Yes" ? officeOfProfit_details : "",
      insolvency,
      insolvency_discharged: insolvency === "Yes" ? insolvency_discharged : "",
      foreignAllegiance,
      foreignAllegiance_details:
        foreignAllegiance === "Yes" ? foreignAllegiance_details : "",
      disqualification_8A,
      disqualification_period:
        disqualification_8A === "Yes" ? disqualification_period : "",
      dismissalForCorruption,
      dismissal_date: dismissalForCorruption === "Yes" ? dismissal_date : "",
      govContracts,
      govContracts_details: govContracts === "Yes" ? govContracts_details : "",
      managingAgent,
      managingAgent_details:
        managingAgent === "Yes" ? managingAgent_details : "",
      disqualification_10A,
      section10A_date: disqualification_10A === "Yes" ? section10A_date : "",
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
    };
    if (sessionId) payload.sessionId = sessionId;
    return payload;
  }

  // ── Save ──
  async function handleSave() {
    setSaving(true);
    try {
      const res = await nominationAPI.manualEntry(buildPayload());
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
      const name = partI_candidateName || partII_candidateName || "";
      await nominationAPI.exportDocx(sessionId, name);
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

      {/* ── Sticky action bar ── */}
      <div className="fixed bottom-12 left-0 right-0 z-40">
        <div className="mx-auto max-w-6xl px-4">
          <div className="bg-ink-200/95 backdrop-blur border border-ink-400 rounded-2xl shadow-xl px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-slate-500 hidden sm:block">
              Form 2B — Nomination Paper
              {sessionId && (
                <span className="text-emerald-400 ml-2">
                  Session saved: {sessionId.slice(0, 8)}…
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn bg-neon-600 hover:bg-neon-500 text-white text-sm shadow-card"
              >
                {saving ? (
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
