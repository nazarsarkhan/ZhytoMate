import { Link } from "react-router-dom";
import Icon from "../ui/Icon.jsx";

export default function PageHero({ title, subtitle, children }) {
  return (
    <header className="rounded-b-[32px] bg-primary-container px-container-padding pb-8 pt-[calc(24px+var(--safe-top))] text-on-primary shadow-sm sm:px-6 md:rounded-b-[42px] md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-white/15" />
            <h1 className="truncate text-xl font-bold md:text-2xl">Житомир</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/notifications" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition active:scale-95">
              <Icon name="notifications" />
            </Link>
          </div>
        </div>
        <h2 className="mx-auto mb-4 max-w-3xl text-center text-3xl font-extrabold uppercase leading-tight sm:text-4xl md:text-5xl">{title}</h2>
        {subtitle ? <p className="mx-auto mb-5 max-w-2xl text-center text-sm leading-6 text-primary-fixed-dim">{subtitle}</p> : null}
        {children}
      </div>
    </header>
  );
}
