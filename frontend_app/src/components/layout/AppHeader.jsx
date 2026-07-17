import { useEffect, useRef, useState } from "react";
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
  const headerRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = headerRef.current?.parentElement;
    if (!scrollContainer) return undefined;

    const updateScrolledState = () => setIsScrolled(scrollContainer.scrollTop > 24);
    updateScrolledState();
    scrollContainer.addEventListener("scroll", updateScrolledState, { passive: true });

    return () => scrollContainer.removeEventListener("scroll", updateScrolledState);
  }, []);

  if (backTo) {
    return (
      <header
        ref={headerRef}
        className={`sticky top-0 z-40 bg-primary-container px-container-padding text-on-primary transition-[padding,box-shadow] duration-300 sm:px-6 md:px-8 ${
          isScrolled ? "py-2 shadow-md md:py-3" : "pb-4 pt-[calc(16px+var(--safe-top))] shadow-sm"
        }`}
      >
        <div className="flex h-12 w-full items-center justify-between gap-3">
          <Link aria-label="Назад" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95" to={backTo}>
            <Icon name="arrow_back" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center text-lg font-bold md:text-2xl">{title}</h1>
          <HeaderAction icon={rightIcon} label={rightLabel} to={rightTo} onClick={onRightClick} />
        </div>
        {children ? <div className="mt-4 w-full">{children}</div> : null}
      </header>
    );
  }

  return (
    <header
      ref={headerRef}
      className={`bg-primary-container px-container-padding text-on-primary transition-[padding,box-shadow] duration-300 sm:px-6 md:px-8 ${
        isScrolled ? "py-3 shadow-md md:py-4" : `pb-7 pt-[calc(24px+var(--safe-top))] shadow-sm ${compact ? "" : "md:pb-8"}`
      }`}
    >
      <div className="w-full">
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
              {profile.avatarUrl ? (
                <img className="h-20 w-20 rounded-full border-2 border-white/20 object-cover shadow-inner" alt="" src={profile.avatarUrl} />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/20 bg-white/10 shadow-inner">
                  <Icon name="person" filled className="text-4xl text-on-primary" />
                </div>
              )}
              {profile.onEditAvatar ? (
                <button aria-label="Змінити фото" className="absolute bottom-0 left-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-container bg-secondary-container text-on-secondary-container active:scale-95" type="button" onClick={profile.onEditAvatar}>
                  <Icon name="photo_camera" className="text-base" />
                </button>
              ) : null}
              {profile.onEdit ? (
                <button aria-label="Редагувати ім'я" className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-container bg-secondary-container text-on-secondary-container active:scale-95" type="button" onClick={profile.onEdit}>
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
