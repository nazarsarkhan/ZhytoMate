import { Link } from "react-router-dom";
import Icon from "../ui/Icon.jsx";

function HeaderAction({ icon, label, to, onClick }) {
  if (!icon) return <span className="h-10 w-10 shrink-0" />;

  const className = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95";
  const content = <Icon name={icon} />;

  if (to) {
    return (
      <Link aria-label={label} className={className} to={to}>
        {content}
      </Link>
    );
  }

  return (
    <button aria-label={label} className={className} type="button" onClick={onClick}>
      {content}
    </button>
  );
}

export default function AppHeader({
  title,
  subtitle,
  backTo,
  rightIcon = "notifications",
  rightLabel = "Дія",
  rightTo,
  onRightClick,
  eyebrow,
  children,
  profile,
  compact = false,
}) {
  if (backTo) {
    return (
      <header className="sticky top-0 z-40 bg-primary-container px-container-padding pb-4 pt-[calc(16px+var(--safe-top))] text-on-primary shadow-sm sm:px-6 md:px-8">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3">
          <Link aria-label="Назад" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95" to={backTo}>
            <Icon name="arrow_back" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center text-lg font-bold md:text-2xl">{title}</h1>
          <HeaderAction icon={rightIcon} label={rightLabel} to={rightTo} onClick={onRightClick} />
        </div>
        {children ? <div className="mx-auto mt-4 w-full max-w-6xl">{children}</div> : null}
      </header>
    );
  }

  return (
    <header className={`rounded-b-[32px] bg-primary-container px-container-padding pb-7 pt-[calc(24px+var(--safe-top))] text-on-primary shadow-sm sm:px-6 md:rounded-b-[42px] md:px-8 ${compact ? "" : "md:pb-8"}`}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-white/15" />
            <div className="min-w-0">
              {eyebrow ? <p className="truncate text-xs font-bold uppercase tracking-wider text-primary-fixed-dim">{eyebrow}</p> : null}
              <h1 className="truncate text-xl font-bold md:text-2xl">Житомир</h1>
            </div>
          </div>
          <HeaderAction icon={rightIcon} label={rightLabel} to={rightTo || "/notifications"} onClick={onRightClick} />
        </div>
        {profile ? (
          <div className="mb-5 flex items-center gap-4">
            <div className="relative">
              <img className="h-20 w-20 rounded-full border-2 border-white/20 object-cover shadow-inner" alt="" src={profile.avatar} />
              {profile.onEdit ? (
                <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-container bg-secondary-container text-on-secondary-container active:scale-95" type="button" onClick={profile.onEdit}>
                  <Icon name="edit" className="text-base" />
                </button>
              ) : null}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold">{profile.name}</h2>
              <p className="mt-1 flex w-fit max-w-full items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs text-primary-fixed-dim">
                <Icon name="location_on" className="text-sm" />
                <span className="truncate">{profile.location}</span>
              </p>
            </div>
          </div>
        ) : null}
        {title ? <h2 className="mx-auto mb-4 max-w-3xl text-center text-3xl font-extrabold uppercase leading-tight sm:text-4xl md:text-5xl">{title}</h2> : null}
        {subtitle ? <p className="mx-auto mb-5 max-w-2xl text-center text-sm leading-6 text-primary-fixed-dim">{subtitle}</p> : null}
        {children}
      </div>
    </header>
  );
}
