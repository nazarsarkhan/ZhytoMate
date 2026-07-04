import { Link } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { news } from "../../consts/homeData.js";

export default function NewsPage() {
  return (
    <Shell className="bg-background pb-28">
      <header className="rounded-b-[32px] bg-primary-container px-container-padding pb-8 pt-6 text-on-primary shadow-sm sm:px-6 md:rounded-b-[42px] md:px-8 md:pt-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/15" />
              <h1 className="text-xl font-bold md:text-2xl">Житомир</h1>
            </div>
            <Link to="/notifications"><Icon name="notifications" /></Link>
          </div>
          <h2 className="mx-auto mb-6 max-w-3xl text-center text-3xl font-extrabold uppercase leading-tight sm:text-4xl md:text-5xl">Новини та події Житомира</h2>
          <label className="mx-auto flex h-12 max-w-3xl items-center rounded-xl bg-surface px-4 text-on-surface shadow-sm transition focus-within:ring-2 focus-within:ring-secondary-container md:h-14">
            <Icon name="search" className="text-on-primary-container" />
            <input className="ml-3 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-on-surface-variant" placeholder="Пошук новин..." />
          </label>
          <div className="no-scrollbar mx-auto mt-4 flex max-w-3xl gap-3 overflow-x-auto md:justify-center">
            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon name="tune" /></button>
            {["Усі", "Комуналка", "Транспорт", "Офіційно", "Події"].map((chip, index) => (
              <button key={chip} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${index === 0 ? "border-secondary-container bg-secondary-container text-on-secondary-container" : "border-white/20 bg-white/10 text-on-primary"}`}>{chip}</button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl gap-3 px-container-padding py-section-margin sm:px-6 md:grid-cols-2 md:px-8 lg:grid-cols-3">
        {news.map((item) => (
          <Link key={item.title} to={item.title.includes("Фестиваль") ? "/news/flower-festival" : "/news"} className="motion-card interactive-card flex gap-4 rounded-xl border border-surface-variant bg-surface p-4 shadow-soft transition active:scale-[0.98]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary-container">
              <Icon name={item.icon} filled />
            </span>
            <span className="min-w-0 flex-1">
              <span className="mb-2 flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                <span className="truncate">{item.source}</span>
                <span className="shrink-0">{item.date}</span>
              </span>
              <span className="block text-base font-bold leading-tight text-on-surface">{item.title}</span>
              <span className="mt-2 block text-sm leading-5 text-on-surface-variant">{item.text}</span>
            </span>
          </Link>
        ))}
      </main>
      <BottomNav active="news" />
    </Shell>
  );
}
