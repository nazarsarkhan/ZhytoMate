import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../ui/Icon.jsx";

const navItems = [
  ["assistant", "/assistant", "smart_toy", "nav.main"],
  ["services", "/services", "apps", "nav.services"],
  ["news", "/news", "newspaper", "nav.news"],
  ["profile", "/profile", "person", "nav.profile"],
];

export default function BottomNav({ active = "assistant", dark = false }) {
  const { t } = useTranslation();

  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex min-h-[calc(72px+var(--safe-bottom))] w-full max-w-[1180px] items-center justify-between gap-2 border-t px-4 pb-safe-bottom sm:px-6 md:px-8 ${dark ? "border-white/10 bg-primary-container text-on-primary shadow-lg" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-sm"}`}>
      {navItems.map(([key, href, icon, labelKey]) => {
        const isActive = key === active;
        const content = (
          <>
            {isActive && !dark ? <span className="absolute inset-x-2 top-2 h-10 rounded-2xl bg-primary-fixed/55" /> : null}
            <Icon name={icon} filled={isActive} className={`relative mb-1 text-[24px] ${isActive ? dark ? "text-secondary-container" : "text-primary" : dark ? "text-white/60" : ""}`} />
            <span className={`relative text-[10px] font-semibold ${isActive ? dark ? "text-on-primary" : "text-primary" : ""}`}>{t(labelKey)}</span>
          </>
        );

        return <Link key={key} to={href} className="relative flex min-w-0 flex-1 flex-col items-center rounded-xl p-2 transition active:scale-95">{content}</Link>;
      })}
    </nav>
  );
}
