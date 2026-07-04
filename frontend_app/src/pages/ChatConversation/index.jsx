import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { chats } from "../../consts/homeData.js";

function AssistantCard({ card }) {
  return (
    <div className="mt-2 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
          <Icon name={card.icon} />
        </span>
        <span>
          <span className="block font-bold text-on-surface">{card.title}</span>
          <span className="mt-1 block text-sm leading-5 text-on-surface-variant">{card.text}</span>
        </span>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-5 shadow-soft ${isUser ? "rounded-br-sm bg-primary-container text-on-primary" : "rounded-bl-sm border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant"}`}>
        {message.text ? <p>{message.text}</p> : null}
        {message.card ? <AssistantCard card={message.card} /> : null}
      </div>
    </div>
  );
}

function buildAnswer(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes("транспорт") || normalized.includes("тролейбус") || normalized.includes("маршрут")) {
    return "Найближчі маршрути можна перевірити в сервісі «Транспорт». Для тролейбуса №3 очікування зараз близько 6 хвилин.";
  }
  if (normalized.includes("яма") || normalized.includes("звернення")) {
    return "Для міської проблеми відкрийте «Сервіси -> Звернення», додайте фото, категорію та опис. Заявка залишиться у вашій історії звернень.";
  }
  if (normalized.includes("цнап")) {
    return "Найближчий ЦНАП: майдан Польовий, 8. Рекомендовано взяти паспорт, РНОКПП та документи за послугою.";
  }
  return "Я зібрав коротку довідку за вашим запитом. Для точного рішення можна перейти у відповідний сервіс або уточнити адресу.";
}

export default function ChatConversationPage() {
  const { t } = useTranslation();
  const { chatId } = useParams();
  const chat = chats.find((item) => item.id === chatId);
  const [messages, setMessages] = useState(chat?.messages || []);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);

  if (!chat) return <Navigate to="/chat-history" replace />;

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((current) => [...current, { role: "user", text }, { role: "assistant", text: buildAnswer(text) }]);
    setInput("");
  };

  return (
    <Shell className="bg-surface-container-low pb-40">
      <AppHeader title={t("chat.conversation")} backTo="/chat-history" rightIcon="notifications" rightTo="/notifications" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-container-padding py-section-margin sm:px-6 md:px-8">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-primary">{chat.title}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{chat.date}</p>
        </div>
        {messages.map((message, index) => <MessageBubble key={`${message.role}-${index}`} message={message} />)}
      </main>
      <div className="fixed inset-x-0 bottom-[calc(72px+var(--safe-bottom))] z-40 mx-auto w-full max-w-[1180px] border-t border-outline-variant/20 bg-surface/95 px-container-padding py-3 backdrop-blur-md sm:px-6 md:px-8">
        {listening ? <p className="mx-auto mb-2 max-w-3xl text-xs font-bold text-on-tertiary-fixed-variant">{t("chat.listening")}</p> : null}
        <div className="mx-auto flex h-14 max-w-3xl items-center rounded-2xl border border-outline-variant/50 bg-surface-container-lowest shadow-sm focus-within:border-primary-container">
          <input className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-sm outline-none placeholder:text-outline" placeholder={t("chat.inputPlaceholder")} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} />
          <button className={`mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl active:scale-95 ${listening ? "bg-secondary-container text-on-secondary-container" : "bg-primary-fixed/60 text-on-primary-fixed"}`} type="button" onClick={() => setListening((current) => !current)}>
            <Icon name="mic" filled className="text-xl" />
          </button>
          <button className="mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container active:scale-95" type="button" onClick={sendMessage}>
            <Icon name="send" className="text-xl" />
          </button>
        </div>
      </div>
      <BottomNav active="assistant" dark />
    </Shell>
  );
}
