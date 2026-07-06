// Mirrors ml-service's vision-analyze category taxonomy (and backend_app's Appeal.category enum) -
// the AI classifies photos into exactly these 9 slugs, so the form and history list must speak
// the same vocabulary rather than the old 4-bucket UI taxonomy.
export const appealCategories = [
  { slug: "pothole", labelKey: "appeals.categories.pothole", icon: "warning" },
  { slug: "road_damage", labelKey: "appeals.categories.roadDamage", icon: "construction" },
  { slug: "garbage", labelKey: "appeals.categories.garbage", icon: "delete" },
  { slug: "illegal_dumping", labelKey: "appeals.categories.illegalDumping", icon: "delete_sweep" },
  { slug: "street_lighting", labelKey: "appeals.categories.streetLighting", icon: "lightbulb" },
  { slug: "water_leak", labelKey: "appeals.categories.waterLeak", icon: "water_drop" },
  { slug: "fallen_tree", labelKey: "appeals.categories.fallenTree", icon: "park" },
  { slug: "vandalism", labelKey: "appeals.categories.vandalism", icon: "block" },
  { slug: "other", labelKey: "appeals.categories.other", icon: "report" },
];

export const appealStatusTone = {
  new: "bg-primary-fixed text-on-primary-fixed",
  in_progress: "bg-secondary-container text-on-secondary-container",
  resolved: "bg-green-100 text-green-700",
  rejected: "bg-error-container text-error",
};
