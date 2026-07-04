import { useState } from "react";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Toast from "../../components/ui/Toast.jsx";
import Icon from "../../components/ui/Icon.jsx";

export default function NewsDetailPage() {
  const { t } = useTranslation();
  const [toast, setToast] = useState("");

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Фестиваль квітів у парку", url: window.location.href });
      } else {
        await navigator.clipboard?.writeText(window.location.href);
      }
      showToast(t("common.shared"));
    } catch {
      showToast(t("common.shared"));
    }
  };

  return (
    <Shell className="bg-surface-bright pb-28">
      <AppHeader title={t("nav.news")} backTo="/news" rightIcon="share" rightLabel={t("common.share")} onRightClick={handleShare} />
      <main className="mx-auto w-full max-w-5xl px-container-padding pb-section-margin sm:px-6 md:px-8">
        <div className="motion-card relative mt-4 overflow-hidden rounded-2xl bg-surface-container-low shadow-soft md:mt-8 md:rounded-3xl">
          <img className="h-56 w-full object-cover md:h-[380px]" alt="" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBgOIV7klrkYl8iwf0E_3tTFOU07M2W8UV-t-aDqT-lk08ak4njeYvwwoFtbxzGF4K2pr0vLs0t__0FDu38Eqevt2UjELaNKz18jxr9E0h5eG0yzka6PTkyz-ufyG7d8HeH5agev96aTJlNsNyLxjOv9yd-MEw4mphTDIj-22I0nKQApPWUTSYyWH4TJ4MKSenIMkjLAcIOUeBvH2JSLHfUINMj1qBeCUNLQ-koeILjV7Ob6ALjXFyB" />
          <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full border border-outline-variant/30 bg-white/90 px-3 py-1 shadow-sm backdrop-blur-sm">
            <Icon name="event" filled className="text-base text-tertiary-container" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-tertiary-container">Події</span>
          </div>
        </div>
        <article className="motion-card relative z-10 -mt-10 rounded-2xl border border-outline-variant/20 bg-white p-5 shadow-soft md:mx-auto md:max-w-3xl md:p-8">
          <h2 className="mb-3 text-2xl font-bold leading-tight md:text-4xl">Фестиваль квітів у парку: програма заходів</h2>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1"><Icon name="calendar_today" className="text-base" />10 травня, 14:00</span>
            <span className="h-1 w-1 rounded-full bg-outline-variant" />
            <span className="flex items-center gap-1 text-on-tertiary-fixed-variant"><Icon name="account_balance" filled className="text-base" />Житомирська міська рада</span>
          </div>
          <div className="space-y-4 border-t border-outline-variant/30 pt-5 text-base leading-7 text-on-background md:text-lg md:leading-8">
            <p>Запрошуємо мешканців та гостей міста відвідати щорічний Фестиваль квітів, який відбудеться в міському парку імені Юрія Гагаріна. Цього року організатори підготували унікальну програму, що поєднує мистецтво флористики, живу музику та майстер-класи для всієї родини.</p>
            <p>Центральною подією стане презентація масштабних квіткових композицій, створених кращими ландшафтними дизайнерами регіону. Кожна інсталяція символізує окремий район нашого міста, відображаючи його історію та дух через мову квітів.</p>
            <div className="rounded-r-lg border-l-4 border-secondary bg-secondary-fixed/30 p-4 text-sm text-on-secondary-container md:text-base"><strong>Увага:</strong> Вхід на територію фестивалю безкоштовний. Для участі в окремих майстер-класах необхідна попередня реєстрація через додаток міста.</div>
            <h3 className="text-lg font-bold text-on-surface md:text-2xl">Основні локації та розклад:</h3>
            {[
              ["eco", "14:00 - 15:30:", "Урочисте відкриття та презентація головної алеї квіткових інсталяцій."],
              ["palette", "16:00 - 18:00:", "Майстер-класи з флористики для дітей та дорослих біля літнього театру."],
              ["music_note", "19:00 - 21:00:", "Виступ міського симфонічного оркестру на центральній площі парку."],
            ].map(([icon, time, text]) => (
              <p key={time} className="flex items-start gap-2 text-sm leading-6 text-on-surface-variant"><Icon name={icon} className="mt-0.5 text-xl text-primary" /><span><strong>{time}</strong> {text}</span></p>
            ))}
            <p>Не пропустіть нагоду насолодитися весняною красою та провести час у родинному колі. Захід організовано за підтримки управління культури міської ради з метою популяризації екологічної свідомості та розвитку паркових зон.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-2 border-t border-outline-variant/30 pt-4">
            {["#ПаркГагаріна", "#Фестиваль", "#Відпочинок"].map((tag) => <span key={tag} className="rounded-full border border-outline-variant/20 bg-surface-container px-3 py-1 text-xs text-on-surface-variant">{tag}</span>)}
          </div>
        </article>
      </main>
      <BottomNav active="news" />
      <Toast message={toast} />
    </Shell>
  );
}
