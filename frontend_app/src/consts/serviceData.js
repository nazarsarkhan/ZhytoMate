export const serviceCards = [
  { id: "contacts", titleKey: "services.cards.contacts.title", subtitleKey: "services.cards.contacts.subtitle", icon: "contacts", tone: "bg-primary-fixed text-primary-container", href: "/services/contacts" },
  { id: "polls", titleKey: "services.cards.polls.title", subtitleKey: "services.cards.polls.subtitle", icon: "poll", tone: "bg-green-100 text-green-700", href: "/services/polls" },
  { id: "appeals", titleKey: "services.cards.appeals.title", subtitleKey: "services.cards.appeals.subtitle", icon: "report", tone: "bg-orange-100 text-orange-700", href: "/services/appeals" },
  { id: "transport", titleKey: "services.cards.transport.title", subtitleKey: "services.cards.transport.subtitle", icon: "directions_bus", tone: "bg-primary-fixed text-primary-container", href: "/services/transport" },
  { id: "outages", titleKey: "services.cards.outages.title", subtitleKey: "services.cards.outages.subtitle", icon: "bolt", tone: "bg-yellow-100 text-yellow-700", href: "/services/outages" },
  { id: "utilities", titleKey: "services.cards.utilities.title", subtitleKey: "services.cards.utilities.subtitle", icon: "payments", tone: "bg-surface-container-high text-on-surface-variant", href: null, comingSoon: true },
  { id: "healthcare", titleKey: "services.cards.healthcare.title", subtitleKey: "services.cards.healthcare.subtitle", icon: "health_and_safety", tone: "bg-blue-100 text-blue-700", href: null, comingSoon: true },
];

export const emergencyServices = [
  { name: "Пожежна", phone: "101", icon: "local_fire_department" },
  { name: "Поліція", phone: "102", icon: "local_police" },
  { name: "Швидка", phone: "103", icon: "medical_services" },
  { name: "Служба газу", phone: "104", icon: "gas_meter" },
];

export const utilityContacts = [
  { group: "Комунальні служби", items: [
    { name: "Водоканал", phone: "0412 24-08-10", icon: "water_drop" },
    { name: "Обленерго", phone: "0 800 30-92-82", icon: "bolt" },
    { name: "Теплокомуненерго", phone: "0412 48-14-14", icon: "hvac" },
    { name: "Ліфтсервіс", phone: "0412 42-20-80", icon: "elevator" },
  ] },
  { group: "Соціальні та адмін послуги", items: [
    { name: "ЦНАП", phone: "0412 47-06-15", icon: "account_balance" },
    { name: "Соцзахист", phone: "0412 47-09-17", icon: "family_restroom" },
  ] },
];

export const polls = [
  {
    id: "park-renovation",
    category: "Міський благоустрій",
    tab: "active",
    icon: "park",
    title: "Оновлення скверу на Польовій",
    text: "Оберіть проєкт реконструкції скверу. Пропонується встановлення нових лавок, освітлення та дитячого майданчика.",
    description: "Проєкт передбачає комплексний підхід до оновлення улюбленого місця відпочинку мешканців району. Планується встановлення сучасних енергозберігаючих ліхтарів, зручних паркових лав, а також створення безпечного та цікавого дитячого ігрового простору.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3JVWM1HELJfdBhwFntwCbzZT_EqbMTrn4-eISQiKZlckjdfk3sJhq6iQD5FkQUF472Bxd1yspY3IXb1MnFdQFjGDz0IX2W6T-ljZg_chnNTjpAOAPsH6ZrsE3pZ1aqilWcKjaNvHJZolbhj0dB6AMwGMWTkM-DScdXR6ggWRcmBQxa5K0XMaaDMGooc_LjY-NZtS-i47uaWQtBJ0PV1iy63N3EK1z5FHcWXKOR-EY_JkjrbCoMiOR",
    timeLeft: "Залишилось 3 дні",
    active: true,
    voted: false,
    totalVotes: 1842,
    eligibleScopeLabel: "Мешканці Богунського району",
    lastUpdated: "Сьогодні, 12:40",
    options: [
      { id: "full", title: "Повне оновлення", text: "Лавки, освітлення, озеленення та великий дитячий майданчик.", budget: "2.5 млн грн", votes: 911, percent: 49 },
      { id: "base", title: "Освітлення та лавки", text: "Базовий благоустрій для безпечного та комфортного перебування.", budget: "800 тис грн", votes: 563, percent: 31 },
      { id: "playground", title: "Дитячий майданчик", text: "Фокус на просторі для сімей з дітьми без повної реконструкції.", budget: "1.2 млн грн", votes: 368, percent: 20 },
    ],
  },
  {
    id: "trolleybus-15",
    category: "Транспорт",
    tab: "active",
    icon: "directions_bus",
    title: "Новий маршрут тролейбуса №15",
    text: "Чи підтримуєте ви продовження маршруту тролейбуса №15 до мікрорайону Крошня?",
    description: "Маршрут має покращити сполучення північних мікрорайонів із центром та залізничним вокзалом у години пікового навантаження.",
    image: "",
    timeLeft: "Залишився 1 день",
    active: true,
    voted: false,
    totalVotes: 1264,
    eligibleScopeLabel: "Користувачі міського транспорту",
    lastUpdated: "Сьогодні, 11:10",
    options: [
      { id: "support", title: "Підтримую продовження", text: "Маршрут потрібен для щоденних поїздок.", budget: "Без зміни тарифу", votes: 947, percent: 75 },
      { id: "test", title: "Запустити тестово", text: "Спочатку протестувати у будні протягом місяця.", budget: "Пілотний графік", votes: 221, percent: 17 },
      { id: "against", title: "Не підтримую", text: "Потрібно оптимізувати наявні маршрути.", budget: "Без витрат", votes: 96, percent: 8 },
    ],
  },
  {
    id: "school-menu",
    category: "Освіта",
    tab: "completed",
    icon: "school",
    title: "Меню в шкільних їдальнях",
    text: "Голосування за нове збалансоване меню для учнів молодших класів на наступний навчальний рік.",
    description: "Місто збирало пропозиції батьків щодо оновлення шкільного меню з акцентом на сезонні продукти та меншу кількість цукру.",
    image: "",
    timeLeft: "Завершено",
    active: false,
    voted: true,
    totalVotes: 2376,
    eligibleScopeLabel: "Батьки учнів 1-4 класів",
    lastUpdated: "12 травня, 18:00",
    options: [
      { id: "balanced", title: "Збалансоване сезонне меню", text: "Більше овочів, круп та молочних продуктів.", budget: "У межах чинного бюджету", votes: 1379, percent: 58 },
      { id: "classic", title: "Оновити класичне меню", text: "Залишити базові страви та прибрати найменш популярні.", budget: "У межах чинного бюджету", votes: 665, percent: 28 },
      { id: "pilot", title: "Пілот у кількох школах", text: "Спершу протестувати меню у вибраних школах.", budget: "Пілотна закупівля", votes: 332, percent: 14 },
    ],
  },
];

export const pollOptions = polls[0].options;

export const appeals = [
  { title: "Яма на проспекті Перемоги", text: "Глибока вибоїна на правій смузі руху, що створює аварійну ситуацію та пошкоджує автомобілі.", date: "12 Травня, 14:30", address: "просп. Перемоги, 55", status: "В роботі", tone: "bg-primary-fixed text-on-primary-fixed" },
  { title: "Не працює ліхтар", text: "Відсутнє вуличне освітлення біля дитячого майданчика у дворі будинку.", date: "05 Травня, 09:15", address: "вул. Київська, 102", status: "Вирішено", tone: "bg-green-100 text-green-700" },
  { title: "Зламане дерево після буревію", text: "Велика гілка впала на пішохідну доріжку і перекриває прохід до парку.", date: "14 Травня, 18:45", address: "Шодуарівський парк", status: "На розгляді", tone: "bg-secondary-container text-on-secondary-container" },
  { title: "Шум від сусідів", text: "Гучна музика в нічний час. Звертайтесь безпосередньо до патрульної поліції.", date: "01 Травня, 10:00", address: "вул. Велика Бердичівська, 15", status: "Відхилено", tone: "bg-error-container text-error" },
];

export const routes = [
  { id: "bus-115", number: "115", title: "Крошня - Центр - Корбутівка", type: "bus", direction: "Корбутівка", icon: "directions_bus", badge: "bg-blue-100 text-blue-800", times: ["3 хв", "14 хв", "25 хв"], status: "" },
  { id: "tram-1", number: "1", title: "Майдан - Льонокомбінат", type: "tram", direction: "Льонокомбінат", icon: "tram", badge: "bg-red-100 text-red-800", times: ["1 хв", "8 хв"], status: "onTime", saved: true },
  { id: "trolleybus-15a", number: "15A", title: "Гідропарк - Залізничний вокзал", type: "trolleybus", direction: "Залізничний вокзал", icon: "electric_car", badge: "bg-yellow-100 text-yellow-800", times: ["5 хв", "12 хв"], status: "delayed" },
];
