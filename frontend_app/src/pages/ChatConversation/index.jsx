import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { useAutoScrollToBottom } from "../../hooks/useAutoScrollToBottom.js";
import { useAssistantChat } from "../../hooks/useAssistantChat.js";
import { useConversation } from "../../hooks/useConversation.js";
import { formatDate } from "../../lib/formatDate.js";

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-5 shadow-soft ${isUser ? "rounded-br-sm bg-primary-container text-on-primary" : message.isError ? "rounded-bl-sm border border-error-container bg-error-container/30 text-error" : "rounded-bl-sm border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant"}`}>
        <p>{message.text}</p>
      </div>
    </div>
  );
}

export default function ChatConversationPage() {
  const { t, i18n } = useTranslation();
  const { chatId } = useParams();
  const conversation = useConversation(chatId);
  const assistantChat = useAssistantChat();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const messagesEndRef = useAutoScrollToBottom(messages);

  // Seeds local state from the fetched conversation once, then the transcript is appended to
  // locally as new exchanges are sent - the same pattern the main Assistant page uses, so a
  // send doesn't wait on a full conversation refetch to show the new messages.
  useEffect(() => {
    if (conversation.data) setMessages(conversation.data.messages);
  }, [conversation.data]);

  // A still-loading conversation must not be mistaken for a missing one - only redirect once the
  // fetch has genuinely failed (e.g. a 404 for a foreign or deleted conversation id).
  if (conversation.isError) return <Navigate to="/chat-history" replace />;
  if (conversation.isLoading || !conversation.data) return null;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || assistantChat.isPending) return;
    setMessages((current) => [...current, { role: "user", text }]);
    setInput("");
    try {
      const result = await assistantChat.mutateAsync({ userQuery: text, conversationId: chatId });
      setMessages((current) => [...current, { role: "assistant", text: result.answer }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: t("chat.error"), isError: true }]);
    }
  };

  return (
    <Shell className="bg-surface-container-low pb-40">
      <AppHeader title={t("chat.conversation")} backTo="/chat-history" rightIcon="notifications" rightTo="/notifications" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-container-padding py-section-margin sm:px-6 md:px-8">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-primary">{conversation.data.title}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{formatDate(conversation.data.createdAt, i18n.resolvedLanguage)}</p>
        </div>
        {messages.map((message, index) => <MessageBubble key={`${message.role}-${index}`} message={message} />)}
        <div ref={messagesEndRef} className="scroll-mb-40" />
      </main>
      <div className="fixed inset-x-0 bottom-[calc(72px+var(--safe-bottom))] z-40 mx-auto w-full max-w-[1180px] border-t border-outline-variant/20 bg-surface/95 px-container-padding py-3 backdrop-blur-md sm:px-6 md:px-8">
        {listening ? <p className="mx-auto mb-2 max-w-3xl text-xs font-bold text-on-tertiary-fixed-variant">{t("chat.listening")}</p> : null}
        <div className="mx-auto flex h-14 max-w-3xl items-center rounded-2xl border border-outline-variant/50 bg-surface-container-lowest shadow-sm focus-within:border-primary-container">
          <input
            className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-sm outline-none placeholder:text-outline disabled:cursor-not-allowed"
            disabled={assistantChat.isPending}
            placeholder={assistantChat.isPending ? t("chat.thinking") : t("chat.inputPlaceholder")}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }}
          />
          <button className={`mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl active:scale-95 ${listening ? "bg-secondary-container text-on-secondary-container" : "bg-primary-fixed/60 text-on-primary-fixed"}`} type="button" onClick={() => setListening((current) => !current)}>
            <Icon name="mic" filled className="text-xl" />
          </button>
          <button
            className="mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={assistantChat.isPending}
            type="button"
            onClick={sendMessage}
          >
            <Icon name="send" className="text-xl" />
          </button>
        </div>
      </div>
      <BottomNav active="assistant" dark />
    </Shell>
  );
}
