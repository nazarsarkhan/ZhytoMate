import { Link, NavLink, useNavigate } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import { adminNavItem, navItems } from "../../consts/navItems.js";
import { useCurrentUser } from "../../hooks/useCurrentUser.js";

export default function SideNav() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const visibleItems = currentUser.data?.role === "admin" ? [...navItems, adminNavItem] : navItems;

  return (
    <aside className="absolute inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/10 bg-primary-container px-4 pb-6 pt-6 text-on-primary lg:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
          <Icon name="location_city" filled className="text-[24px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-tight">Zhytomyr Assistant</span>
          <span className="block truncate text-xs text-white/50">Портал міських сервісів</span>
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1.5">
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
      <div className="border-t border-white/10 pt-4">
        <Link className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white" to="/profile">
          <Icon name="settings" className="text-[22px]" /> Налаштування
        </Link>
        <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white" type="button" onClick={() => navigate("/assistant")}>
          <Icon name="logout" className="text-[22px]" /> Вийти
        </button>
      </div>
    </aside>
  );
}
