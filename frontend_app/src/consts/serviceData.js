export const serviceCards = [
  { title: "Contacts", subtitle: "City departments", icon: "contacts", tone: "bg-primary-fixed text-primary-container", href: "/services/contacts" },
  { title: "Polls & Voting", subtitle: "City decisions", icon: "poll", tone: "bg-green-100 text-green-700", href: "/services/polls" },
  { title: "Appeals", subtitle: "Track issues", icon: "report", tone: "bg-orange-100 text-orange-700", href: "/services/appeals" },
  { title: "Transport", subtitle: "Routes & schedules", icon: "directions_bus", tone: "bg-primary-fixed text-primary-container", href: "/services/transport" },
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
  { id: "park-renovation", category: "Міський благоустрій", icon: "park", title: "Оновлення скверу на Польовій", text: "Оберіть проєкт реконструкції скверу. Пропонується встановлення нових лавок, освітлення та дитячого майданчика.", timeLeft: "Залишилось 3 дні", active: true },
  { id: "trolleybus-15", category: "Транспорт", icon: "directions_bus", title: "Новий маршрут тролейбуса №15", text: "Чи підтримуєте ви продовження маршруту тролейбуса №15 до мікрорайону Крошня?", timeLeft: "Залишився 1 день", active: true },
  { id: "school-menu", category: "Освіта", icon: "school", title: "Меню в шкільних їдальнях", text: "Голосування за нове збалансоване меню для учнів молодших класів на наступний навчальний рік.", timeLeft: "Завершено", active: false },
];

export const pollOptions = [
  { title: "Варіант 1: Повне оновлення", text: "Включає лавки, освітлення, озеленення та великий дитячий майданчик. Бюджет: 2.5 млн грн." },
  { title: "Варіант 2: Тільки освітлення та лавки", text: "Базовий благоустрій для безпечного та комфортного перебування. Бюджет: 800 тис грн." },
  { title: "Варіант 3: Додати лише дитячий майданчик", text: "Фокус на створення простору для сімей з дітьми без зміни існуючої інфраструктури. Бюджет: 1.2 млн грн." },
];

export const appeals = [
  { title: "Яма на проспекті Перемоги", text: "Глибока вибоїна на правій смузі руху, що створює аварійну ситуацію та пошкоджує автомобілі.", date: "12 Травня, 14:30", address: "просп. Перемоги, 55", status: "В роботі", tone: "bg-primary-fixed text-on-primary-fixed" },
  { title: "Не працює ліхтар", text: "Відсутнє вуличне освітлення біля дитячого майданчика у дворі будинку.", date: "05 Травня, 09:15", address: "вул. Київська, 102", status: "Вирішено", tone: "bg-green-100 text-green-700" },
  { title: "Зламане дерево після буревію", text: "Велика гілка впала на пішохідну доріжку і перекриває прохід до парку.", date: "14 Травня, 18:45", address: "Шодуарівський парк", status: "На розгляді", tone: "bg-secondary-container text-on-secondary-container" },
  { title: "Шум від сусідів", text: "Гучна музика в нічний час. Звертайтесь безпосередньо до патрульної поліції.", date: "01 Травня, 10:00", address: "вул. Велика Бердичівська, 15", status: "Відхилено", tone: "bg-error-container text-error" },
];

export const routes = [
  { number: "115", title: "Kroshnya - Center - Korbutivka", type: "Bus", direction: "Towards: Korbutivka", icon: "directions_bus", badge: "bg-blue-100 text-blue-800", times: ["3 min", "14 min", "25 min"], status: "" },
  { number: "1", title: "Square - Lnozombinat", type: "Tram", direction: "Towards: Lnozombinat", icon: "tram", badge: "bg-red-100 text-red-800", times: ["1 min", "8 min"], status: "On Time", saved: true },
  { number: "15A", title: "Hydropark - Railway Station", type: "Trolleybus", direction: "Towards: Railway Station", icon: "electric_car", badge: "bg-yellow-100 text-yellow-800", times: ["5 min", "12 min"], status: "Delayed" },
];
