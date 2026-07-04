import { Link } from "react-router-dom";
import Icon from "../ui/Icon.jsx";

const navItems = [
  ["assistant", "/assistant", "smart_toy", "Main"],
  ["map", "#", "location_on", "Map"],
  ["news", "/news", "newspaper", "News"],
  ["profile", "#", "person", "Profile"],
];

export default function BottomNav({ active = "assistant", dark = false }) {
  return (
    <nav className={`fixed bottom-0 left-1/2 z-50 flex h-[72px] w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t px-4 sm:bottom-4 sm:rounded-full sm:border sm:shadow-header md:max-w-[520px] lg:bottom-5 lg:max-w-[760px] ${dark ? "border-white/10 bg-primary-container text-on-primary shadow-lg" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-sm"}`}>
      {navItems.map(([key, href, icon, label]) => {
        const isActive = key === active;
        const content = (
          <>
            {isActive && !dark ? <span className="absolute inset-x-2 top-2 h-10 rounded-2xl bg-primary-fixed/55" /> : null}
            <Icon name={icon} filled={isActive} className={`relative mb-1 text-[24px] ${isActive ? dark ? "text-secondary-container" : "text-primary" : dark ? "text-white/60" : ""}`} />
            <span className={`relative text-[10px] font-semibold ${isActive ? dark ? "text-on-primary" : "text-primary" : ""}`}>{label}</span>
          </>
        );

        return href === "#" ? (
          <button key={key} className="relative flex w-16 flex-col items-center rounded-xl p-2 transition active:scale-95">{content}</button>
        ) : (
          <Link key={key} to={href} className="relative flex w-16 flex-col items-center rounded-xl p-2 transition active:scale-95">{content}</Link>
        );
      })}
    </nav>
  );
}
