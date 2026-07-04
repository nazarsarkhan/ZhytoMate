import { Link } from "react-router-dom";
import Icon from "../ui/Icon.jsx";

export default function TopBar({ title, backTo, rightIcon, onRightClick, dark = false }) {
  const rightTo = rightIcon === "notifications" && !onRightClick ? "/notifications" : null;
  const buttonClass = "flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-95";

  return (
    <header className={`sticky top-0 z-40 flex min-h-[calc(64px+var(--safe-top))] items-center justify-between px-container-padding pt-safe-top shadow-sm sm:px-6 md:px-8 ${dark ? "bg-primary-container text-on-primary" : "bg-surface text-primary"}`}>
      {backTo ? (
        <Link to={backTo} className={buttonClass}>
          <Icon name="arrow_back" />
        </Link>
      ) : (
        <button className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-surface-container active:scale-95" type="button">
          <Icon name="menu" />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate px-3 text-center text-lg font-bold md:text-2xl">{title}</h1>
      {rightTo ? (
        <Link className={buttonClass} to={rightTo}>{rightIcon ? <Icon name={rightIcon} /> : null}</Link>
      ) : onRightClick ? (
        <button className={buttonClass} type="button" onClick={onRightClick}>
          {rightIcon ? <Icon name={rightIcon} /> : null}
        </button>
      ) : (
        <span className="h-10 w-10 shrink-0" />
      )}
    </header>
  );
}
