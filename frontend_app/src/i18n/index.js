import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import uk from "./locales/uk.json";

const savedLanguage = localStorage.getItem("zhytomate-language") || "uk";

i18n.use(initReactI18next).init({
  resources: {
    uk: { translation: uk },
    en: { translation: en },
  },
  lng: savedLanguage,
  fallbackLng: "uk",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
