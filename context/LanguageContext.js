import { createContext, useContext, useState, useEffect } from "react";

const LanguageContext = createContext();

// Translations dictionary
const translations = {
  en: {
    // Header & Navigation
    "Voter List Console": "Voter List Console",
    Dashboard: "Dashboard",
    Sessions: "Sessions",
    Upload: "Upload",
    Users: "Users",
    "API Keys": "API Keys",
    Stats: "Stats",
    Agent: "Agent",
    "Search Voters": "Search Voters",
    "Sign In": "Sign In",
    Register: "Register",
    "Sign Out": "Sign Out",
    "My Profile": "My Profile",
    "Admin Dashboard": "Admin Dashboard",

    // Stats Page
    Statistics: "Statistics",
    "View voter demographics and print statistics":
      "View voter demographics and print statistics",
    Filters: "Filters",
    Assembly: "Assembly",
    "All Assemblies": "All Assemblies",
    Session: "Session",
    "All Sessions": "All Sessions",
    "Print Statistics": "Print Statistics",
    "Total Voters": "Total Voters",
    Printed: "Printed",
    "Not Printed": "Not Printed",
    "Print Progress": "Print Progress",
    "Religion Distribution": "Religion Distribution",
    "Gender Distribution": "Gender Distribution",
    "No religion data available": "No religion data available",
    "No gender data available": "No gender data available",
    Hindu: "Hindu",
    Muslim: "Muslim",
    Christian: "Christian",
    Sikh: "Sikh",
    Buddhist: "Buddhist",
    Jain: "Jain",
    Other: "Other",
    Male: "Male",
    Female: "Female",
    Unknown: "Unknown",

    // Dashboard
    "Overview of your voter list application":
      "Overview of your voter list application",
    "Total Sessions": "Total Sessions",
    "Printed Slips": "Printed Slips",
    "Total Users": "Total Users",
    "Quick Actions": "Quick Actions",
    "Upload New PDF": "Upload New PDF",
    "View All Sessions": "View All Sessions",
    "Manage Users": "Manage Users",
    "View Statistics": "View Statistics",
    "Recent Sessions": "Recent Sessions",
    "View all": "View all",
    voters: "voters",
    pages: "pages",
    "No sessions yet. Upload a PDF to get started.":
      "No sessions yet. Upload a PDF to get started.",

    // API Keys
    "API Key Availability": "API Key Availability",
    active: "active",
    "of API keys are available for use": "of API keys are available for use",
    "API Engine Status": "API Engine Status",
    Total: "Total",
    Active: "Active",
    Busy: "Busy",
    "Rate Limited": "Rate Limited",
    Exhausted: "Exhausted",

    // Common
    Loading: "Loading",
    Error: "Error",
    Success: "Success",
    Cancel: "Cancel",
    Save: "Save",
    Delete: "Delete",
    Edit: "Edit",
    Search: "Search",
    "Select Language": "Select Language",
  },
  hi: {
    // Header & Navigation
    "Voter List Console": "मतदाता सूची कंसोल",
    Dashboard: "डैशबोर्ड",
    Sessions: "सत्र",
    Upload: "अपलोड",
    Users: "उपयोगकर्ता",
    "API Keys": "एपीआई कुंजी",
    Stats: "आंकड़े",
    Agent: "एजेंट",
    "Search Voters": "मतदाता खोजें",
    "Sign In": "साइन इन करें",
    Register: "पंजीकरण करें",
    "Sign Out": "साइन आउट",
    "My Profile": "मेरी प्रोफ़ाइल",
    "Admin Dashboard": "एडमिन डैशबोर्ड",

    // Stats Page
    Statistics: "आंकड़े",
    "View voter demographics and print statistics":
      "मतदाता जनसांख्यिकी और प्रिंट आंकड़े देखें",
    Filters: "फ़िल्टर",
    Assembly: "विधानसभा",
    "All Assemblies": "सभी विधानसभाएं",
    Session: "सत्र",
    "All Sessions": "सभी सत्र",
    "Print Statistics": "प्रिंट आंकड़े",
    "Total Voters": "कुल मतदाता",
    Printed: "प्रिंट हुआ",
    "Not Printed": "प्रिंट नहीं हुआ",
    "Print Progress": "प्रिंट प्रगति",
    "Religion Distribution": "धर्म वितरण",
    "Gender Distribution": "लिंग वितरण",
    "No religion data available": "कोई धर्म डेटा उपलब्ध नहीं",
    "No gender data available": "कोई लिंग डेटा उपलब्ध नहीं",
    Hindu: "हिंदू",
    Muslim: "मुस्लिम",
    Christian: "ईसाई",
    Sikh: "सिख",
    Buddhist: "बौद्ध",
    Jain: "जैन",
    Other: "अन्य",
    Male: "पुरुष",
    Female: "महिला",
    Unknown: "अज्ञात",

    // Dashboard
    "Overview of your voter list application":
      "आपके मतदाता सूची एप्लिकेशन का अवलोकन",
    "Total Sessions": "कुल सत्र",
    "Printed Slips": "प्रिंटेड स्लिप",
    "Total Users": "कुल उपयोगकर्ता",
    "Quick Actions": "त्वरित कार्रवाई",
    "Upload New PDF": "नया पीडीएफ अपलोड करें",
    "View All Sessions": "सभी सत्र देखें",
    "Manage Users": "उपयोगकर्ता प्रबंधित करें",
    "View Statistics": "आंकड़े देखें",
    "Recent Sessions": "हाल के सत्र",
    "View all": "सभी देखें",
    voters: "मतदाता",
    pages: "पृष्ठ",
    "No sessions yet. Upload a PDF to get started.":
      "अभी तक कोई सत्र नहीं। शुरू करने के लिए एक पीडीएफ अपलोड करें।",

    // API Keys
    "API Key Availability": "एपीआई कुंजी उपलब्धता",
    active: "सक्रिय",
    "of API keys are available for use": "एपीआई कुंजी उपयोग के लिए उपलब्ध हैं",
    "API Engine Status": "एपीआई इंजन स्थिति",
    Total: "कुल",
    Active: "सक्रिय",
    Busy: "व्यस्त",
    "Rate Limited": "दर सीमित",
    Exhausted: "समाप्त",

    // Common
    Loading: "लोड हो रहा है",
    Error: "त्रुटि",
    Success: "सफलता",
    Cancel: "रद्द करें",
    Save: "सहेजें",
    Delete: "हटाएं",
    Edit: "संपादित करें",
    Search: "खोजें",
    "Select Language": "भाषा चुनें",
  },
  bn: {
    // Header & Navigation
    "Voter List Console": "ভোটার তালিকা কনসোল",
    Dashboard: "ড্যাশবোর্ড",
    Sessions: "সেশন",
    Upload: "আপলোড",
    Users: "ব্যবহারকারী",
    "API Keys": "এপিআই কী",
    Stats: "পরিসংখ্যান",
    Agent: "এজেন্ট",
    "Search Voters": "ভোটার খুঁজুন",
    "Sign In": "সাইন ইন",
    Register: "নিবন্ধন",
    "Sign Out": "সাইন আউট",
    "My Profile": "আমার প্রোফাইল",
    "Admin Dashboard": "অ্যাডমিন ড্যাশবোর্ড",

    // Stats Page
    Statistics: "পরিসংখ্যান",
    "View voter demographics and print statistics":
      "ভোটার জনসংখ্যা এবং প্রিন্ট পরিসংখ্যান দেখুন",
    Filters: "ফিল্টার",
    Assembly: "বিধানসভা",
    "All Assemblies": "সমস্ত বিধানসভা",
    Session: "সেশন",
    "All Sessions": "সমস্ত সেশন",
    "Print Statistics": "প্রিন্ট পরিসংখ্যান",
    "Total Voters": "মোট ভোটার",
    Printed: "প্রিন্ট হয়েছে",
    "Not Printed": "প্রিন্ট হয়নি",
    "Print Progress": "প্রিন্ট অগ্রগতি",
    "Religion Distribution": "ধর্ম বিতরণ",
    "Gender Distribution": "লিঙ্গ বিতরণ",
    "No religion data available": "কোন ধর্মের তথ্য নেই",
    "No gender data available": "কোন লিঙ্গের তথ্য নেই",
    Hindu: "হিন্দু",
    Muslim: "মুসলিম",
    Christian: "খ্রিস্টান",
    Sikh: "শিখ",
    Buddhist: "বৌদ্ধ",
    Jain: "জৈন",
    Other: "অন্যান্য",
    Male: "পুরুষ",
    Female: "মহিলা",
    Unknown: "অজানা",

    // Dashboard
    "Overview of your voter list application":
      "আপনার ভোটার তালিকা অ্যাপ্লিকেশনের সংক্ষিপ্ত বিবরণ",
    "Total Sessions": "মোট সেশন",
    "Printed Slips": "প্রিন্টেড স্লিপ",
    "Total Users": "মোট ব্যবহারকারী",
    "Quick Actions": "দ্রুত কর্ম",
    "Upload New PDF": "নতুন পিডিএফ আপলোড করুন",
    "View All Sessions": "সমস্ত সেশন দেখুন",
    "Manage Users": "ব্যবহারকারী পরিচালনা করুন",
    "View Statistics": "পরিসংখ্যান দেখুন",
    "Recent Sessions": "সাম্প্রতিক সেশন",
    "View all": "সব দেখুন",
    voters: "ভোটার",
    pages: "পৃষ্ঠা",
    "No sessions yet. Upload a PDF to get started.":
      "এখনও কোন সেশন নেই। শুরু করতে একটি পিডিএফ আপলোড করুন।",

    // API Keys
    "API Key Availability": "এপিআই কী উপলব্ধতা",
    active: "সক্রিয়",
    "of API keys are available for use": "এপিআই কী ব্যবহারের জন্য উপলব্ধ",
    "API Engine Status": "এপিআই ইঞ্জিন স্থিতি",
    Total: "মোট",
    Active: "সক্রিয়",
    Busy: "ব্যস্ত",
    "Rate Limited": "হার সীমিত",
    Exhausted: "নিঃশেষিত",

    // Common
    Loading: "লোড হচ্ছে",
    Error: "ত্রুটি",
    Success: "সফল",
    Cancel: "বাতিল",
    Save: "সংরক্ষণ",
    Delete: "মুছুন",
    Edit: "সম্পাদনা",
    Search: "অনুসন্ধান",
    "Select Language": "ভাষা নির্বাচন করুন",
  },
};

const languageNames = {
  en: "English",
  hi: "हिंदी (Hindi)",
  bn: "বাংলা (Bengali)",
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("en");

  // Load saved language from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("appLanguage");
      if (saved && translations[saved]) {
        setLanguage(saved);
      }
    }
  }, []);

  // Save language preference
  const changeLanguage = (lang) => {
    setLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("appLanguage", lang);
    }
  };

  // Translation function
  const t = (key) => {
    return translations[language]?.[key] || translations.en?.[key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: changeLanguage,
        t,
        languages: Object.keys(translations),
        languageNames,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
