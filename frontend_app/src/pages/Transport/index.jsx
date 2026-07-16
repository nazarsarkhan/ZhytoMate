import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";

const DOZOR_MAP_URL = "https://city.dozor.tech/ua/zhytomyr/city";

export default function TransportPage() {
  return (
    <Shell className="bg-surface">
      <div className="flex h-dvh flex-col pb-[calc(72px+var(--safe-bottom))] lg:pb-0">
        <AppHeader title="Транспорт" backTo="/services" rightIcon="notifications" rightTo="/notifications" />
        <div className="relative min-h-0 flex-1">
          <iframe
            title="Жива мапа транспорту"
            src={DOZOR_MAP_URL}
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin"
            className="absolute inset-0 h-full w-full"
            style={{ border: 0 }}
          />
        </div>
      </div>
      <BottomNav active="services" dark />
    </Shell>
  );
}
