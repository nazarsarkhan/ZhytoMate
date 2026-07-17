import { NavLink } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import { adminNavItem, navItems } from "../../consts/navItems.js";
import { useAuth } from "../../hooks/useAuth.jsx";
import { useCurrentUser } from "../../hooks/useCurrentUser.js";

export default function SideNav() {
  const { logout } = useAuth();
  const currentUser = useCurrentUser();
  const visibleItems = currentUser.data?.role === "admin" ? [...navItems, adminNavItem] : navItems;

  return (
    <aside className="desktop-side-nav relative hidden h-auto min-h-full w-60 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-primary-container px-4 pb-6 pt-6 text-on-primary lg:sticky lg:top-0 lg:flex lg:h-dvh lg:min-h-0 lg:rounded-none">
      <div className="mb-8 flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
          <Icon name="location_city" filled className="text-[24px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-tight">ZhytoMate</span>
          <span className="block truncate text-xs text-white/50">Портал міських сервісів</span>
        </span>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5">
        {visibleItems.map(({ key, href, icon, label }) => (
          <NavLink
            key={key}
            to={href}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${isActive ? "bg-secondary-container font-bold text-on-secondary-container" : "font-semibold text-white/70 hover:bg-white/5 hover:text-white"}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={icon} filled={isActive} className="text-[22px]" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="shrink-0 border-t border-white/10 pt-4">
        <button
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
          type="button"
          onClick={() => logout()}
        >
          <Icon name="logout" className="text-[22px]" /> Вийти
        </button>
      </div>
    </aside>
  );
}
