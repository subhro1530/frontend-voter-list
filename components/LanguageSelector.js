import { useLanguage } from "../context/LanguageContext";

export default function LanguageSelector({ className = "" }) {
  const { language, setLanguage, languages, languageNames } = useLanguage();

  return (
    <div className={`relative ${className}`}>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="appearance-none bg-ink-200 border border-ink-400 rounded-lg px-3 py-1.5 pr-8 text-sm text-slate-100 hover:border-neon-400 focus:border-neon-400 focus:outline-none cursor-pointer transition-colors"
        title="Select Language"
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang === "en" ? "🇬🇧" : lang === "hi" ? "🇮🇳" : "🇧🇩"}{" "}
            {languageNames[lang]}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className="w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
