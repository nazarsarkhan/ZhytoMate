// Mirrors ml-service's vision-analyze category taxonomy and backend_app's Appeal.category enum.
export const appealCategories = [
  { slug: "pothole", label: "Яма", icon: "warning" },
  { slug: "road_damage", label: "Пошкодження дороги", icon: "construction" },
  { slug: "garbage", label: "Сміття", icon: "delete" },
  { slug: "illegal_dumping", label: "Стихійне сміттєзвалище", icon: "delete_sweep" },
  { slug: "street_lighting", label: "Освітлення", icon: "lightbulb" },
  { slug: "water_leak", label: "Витік води", icon: "water_drop" },
  { slug: "fallen_tree", label: "Впале дерево", icon: "park" },
  { slug: "vandalism", label: "Вандалізм", icon: "block" },
  { slug: "other", label: "Інше", icon: "report" },
];

export const appealStatusLabels = {
  new: "Нове",
  in_progress: "В роботі",
  resolved: "Вирішено",
  rejected: "Відхилено",
};

export const appealStatusTone = {
  new: "bg-primary-fixed text-on-primary-fixed",
  in_progress: "bg-secondary-container text-on-secondary-container",
  resolved: "bg-green-100 text-green-700",
  rejected: "bg-error-container text-error",
};

export function appealCategoryMeta(slug) {
  return appealCategories.find((category) => category.slug === slug) || appealCategories.at(-1);
}
