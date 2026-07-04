import { useTranslation } from "react-i18next";
import { useLanguage } from "../../hooks/useLanguage.js";

export default function LanguageSwitch({ compact = false }) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`flex items-center ${compact ? "gap-1" : "justify-between gap-3"}`}>
      {!compact ? <span className="text-sm font-medium text-on-surface">{t("language.label")}</span> : null}
      <div className="inline-flex rounded-full border border-outline-variant bg-surface-container-low p-1">
        {["uk", "en"].map((code) => {
          const active = language === code;
          return (
            <button
              key={code}
              className={`h-8 rounded-full px-3 text-xs font-bold transition active:scale-95 ${active ? "bg-primary-container text-on-primary shadow-sm" : "text-on-surface-variant"}`}
              type="button"
              onClick={() => setLanguage(code)}
            >
              {code.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
