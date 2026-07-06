export function formatTimeLeft(survey, t) {
  if (!survey.isOpen) return t("polls.completed");
  if (!survey.endsAt) return t("polls.ongoing");

  const daysLeft = Math.ceil((new Date(survey.endsAt) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) return t("polls.completed");
  return t("polls.daysLeft", { count: daysLeft });
}
