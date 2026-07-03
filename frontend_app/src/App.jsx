import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";

const statusCards = [
  { label: "Погода", icon: "sunny", title: "18°C", text: "Сонячно", tone: "text-secondary-container" },
  { label: "Повітряна тривога", icon: "security", title: "Тривоги немає", text: "Безпечно", tone: "text-green-600" },
  { label: "Статус послуг", icon: "bolt", title: "Електрика", text: "Графік відключень", tone: "text-secondary" },
];

const chats = [
  ["Графік відключень на завтра...", "Сьогодні, 14:30", true],
  ["Де знаходиться найближчий ЦНАП?", "Вчора, 09:15", true],
  ["Як оплатити комуналку онлайн?", "12 Травня, 18:42"],
  ["Статус заявки на ремонт дороги", "10 Травня, 11:20"],
  ["Розклад руху тролейбуса №3", "05 Травня, 08:05"],
  ["Запис до сімейного лікаря", "03 Травня, 17:15"],
  ["Куди звернутись щодо освітлення?", "29 Квітня, 20:10"],
];

const notifications = [
  { icon: "directions_bus", category: "Транспорт", title: "Зміна маршруту №4", text: "У зв'язку з ремонтом доріг маршрут тимчасово змінено. Перегляньте деталі.", time: "10:30", active: true },
  { icon: "water_drop", category: "Комунальні", title: "Відключення води", text: "Планові роботи на вул. Київська. Орієнтовний час відновлення: 18:00.", time: "09:15" },
  { icon: "assignment_turned_in", category: "Звернення", title: "Статус змінено", text: "Ваше звернення №1245 'Яма на проспекті Перемоги' отримало статус 'Вирішено'.", time: "16:45" },
  { icon: "update", category: "Система", title: "Оновлення додатка", text: "Додано нову можливість - зміна адреси в профілі. Спробуйте зараз!", time: "12:00" },
];

const news = [
  { icon: "directions_bus", source: "Житомирська Міська Рада", date: "10 травня, 12:00", title: "Зміна маршруту №4", text: "У зв'язку з проведенням ремонтних робіт на центральних вулицях, маршрут тролейбуса..." },
  { icon: "plumbing", source: "Житомирводоканал", date: "10 травня, 10:30", title: "Ремонтні роботи на вул. Перемоги", text: "Проводяться невідкладні ремонтні роботи на магістральному водогоні. Можливе..." },
  { icon: "festival", source: "ЖитомирІнфо", date: "9 травня, 15:45", title: "Фестиваль квітів у парку", text: "Запрошуємо всіх жителів та гостей міста на щорічний фестиваль квітів у..." },
  { icon: "park", source: "Управління благоустрою", date: "8 травня, 09:20", title: "Оновлення скверу на Польовій", text: "Встановлено нові лавки, освітлення та безпечні доріжки для прогулянок..." },
  { icon: "school", source: "Освітній департамент", date: "7 травня, 18:10", title: "Реєстрація до літніх гуртків", text: "Для школярів міста відкрито набір на безкоштовні творчі та спортивні секції..." },
];

function Icon({ name, filled = false, className = "" }) {
  return <span className={`material-symbols-outlined ${filled ? "icon-filled" : ""} ${className}`}>{name}</span>;
}

function Shell({ children, className = "bg-background" }) {
  return <div className={`phone-shell relative flex flex-col ${className}`}>{children}</div>;
}

function BottomNav({ active = "assistant", dark = false }) {
  const items = [
    ["assistant", "/assistant", "smart_toy", "Main"],
    ["map", "#", "location_on", "Map"],
    ["news", "/news", "newspaper", "News"],
    ["profile", "#", "person", "Profile"],
  ];

  return (
    <nav className={`fixed bottom-0 left-1/2 z-50 flex h-[72px] w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t px-4 ${dark ? "border-white/10 bg-primary-container text-on-primary shadow-lg" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-sm"}`}>
      {items.map(([key, href, icon, label]) => {
        const isActive = key === active;
        const content = (
          <>
            {isActive && !dark ? <span className="absolute inset-x-2 top-2 h-10 rounded-2xl bg-primary-fixed/55" /> : null}
            <Icon name={icon} filled={isActive} className={`relative mb-1 text-[24px] ${isActive ? dark ? "text-secondary-container" : "text-primary" : dark ? "text-white/60" : ""}`} />
            <span className={`relative text-[10px] font-semibold ${isActive ? dark ? "text-on-primary" : "text-primary" : ""}`}>{label}</span>
          </>
        );
        return href === "#" ? (
          <button key={key} className="relative flex w-16 flex-col items-center rounded-xl p-2 transition active:scale-95">{content}</button>
        ) : (
          <Link key={key} to={href} className="relative flex w-16 flex-col items-center rounded-xl p-2 transition active:scale-95">{content}</Link>
        );
      })}
    </nav>
  );
}

function AssistantPage() {
  return (
    <Shell className="bg-background pb-24">
      <header className="relative z-10 h-[265px] rounded-b-3xl bg-primary-container px-4 pb-6 pt-12 text-on-primary shadow-header">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img className="h-12 w-12 rounded-full border-2 border-white/20 object-cover shadow-inner" alt="" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2E9jilZExfADABzvi5iNsDqUbEsEWRXK67mBTwLXkHMTHuJ4fJ12arV_62Fokw8GoeOKC7ZCcKaTjDNayaVcfrtWZoE3x0bbzXQDv_srhA6-Q78yiKq87rENP2xFvusa1F1-B9TVAVfpqOUk2ZK27qZ8dlWRbccwd6M6sDfjrtk0EdFcohEdRTFiJ7DQZLaoj7q3OQETeNhiggwAiqR73mB3sNe1gw-MTOzKVpiQHpktYi4cJSgPgHPAid3OKOC4zCD58aKL_vhI" />
            <div>
              <h1 className="text-base font-bold leading-tight">Вітаємо,</h1>
              <p className="text-xl font-bold leading-tight">Олександр</p>
            </div>
          </div>
          <Link to="/notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 backdrop-blur-sm active:scale-95">
            <Icon name="notifications" />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-primary-container bg-error" />
          </Link>
        </div>
        <button className="flex max-w-[250px] items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-md active:scale-95">
          <span className="truncate">Житомир, вул. Театральна...</span>
          <Icon name="edit" className="text-sm" />
        </button>
      </header>

      <main className="relative z-20 -mt-8 space-y-section-margin">
        <section className="overflow-hidden">
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-container-padding pb-2">
            {statusCards.map((card) => (
              <article key={card.title} className="h-[120px] w-[75%] shrink-0 snap-center rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm">
                <span className="mb-2 block text-xs font-medium text-on-surface-variant">{card.label}</span>
                <div className="flex h-[70px] items-center gap-3">
                  <Icon name={card.icon} filled className={`text-[40px] ${card.tone}`} />
                  <div>
                    <h2 className="text-3xl font-bold leading-none text-on-surface">{card.title}</h2>
                    <p className={`mt-1 text-xs font-medium ${card.tone}`}>{card.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-2 flex justify-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-container" />
            <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
            <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
          </div>
        </section>

        <section className="mx-4 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
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
              <button key={label} className="rounded-full border border-outline-variant/50 px-4 py-2 text-sm text-on-surface transition active:scale-95">{label}</button>
            ))}
          </div>
          <div className="mb-4 flex h-14 items-center rounded-2xl border border-outline-variant/50 bg-surface shadow-sm focus-within:border-primary-container">
            <input className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-sm outline-none placeholder:text-outline" placeholder="Запитай асистента..." />
            <button className="mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-fixed/60 text-on-primary-fixed active:scale-95">
              <Icon name="mic" filled className="text-xl" />
            </button>
          </div>
          <button className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container shadow-md active:scale-[0.98]">
            Запитати AI <Icon name="arrow_forward" className="text-xl" />
          </button>
        </section>
      </main>
      <BottomNav active="assistant" dark />
    </Shell>
  );
}

function ChatHistoryPage() {
  return (
    <Shell className="bg-surface-container-low pb-24">
      <header className="flex h-16 items-center gap-4 bg-primary-container px-container-padding text-on-primary">
        <Link to="/assistant" className="active:scale-95"><Icon name="arrow_back" /></Link>
        <h1 className="text-lg font-semibold">Історія чатів</h1>
      </header>
      <main className="flex-1 space-y-3 overflow-y-auto px-container-padding py-3">
        <label className="mb-4 flex h-12 items-center rounded-lg border border-outline-variant bg-surface-container px-3">
          <Icon name="search" className="text-outline" />
          <input className="ml-2 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-outline" placeholder="Пошук повідомлень..." />
        </label>
        {chats.map(([title, date, active]) => (
          <button key={title} className="flex w-full items-start gap-3 rounded-2xl bg-surface p-4 text-left shadow-sm transition active:scale-[0.98]">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? "bg-primary-container text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
              <Icon name="smart_toy" className="text-xl" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-medium ${active ? "text-on-surface" : "text-on-surface/70"}`}>{title}</span>
              <span className="mt-1 block text-sm text-on-surface-variant">{date}</span>
            </span>
            <Icon name="chevron_right" className="mt-2 text-outline" />
          </button>
        ))}
      </main>
      <BottomNav active="assistant" />
    </Shell>
  );
}

function NotificationsPage() {
  return (
    <Shell className="bg-background pb-24">
      <header className="flex h-20 items-center gap-5 px-container-padding">
        <Link to="/assistant"><Icon name="arrow_back" className="text-4xl text-primary" /></Link>
        <h1 className="text-4xl font-bold tracking-tight text-primary">Повідомлення</h1>
      </header>
      <main className="space-y-section-margin px-container-padding pt-8">
        <h2 className="text-3xl font-bold">Сьогодні</h2>
        {notifications.slice(0, 2).map((item) => <NotificationCard key={item.title} item={item} />)}
        <h2 className="pt-4 text-3xl font-bold">Вчора</h2>
        {notifications.slice(2).map((item) => <NotificationCard key={item.title} item={item} />)}
      </main>
      <BottomNav active="map" />
    </Shell>
  );
}

function NotificationCard({ item }) {
  return (
    <article className={`relative rounded-3xl bg-white p-7 shadow-sm ring-1 ring-outline-variant/30 ${item.active ? "border-l-4 border-secondary-container" : ""}`}>
      <div className="flex gap-6">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${item.active ? "bg-primary-fixed text-primary-container" : "bg-surface-container text-on-surface-variant"}`}>
          <Icon name={item.icon} className="text-4xl" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="text-sm font-bold uppercase tracking-widest text-primary-container">{item.category}</p>
            <time className="shrink-0 text-xl text-on-surface-variant">{item.time}</time>
          </div>
          <h3 className="text-3xl font-bold leading-tight">{item.title}</h3>
          <p className="mt-3 text-xl leading-8 text-on-surface-variant">{item.text}</p>
        </div>
      </div>
    </article>
  );
}

function NewsPage() {
  return (
    <Shell className="bg-background pb-24">
      <header className="rounded-b-[32px] bg-primary-container px-container-padding pb-8 pt-6 text-on-primary shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/15" />
            <h1 className="text-xl font-bold">Житомир</h1>
          </div>
          <Link to="/notifications"><Icon name="notifications" /></Link>
        </div>
        <h2 className="mb-6 text-center text-3xl font-extrabold uppercase leading-tight">Новини та події Житомира</h2>
        <label className="flex h-12 items-center rounded-xl bg-surface px-4 text-on-surface shadow-sm">
          <Icon name="search" className="text-on-primary-container" />
          <input className="ml-3 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-on-surface-variant" placeholder="Пошук новин..." />
        </label>
        <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto">
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon name="tune" /></button>
          {["Усі", "Комуналка", "Транспорт", "Офіційно", "Події"].map((chip, index) => (
            <button key={chip} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${index === 0 ? "border-secondary-container bg-secondary-container text-on-secondary-container" : "border-white/20 bg-white/10 text-on-primary"}`}>{chip}</button>
          ))}
        </div>
      </header>
      <main className="space-y-3 px-container-padding py-section-margin">
        {news.map((item) => (
          <Link key={item.title} to={item.title.includes("Фестиваль") ? "/news/flower-festival" : "/news"} className="flex gap-4 rounded-xl border border-surface-variant bg-surface p-4 shadow-soft transition active:scale-[0.98]">
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

function NewsDetailPage() {
  return (
    <Shell className="bg-surface-bright pb-24 pt-16">
      <header className="fixed left-1/2 top-0 z-50 flex h-16 w-full max-w-[430px] -translate-x-1/2 items-center justify-between bg-primary px-container-padding text-on-primary">
        <Link to="/news" className="flex h-10 w-10 items-center justify-center rounded-full active:scale-95"><Icon name="arrow_back" /></Link>
        <h1 className="text-lg font-semibold">Новини</h1>
        <button className="flex h-10 w-10 items-center justify-center rounded-full active:scale-95"><Icon name="share" /></button>
      </header>
      <main className="px-container-padding pb-section-margin">
        <div className="relative mt-4 overflow-hidden rounded-2xl bg-surface-container-low shadow-soft">
          <img className="h-56 w-full object-cover" alt="" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBgOIV7klrkYl8iwf0E_3tTFOU07M2W8UV-t-aDqT-lk08ak4njeYvwwoFtbxzGF4K2pr0vLs0t__0FDu38Eqevt2UjELaNKz18jxr9E0h5eG0yzka6PTkyz-ufyG7d8HeH5agev96aTJlNsNyLxjOv9yd-MEw4mphTDIj-22I0nKQApPWUTSYyWH4TJ4MKSenIMkjLAcIOUeBvH2JSLHfUINMj1qBeCUNLQ-koeILjV7Ob6ALjXFyB" />
          <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full border border-outline-variant/30 bg-white/90 px-3 py-1 shadow-sm backdrop-blur-sm">
            <Icon name="event" filled className="text-base text-tertiary-container" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-tertiary-container">Події</span>
          </div>
        </div>
        <article className="relative z-10 -mt-10 rounded-2xl border border-outline-variant/20 bg-white p-5 shadow-soft">
          <h2 className="mb-3 text-2xl font-bold leading-tight">Фестиваль квітів у парку: програма заходів</h2>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1"><Icon name="calendar_today" className="text-base" />10 травня, 14:00</span>
            <span className="h-1 w-1 rounded-full bg-outline-variant" />
            <span className="flex items-center gap-1 text-on-tertiary-fixed-variant"><Icon name="account_balance" filled className="text-base" />Житомирська міська рада</span>
          </div>
          <div className="space-y-4 border-t border-outline-variant/30 pt-5 text-base leading-7 text-on-background">
            <p>Запрошуємо мешканців та гостей міста відвідати щорічний Фестиваль квітів, який відбудеться в міському парку імені Юрія Гагаріна. Цього року організатори підготували унікальну програму, що поєднує мистецтво флористики, живу музику та майстер-класи для всієї родини.</p>
            <p>Центральною подією стане презентація масштабних квіткових композицій, створених кращими ландшафтними дизайнерами регіону. Кожна інсталяція символізує окремий район нашого міста, відображаючи його історію та дух через мову квітів.</p>
            <div className="rounded-r-lg border-l-4 border-secondary bg-secondary-fixed/30 p-4 text-sm text-on-secondary-container"><strong>Увага:</strong> Вхід на територію фестивалю безкоштовний. Для участі в окремих майстер-класах необхідна попередня реєстрація через додаток міста.</div>
            <h3 className="text-lg font-bold text-on-surface">Основні локації та розклад:</h3>
            {[
              ["eco", "14:00 - 15:30:", "Урочисте відкриття та презентація головної алеї квіткових інсталяцій."],
              ["palette", "16:00 - 18:00:", "Майстер-класи з флористики для дітей та дорослих біля літнього театру."],
              ["music_note", "19:00 - 21:00:", "Виступ міського симфонічного оркестру на центральній площі парку."],
            ].map(([icon, time, text]) => (
              <p key={time} className="flex items-start gap-2 text-sm leading-6 text-on-surface-variant"><Icon name={icon} className="mt-0.5 text-xl text-primary" /><span><strong>{time}</strong> {text}</span></p>
            ))}
            <p>Не пропустіть нагоду насолодитися весняною красою та провести час у родинному колі. Захід організовано за підтримки управління культури міської ради з метою популяризації екологічної свідомості та розвитку паркових зон.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-2 border-t border-outline-variant/30 pt-4">
            {["#ПаркГагаріна", "#Фестиваль", "#Відпочинок"].map((tag) => <span key={tag} className="rounded-full border border-outline-variant/20 bg-surface-container px-3 py-1 text-xs text-on-surface-variant">{tag}</span>)}
          </div>
        </article>
      </main>
      <BottomNav active="news" />
    </Shell>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <Routes location={location}>
      <Route path="/" element={<Navigate to="/assistant" replace />} />
      <Route path="/assistant" element={<AssistantPage />} />
      <Route path="/chat-history" element={<ChatHistoryPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/news/flower-festival" element={<NewsDetailPage />} />
      <Route path="*" element={<Navigate to="/assistant" replace />} />
    </Routes>
  );
}
