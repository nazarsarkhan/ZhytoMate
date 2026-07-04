import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export const languages = ["uk", "en"];

export function useLanguage() {
  const { i18n } = useTranslation();

  const setLanguage = useCallback(
    (language) => {
      if (!languages.includes(language)) return;
      localStorage.setItem("zhytomate-language", language);
      i18n.changeLanguage(language);
    },
    [i18n],
  );

  return {
    language: i18n.resolvedLanguage || i18n.language || "uk",
    languages,
    setLanguage,
  };
}
