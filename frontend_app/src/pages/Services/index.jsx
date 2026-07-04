import { Link } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { serviceCards } from "../../consts/serviceData.js";

export default function ServicesPage() {
  return (
    <Shell className="bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-surface-variant bg-surface px-container-padding py-5 sm:px-6 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold text-primary md:text-5xl">Services</h1>
          <label className="mt-4 flex h-12 items-center rounded-xl bg-surface-container-high px-3 transition focus-within:ring-2 focus-within:ring-primary-container md:h-14">
            <Icon name="search" className="text-outline" />
            <input className="ml-2 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-on-surface-variant" placeholder="Search services..." />
          </label>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-container-padding py-section-margin sm:px-6 md:px-8">
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {serviceCards.map((card) => (
            <Link key={card.title} to={card.href} className="motion-card interactive-card flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-surface-variant/60 bg-surface-container-lowest p-4 text-center shadow-soft transition active:scale-[0.98]">
              <span className={`flex h-14 w-14 items-center justify-center rounded-full ${card.tone}`}>
                <Icon name={card.icon} filled className="text-3xl" />
              </span>
              <span>
                <span className="block text-base font-bold text-primary">{card.title}</span>
                <span className="mt-1 block text-xs text-on-surface-variant">{card.subtitle}</span>
              </span>
            </Link>
          ))}
        </section>
      </main>
      <BottomNav active="services" dark />
    </Shell>
  );
}
