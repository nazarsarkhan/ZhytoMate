// Weather used to be a hardcoded placeholder card here too - it's now a real widget
// (components/widgets/SinoptikWeatherWidget.jsx) rendered separately in Assistant/index.jsx.
// The electricity card is likewise real now - a live OutageStatusCard driven by the user's queue.
export const chatSuggestions = [
  "Де ЦНАП?",
  "Створити звернення",
  "Останні новини",
];

export const notifications = [
  {
    icon: "directions_bus",
    category: "Транспорт",
    title: "Зміна маршруту №4",
    text: "У зв'язку з ремонтом доріг маршрут тимчасово змінено. Перегляньте деталі.",
    time: "10:30",
    active: true,
  },
  {
    icon: "water_drop",
    category: "Комунальні",
    title: "Відключення води",
    text: "Планові роботи на вул. Київська. Орієнтовний час відновлення: 18:00.",
    time: "09:15",
  },
  {
    icon: "assignment_turned_in",
    category: "Звернення",
    title: "Статус змінено",
    text: "Ваше звернення №1245 'Яма на проспекті Перемоги' отримало статус 'Вирішено'.",
    time: "16:45",
  },
  {
    icon: "update",
    category: "Система",
    title: "Оновлення додатка",
    text: "Додано нову можливість - зміна адреси в профілі. Спробуйте зараз!",
    time: "12:00",
  },
];
