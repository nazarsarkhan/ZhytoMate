import Icon from "../ui/Icon.jsx";
import { Link } from "react-router-dom";

export default function NotificationCard({ item }) {
  const Component = item.route ? Link : "article";
  const componentProps = item.route
    ? { to: item.route, onClick: item.onClick }
    : {};

  return (
    <Component {...componentProps} className={`motion-card interactive-card relative block rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-outline-variant/30 sm:p-5 md:p-6 ${item.active ? "border-l-4 border-secondary-container" : ""}`}>
      <div className="flex gap-3 sm:gap-4 md:gap-6">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-14 sm:w-14 md:h-16 md:w-16 ${item.active ? "bg-primary-fixed text-primary-container" : "bg-surface-container text-on-surface-variant"}`}>
          <Icon name={item.icon} className="text-2xl sm:text-3xl md:text-4xl" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-start justify-between gap-3">
            <p className="min-w-0 text-xs font-bold uppercase tracking-widest text-primary-container md:text-sm">{item.category}</p>
            <time className="shrink-0 text-sm text-on-surface-variant sm:text-base md:text-lg">{item.time}</time>
          </div>
          <h3 className="text-lg font-bold leading-tight sm:text-xl md:text-2xl">{item.title}</h3>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant sm:text-base md:text-lg md:leading-7">{item.text}</p>
        </div>
      </div>
    </Component>
  );
}
