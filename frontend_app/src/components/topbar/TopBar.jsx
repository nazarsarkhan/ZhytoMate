import { Link } from "react-router-dom";
import Icon from "../ui/Icon.jsx";

export default function TopBar({ title, backTo, rightIcon, onRightClick, dark = false }) {
  return (
    <header className={`sticky top-0 z-40 flex h-16 items-center justify-between px-container-padding shadow-sm sm:px-6 md:px-8 ${dark ? "bg-primary-container text-on-primary" : "bg-surface text-primary"}`}>
      {backTo ? (
        <Link to={backTo} className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-95">
          <Icon name="arrow_back" />
        </Link>
      ) : (
        <button className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-surface-container active:scale-95">
          <Icon name="menu" />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate px-3 text-center text-lg font-bold md:text-2xl">{title}</h1>
      <button className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-95" onClick={onRightClick}>
        {rightIcon ? <Icon name={rightIcon} /> : null}
      </button>
    </header>
  );
}
