import { Link } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import { isValidAppRoute } from "../../lib/appRoutes.js";

export default function AppCapabilityLinks({ links = [] }) {
  const safeLinks = Array.isArray(links)
    ? links.filter((link) => link && isValidAppRoute(link.route)).slice(0, 3)
    : [];
  if (!safeLinks.length) return null;

  return (
    <div className="mt-3 border-t border-outline-variant/30 pt-3">
      <p className="mb-2 text-xs font-semibold text-on-surface-variant">Відкрити в застосунку</p>
      <div className="flex flex-wrap gap-2">
        {safeLinks.map((link) => (
          <Link
            key={link.route}
            to={link.route}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-2 text-xs font-bold text-on-secondary-container hover:bg-secondary-fixed"
          >
            <Icon name="arrow_forward" className="text-sm" />
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
