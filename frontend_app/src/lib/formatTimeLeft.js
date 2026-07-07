export function formatTimeLeft(survey) {
  if (!survey.isOpen) return "Завершені";
  if (!survey.endsAt) return "Триває";

  const daysLeft = Math.ceil((new Date(survey.endsAt) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) return "Завершені";
  return `Залишилось ${daysLeft} днів`;
}
