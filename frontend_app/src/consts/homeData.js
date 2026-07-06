// Weather used to be a hardcoded placeholder card here too - it's now a real widget
// (components/widgets/SinoptikWeatherWidget.jsx) rendered separately in Assistant/index.jsx.
// Air-raid alert and service status stay as placeholders, deliberately not built out yet.
export const statusCards = [
  { label: "Повітряна тривога", icon: "security", title: "Тривоги немає", text: "Безпечно", tone: "text-green-600" },
  { label: "Статус послуг", icon: "bolt", title: "Електрика", text: "Графік відключень", tone: "text-secondary" },
];

export const chatSuggestions = [
  "Де ЦНАП?",
  "Перевірити графік відключень",
  "Створити звернення про яму",
];

export const notifications = [
  { icon: "directions_bus", category: "Транспорт", title: "Зміна маршруту №4", text: "У зв'язку з ремонтом доріг маршрут тимчасово змінено. Перегляньте деталі.", time: "10:30", active: true },
  { icon: "water_drop", category: "Комунальні", title: "Відключення води", text: "Планові роботи на вул. Київська. Орієнтовний час відновлення: 18:00.", time: "09:15" },
  { icon: "assignment_turned_in", category: "Звернення", title: "Статус змінено", text: "Ваше звернення №1245 'Яма на проспекті Перемоги' отримало статус 'Вирішено'.", time: "16:45" },
  { icon: "update", category: "Система", title: "Оновлення додатка", text: "Додано нову можливість - зміна адреси в профілі. Спробуйте зараз!", time: "12:00" },
];

export const news = [
  { id: "route-4-change", category: "transport", icon: "directions_bus", source: "Житомирська Міська Рада", date: "10 травня, 12:00", title: "Зміна маршруту №4", text: "У зв'язку з проведенням ремонтних робіт на центральних вулицях, маршрут тролейбуса тимчасово змінено." },
  { id: "water-repair-peremohy", category: "utilities", icon: "plumbing", source: "Житомирводоканал", date: "10 травня, 10:30", title: "Ремонтні роботи на вул. Перемоги", text: "Проводяться невідкладні ремонтні роботи на магістральному водогоні. Можливе тимчасове відключення води." },
  { id: "flower-festival", category: "events", icon: "festival", source: "ЖитомирІнфо", date: "9 травня, 15:45", title: "Фестиваль квітів у парку", text: "Запрошуємо всіх жителів та гостей міста на щорічний фестиваль квітів у центральному парку." },
  { id: "poliova-square", category: "official", icon: "park", source: "Управління благоустрою", date: "8 травня, 09:20", title: "Оновлення скверу на Польовій", text: "Встановлено нові лавки, освітлення та безпечні доріжки для прогулянок." },
  { id: "summer-clubs", category: "events", icon: "school", source: "Освітній департамент", date: "7 травня, 18:10", title: "Реєстрація до літніх гуртків", text: "Для школярів міста відкрито набір на безкоштовні творчі та спортивні секції." },
];
