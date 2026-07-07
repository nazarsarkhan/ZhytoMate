import { Link } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import { adminNavItem, navItems } from "../../consts/navItems.js";
import { useCurrentUser } from "../../hooks/useCurrentUser.js";

export default function BottomNav({ active = "assistant", dark = false }) {
  const currentUser = useCurrentUser();
  const visibleItems = currentUser.data?.role === "admin" ? [...navItems, adminNavItem] : navItems;

  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 mx-auto flex min-h-[calc(72px+var(--safe-bottom))] w-full max-w-[1180px] items-center justify-between gap-2 border-t px-4 pb-safe-bottom sm:px-6 md:px-8 lg:hidden ${dark ? "border-white/10 bg-primary-container text-on-primary shadow-lg" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-sm"}`}>
      {visibleItems.map(({ key, href, icon, label }) => {
        const isActive = key === active;
        const content = (
          <>
            {isActive && !dark ? <span className="absolute inset-x-2 top-2 h-10 rounded-2xl bg-primary-fixed/55" /> : null}
            <Icon name={icon} filled={isActive} className={`relative mb-1 text-[24px] ${isActive ? dark ? "text-secondary-container" : "text-primary" : dark ? "text-white/60" : ""}`} />
            <span className={`relative text-[10px] font-semibold ${isActive ? dark ? "text-on-primary" : "text-primary" : ""}`}>{label}</span>
          </>
        );

        return <Link key={key} to={href} className="relative flex min-w-0 flex-1 flex-col items-center rounded-xl p-2 transition active:scale-95">{content}</Link>;
      })}
    </nav>
  );
}
