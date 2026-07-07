import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";

// EasyWay blocks iframe embedding (X-Frame-Options: DENY). DozoR City's web app
// sends no frame-blocking headers and covers Zhytomyr, so we embed its live
// vehicle-tracking map directly (Zhytomyr is the default city on this path).
const DOZOR_MAP_URL = "https://city.dozor.tech/ua/zhytomyr/city";

export default function TransportPage() {
  const { t } = useTranslation();

  return (
    <Shell className="bg-surface">
      {/* Fixed-height column so the map fills the viewport instead of scrolling.
          The bottom padding reserves space for the fixed BottomNav (~72px);
          on lg the BottomNav is hidden (SideNav takes over), so drop it. */}
      <div className="flex h-dvh flex-col pb-[calc(72px+var(--safe-bottom))] lg:pb-0">
        <AppHeader title={t("transport.title")} backTo="/services" rightIcon="notifications" rightTo="/notifications" />
        <div className="relative min-h-0 flex-1">
          <iframe
            title={t("transport.mapTitle")}
            src={DOZOR_MAP_URL}
            loading="lazy"
            className="absolute inset-0 h-full w-full"
            style={{ border: 0 }}
          />
        </div>
      </div>
      <BottomNav active="services" dark />
    </Shell>
  );
}
