import { Link } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { statusCards } from "../../consts/homeData.js";

export default function AssistantPage() {
  return (
    <Shell className="bg-background pb-28">
      <header className="relative z-10 h-[265px] rounded-b-3xl bg-primary-container px-4 pb-6 pt-12 text-on-primary shadow-header sm:px-6 md:h-[300px] md:rounded-b-[42px] md:px-8 lg:h-[310px] lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between md:mb-8">
            <div className="flex items-center gap-3">
              <img className="h-12 w-12 rounded-full border-2 border-white/20 object-cover shadow-inner md:h-16 md:w-16" alt="" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2E9jilZExfADABzvi5iNsDqUbEsEWRXK67mBTwLXkHMTHuJ4fJ12arV_62Fokw8GoeOKC7ZCcKaTjDNayaVcfrtWZoE3x0bbzXQDv_srhA6-Q78yiKq87rENP2xFvusa1F1-B9TVAVfpqOUk2ZK27qZ8dlWRbccwd6M6sDfjrtk0EdFcohEdRTFiJ7DQZLaoj7q3OQETeNhiggwAiqR73mB3sNe1gw-MTOzKVpiQHpktYi4cJSgPgHPAid3OKOC4zCD58aKL_vhI" />
              <div>
                <h1 className="text-base font-bold leading-tight md:text-xl">Вітаємо,</h1>
                <p className="text-xl font-bold leading-tight md:text-3xl">Олександр</p>
              </div>
            </div>
            <Link to="/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur-sm transition hover:bg-white/20 active:scale-95 md:h-12 md:w-12">
              <Icon name="notifications" />
              <span className="pulse-dot absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-primary-container bg-error" />
            </Link>
          </div>
          <button className="flex max-w-[250px] items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-md transition hover:bg-white/20 active:scale-95 md:max-w-md md:px-5 md:py-3">
            <span className="truncate">Житомир, вул. Театральна...</span>
            <Icon name="edit" className="text-sm" />
          </button>
        </div>
      </header>

      <main className="relative z-20 -mt-8 space-y-section-margin md:mx-auto md:max-w-6xl md:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start lg:gap-6 lg:space-y-0 lg:px-10">
        <section className="overflow-hidden md:overflow-visible">
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-container-padding pb-2 sm:px-6 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {statusCards.map((card) => (
              <article key={card.title} className="motion-card interactive-card h-[120px] w-[75%] shrink-0 snap-center rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm md:h-40 md:w-auto md:p-5">
                <span className="mb-2 block text-xs font-medium text-on-surface-variant">{card.label}</span>
                <div className="flex h-[70px] items-center gap-3 md:h-24 md:flex-col md:items-start md:justify-end">
                  <Icon name={card.icon} filled className={`float-soft text-[40px] md:text-[46px] ${card.tone}`} />
                  <div>
                    <h2 className="text-3xl font-bold leading-none text-on-surface md:text-2xl lg:text-3xl">{card.title}</h2>
                    <p className={`mt-1 text-xs font-medium ${card.tone}`}>{card.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-2 flex justify-center gap-1 md:hidden">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-container" />
            <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
            <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
          </div>
        </section>

        <section className="motion-card interactive-card mx-4 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm sm:mx-6 md:mx-0 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-on-surface">AI Асистент</h2>
            <Link to="/chat-history" className="flex items-center gap-1 text-xs font-medium text-on-primary-container">
              <Icon name="history" className="text-base" /> Історія чатів
            </Link>
          </div>
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container shadow-sm">
              <Icon name="smart_toy" className="text-lg text-on-primary" />
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-outline-variant/20 bg-surface-container p-4 text-sm leading-5 text-on-surface-variant">
              Ні. Нове відключення на вул. Малобердичівська. Як перевірити графік відключень строжизіння.
            </div>
          </div>
          <div className="mb-6 flex flex-wrap gap-2">
            {["Де ЦНАП?", "Перевірити графік відключень", "Створити звіт про яму"].map((label) => (
              <button key={label} className="rounded-full border border-outline-variant/50 px-4 py-2 text-sm text-on-surface transition hover:border-primary-container hover:bg-primary-fixed/35 active:scale-95">{label}</button>
            ))}
          </div>
          <div className="mb-4 flex h-14 items-center rounded-2xl border border-outline-variant/50 bg-surface shadow-sm focus-within:border-primary-container">
            <input className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-sm outline-none placeholder:text-outline" placeholder="Запитай асистента..." />
            <button className="mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed/60 text-on-primary-fixed active:scale-95">
              <Icon name="mic" filled className="text-xl" />
            </button>
          </div>
          <button className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container shadow-md transition hover:bg-secondary-fixed hover:shadow-lg active:scale-[0.98]">
            Запитати AI <Icon name="arrow_forward" className="text-xl" />
          </button>
        </section>
      </main>
      <BottomNav active="assistant" dark />
    </Shell>
  );
}
