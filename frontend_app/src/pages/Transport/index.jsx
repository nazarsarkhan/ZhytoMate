import Shell from "../../components/layout/Shell.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { routes } from "../../consts/serviceData.js";

export default function TransportPage() {
  return (
    <Shell className="bg-surface pb-28">
      <header className="sticky top-0 z-40 border-b border-surface-variant bg-surface px-container-padding py-4 shadow-sm sm:px-6 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary-container md:text-4xl">Transport</h1>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-primary-container">
              <Icon name="tune" />
            </button>
          </div>
          <label className="flex h-12 items-center rounded-xl border border-surface-variant bg-surface-container-low px-3">
            <Icon name="search" className="text-outline" />
            <input className="ml-2 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Search routes, stops, or addresses..." />
          </label>
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
            {["All", "Trams", "Minibuses", "Trolleybus"].map((chip, index) => (
              <button key={chip} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${index === 0 ? "border-primary-container bg-primary-container text-on-primary" : "border-surface-variant bg-surface-container text-on-surface-variant"}`}>{chip}</button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl space-y-section-margin px-container-padding py-section-margin sm:px-6 md:px-8">
        <section className="relative h-36 overflow-hidden rounded-xl border border-surface-variant shadow-sm md:h-52">
          <div className="absolute inset-0 bg-cover bg-center opacity-70" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDFIcTUrz_vozHgyn2UEI0FVIgvyZvc9PSoUMFiKvLd0WefJsBLkEbSMS7TBtg5xVZ7NTgKbugqmKTOr0b1_0t5s5sgsqikXmw90GvUCAlQfU9XfRcG3Jf03ocFRlVwuDnAJtC7Hi4phWWP0pb9eccM5qV1GSo64atKqo6V2iZ_Pd0ivT683XjJSfl_EAwxBHGDyc_IVVCALaCD6Uzbr0V6RdkdGw6wR7nosmmvVOFev-20mmzomoNcBmY2lJaUwTMzit3EAytT-L4')" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-bold text-primary-container">
              <Icon name="map" filled /> Live Map View
            </div>
            <button className="rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-on-primary">Open</button>
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-on-surface">Nearby Routes</h2>
            <span className="text-xs text-on-surface-variant">Updating live...</span>
          </div>
          <div className="grid gap-stack-gap lg:grid-cols-2">
            {routes.map((route) => (
              <article key={route.number} className="rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-soft">
                <div className="flex gap-4">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-lg font-bold ${route.badge}`}>{route.number}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="truncate font-bold text-on-surface">{route.title}</h3>
                      <Icon name={route.saved ? "bookmark" : "bookmark_border"} filled={route.saved} className={route.saved ? "text-secondary-container" : "text-outline"} />
                    </div>
                    <p className="flex items-center gap-2 text-xs text-on-surface-variant"><Icon name={route.icon} className="text-base" /> {route.type} <span className="h-1 w-1 rounded-full bg-outline-variant" /> {route.direction}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {route.times.map((time, index) => (
                        <span key={time} className={`rounded-md border px-3 py-1.5 text-xs ${index === 0 && route.status !== "Delayed" ? "border-green-100 bg-green-50 font-bold text-green-700" : index === 1 && route.status === "Delayed" ? "border-orange-100 bg-orange-50 font-bold text-orange-700" : "border-surface-variant bg-surface-container text-on-surface-variant"}`}>{time}</span>
                      ))}
                      {route.status ? <span className={`ml-auto rounded px-2 py-1 text-xs font-bold ${route.status === "Delayed" ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700"}`}>{route.status}</span> : null}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <BottomNav active="services" dark />
    </Shell>
  );
}
