import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { chatSuggestions, statusCards } from "../../consts/homeData.js";

function buildAssistantReply(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes("відключ") || normalized.includes("світ") || normalized.includes("елект")) {
    return "Для вашої адреси перевірте чергу в профілі. Попередньо можливі відключення з 10:00 до 12:00 та з 18:00 до 20:00.";
  }
  if (normalized.includes("цнап")) {
    return "Найближчий ЦНАП: майдан Польовий, 8. Сьогодні працює до 17:00, орієнтовне очікування 12 хвилин.";
  }
  if (normalized.includes("яма") || normalized.includes("звернення")) {
    return "Можна створити звернення в сервісі «Звернення»: додайте фото, адресу, категорію та короткий опис проблеми.";
  }
  return "Я підготував коротку відповідь. Для точнішої підказки вкажіть адресу або оберіть відповідний сервіс.";
}

export default function AssistantPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Вітаю. Можу підказати по транспорту, комунальних послугах, зверненнях або міських сервісах." },
  ]);

  const sendMessage = (textFromChip) => {
    const text = (textFromChip || input).trim();
    if (!text) return;
    setMessages((current) => [...current, { role: "user", text }, { role: "assistant", text: buildAssistantReply(text) }]);
    setInput("");
  };

  return (
    <Shell className="bg-background pb-28">
      <AppHeader
        eyebrow={t("app.name")}
        profile={{
          name: "Олександр",
          location: "Житомир, вул. Театральна",
          avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuB2E9jilZExfADABzvi5iNsDqUbEsEWRXK67mBTwLXkHMTHuJ4fJ12arV_62Fokw8GoeOKC7ZCcKaTjDNayaVcfrtWZoE3x0bbzXQDv_srhA6-Q78yiKq87rENP2xFvusa1F1-B9TVAVfpqOUk2ZK27qZ8dlWRbccwd6M6sDfjrtk0EdFcohEdRTFiJ7DQZLaoj7q3OQETeNhiggwAiqR73mB3sNe1gw-MTOzKVpiQHpktYi4cJSgPgHPAid3OKOC4zCD58aKL_vhI",
        }}
      />

      <main className="relative z-20 -mt-8 space-y-section-margin md:mx-auto md:max-w-6xl md:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start lg:gap-6 lg:space-y-0 lg:px-10">
        <section className="overflow-hidden md:overflow-visible">
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-container-padding pb-2 sm:px-6 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {statusCards.map((card) => (
              <article key={card.title} className="motion-card interactive-card h-[120px] w-[75%] shrink-0 snap-center rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm md:h-40 md:w-auto md:p-5">
                <span className="mb-2 block text-xs font-medium text-on-surface-variant">{card.label}</span>
                <div className="flex h-[70px] items-center gap-3 md:h-24 md:flex-col md:items-start md:justify-end">
                  <Icon name={card.icon} filled className={`float-soft text-[40px] md:text-[46px] ${card.tone}`} />
                  <div>
                    <h2 className="text-3xl font-bold leading-none text-on-surface md:text-2xl lg:text-3xl">{card.title}</h2>
                    <p className={`mt-1 text-xs font-medium ${card.tone}`}>{card.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-2 flex justify-center gap-1 md:hidden">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-container" />
            <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
            <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
          </div>
        </section>

        <section className="motion-card interactive-card mx-4 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm sm:mx-6 md:mx-0 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-on-surface">{t("chat.assistant")}</h2>
            <Link to="/chat-history" className="flex items-center gap-1 text-xs font-medium text-on-primary-container">
              <Icon name="history" className="text-base" /> {t("chat.openHistory")}
            </Link>
          </div>
          <div className="mb-6 max-h-64 space-y-3 overflow-y-auto pr-1">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div key={`${message.role}-${index}`} className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
                  {!isUser ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container shadow-sm">
                      <Icon name="smart_toy" className="text-lg text-on-primary" />
                    </div>
                  ) : null}
                  <div className={`max-w-[85%] rounded-2xl border p-4 text-sm leading-5 ${isUser ? "rounded-tr-sm border-primary-container/20 bg-primary-container text-on-primary" : "rounded-tl-sm border-outline-variant/20 bg-surface-container text-on-surface-variant"}`}>
                    {message.text}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mb-6 flex flex-wrap gap-2">
            {chatSuggestions.map((label) => (
              <button key={label} className="rounded-full border border-outline-variant/50 px-4 py-2 text-sm text-on-surface transition hover:border-primary-container hover:bg-primary-fixed/35 active:scale-95" type="button" onClick={() => sendMessage(label)}>{label}</button>
            ))}
          </div>
          {listening ? <p className="mb-2 text-xs font-bold text-on-tertiary-fixed-variant">{t("chat.listening")}</p> : null}
          <div className="mb-4 flex h-14 items-center rounded-2xl border border-outline-variant/50 bg-surface shadow-sm focus-within:border-primary-container">
            <input className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-sm outline-none placeholder:text-outline" placeholder={t("chat.inputPlaceholder")} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} />
            <button className={`mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl active:scale-95 ${listening ? "bg-secondary-container text-on-secondary-container" : "bg-primary-fixed/60 text-on-primary-fixed"}`} type="button" onClick={() => setListening((current) => !current)}>
              <Icon name="mic" filled className="text-xl" />
            </button>
          </div>
          <button className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container shadow-md transition hover:bg-secondary-fixed hover:shadow-lg active:scale-[0.98]" type="button" onClick={() => sendMessage()}>
            {t("chat.ask")} <Icon name="arrow_forward" className="text-xl" />
          </button>
        </section>
      </main>
      <BottomNav active="assistant" dark />
    </Shell>
  );
}
