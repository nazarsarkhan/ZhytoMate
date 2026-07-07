import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ActionCard from "../../components/assistant/ActionCard.jsx";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { useAutoScrollToBottom } from "../../hooks/useAutoScrollToBottom.js";
import { useAssistantChat, useCancelAction, useConfirmAction } from "../../hooks/useAssistantChat.js";
import { useConversation } from "../../hooks/useConversation.js";
import { formatDate } from "../../lib/formatDate.js";

// The backend never clears a message's own stored actionCard once set - confirming, cancelling, or
// superseding a draft only ever APPENDS a new message (see assistantActions.service.js and
// assistant.service.js::resolveDraftState on the backend). So a conversation's raw message history,
// taken at face value, would show every actionCard the draft ever had as if still live. There is
// exactly one pendingAction per conversation, and it only reaches "confirming" (the only status an
// actionCard is ever attached for) at the same moment that card's message is appended - so the
// LATEST actionCard-bearing message is the live one, but only while pendingAction.status is still
// "confirming" right now; once it's null (resolved) or back to "collecting" (a fresh draft, or an
// invalid-enum revision request), every historical actionCard is stale and must render as a plain,
// non-interactive bubble instead.
function collapseResolvedActionCards(messages, pendingAction) {
  if (pendingAction?.status !== "confirming") {
    return messages.map((message) => (message.actionCard ? { ...message, actionCard: null } : message));
  }
  const liveIndex = messages.reduce(
    (foundIndex, message, index) => (message.actionCard ? index : foundIndex),
    -1,
  );
  return messages.map((message, index) =>
    message.actionCard && index !== liveIndex ? { ...message, actionCard: null } : message,
  );
}

function MessageBubble({ message, index, conversationId, confirmAction, cancelAction, onActionResult }) {
  const isUser = message.role === "user";

  if (message.actionCard) {
    return (
      <div className="flex justify-start">
        <ActionCard
          actionCard={message.actionCard}
          onConfirm={async () => onActionResult(index, await confirmAction.mutateAsync(conversationId))}
          onCancel={async () => onActionResult(index, await cancelAction.mutateAsync(conversationId))}
        />
      </div>
    );
  }

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
  const confirmAction = useConfirmAction();
  const cancelAction = useCancelAction();
  // A pending confirm/cancel and a pending chat turn both mutate the same conversation's
  // pendingAction server-side - letting the composer send a new message while either is in flight
  // would race the atomic confirm/cancel claim against a chat turn that can also rewrite the draft.
  // Same reasoning as Assistant/index.jsx's isBusy.
  const isBusy = assistantChat.isPending || confirmAction.isPending || cancelAction.isPending;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  // Tracks which conversation the local `messages` state was last seeded from - see the effect
  // below for why this must gate re-seeding, not just run once at mount.
  const [seededConversationId, setSeededConversationId] = useState(null);
  const messagesEndRef = useAutoScrollToBottom(messages);

  // Seeds local state from the fetched conversation once per conversation id, then the transcript
  // is owned locally from that point on - the same ownership model the Assistant page uses. This
  // must NOT re-run on every later refetch of this same conversation: useAssistantChat,
  // useConfirmAction and useCancelAction all invalidate the shared ["conversations"] query key (so
  // the /chat-history list picks up the latest snippet), and that invalidation also refetches this
  // page's own active useConversation query. The server's stored message history never collapses a
  // superseded or resolved actionCard - confirming/cancelling/superseding only ever APPENDS a new
  // message - so blindly re-seeding on every refetch would silently resurrect an actionCard this
  // page had already collapsed locally, making it clickable again out from under the user. Keying
  // the guard on chatId (rather than a plain "have we ever seeded" flag) still lets navigating from
  // one conversation straight to another re-seed correctly, since this page component persists
  // across that navigation.
  useEffect(() => {
    if (conversation.data && seededConversationId !== chatId) {
      setMessages(collapseResolvedActionCards(conversation.data.messages, conversation.data.pendingAction));
      setSeededConversationId(chatId);
    }
  }, [conversation.data, chatId, seededConversationId]);

  // A still-loading conversation must not be mistaken for a missing one - only redirect once the
  // fetch has genuinely failed (e.g. a 404 for a foreign or deleted conversation id).
  if (conversation.isError) return <Navigate to="/chat-history" replace />;
  if (conversation.isLoading || !conversation.data) return null;

  // A fresh confirming card always supersedes whatever was shown before - there is exactly one
  // pendingAction per conversation server-side, so a NEW actionCard means any earlier one is now
  // stale. A plain reply that carries no actionCard (e.g. an unrelated question the backend
  // answered without touching the draft) must leave earlier cards untouched - the draft must
  // survive an off-topic interruption. See Assistant/index.jsx for the full reasoning; the rule is
  // identical here.
  const collapseEarlierActionCards = (current) =>
    current.map((message) => (message.actionCard ? { ...message, actionCard: null } : message));

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isBusy) return;
    setMessages((current) => [...current, { role: "user", text }]);
    setInput("");
    try {
      const result = await assistantChat.mutateAsync({ userQuery: text, conversationId: chatId });
      setMessages((current) => [
        ...(result.actionCard ? collapseEarlierActionCards(current) : current),
        { role: "assistant", text: result.answer, actionCard: result.actionCard || null },
      ]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: t("chat.error"), isError: true }]);
    }
  };

  // Once an action card is resolved, it must stop being interactive - otherwise a later re-click
  // would still reach the backend (safely, but as a confusing "No action awaiting confirmation"
  // error with no visible cause) since the card itself has no notion of its own past outcome. Same
  // pattern as Assistant/index.jsx's applyActionResult.
  const applyActionResult = (index, actionResult) => {
    setMessages((current) => [
      ...current.map((message, messageIndex) =>
        messageIndex === index ? { ...message, actionCard: null } : message,
      ),
      { role: "assistant", text: actionResult.answer },
    ]);
  };

  return (
    <Shell className="bg-surface-container-low pb-40">
      <AppHeader title={t("chat.conversation")} backTo="/chat-history" rightIcon="notifications" rightTo="/notifications" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-container-padding py-section-margin sm:px-6 md:px-8">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-primary">{conversation.data.title}</h1>
          <p className="mt-1 text-sm text-on-surface-variant">{formatDate(conversation.data.createdAt, i18n.resolvedLanguage)}</p>
        </div>
        {messages.map((message, index) => (
          <MessageBubble
            key={`${message.role}-${index}`}
            message={message}
            index={index}
            conversationId={chatId}
            confirmAction={confirmAction}
            cancelAction={cancelAction}
            onActionResult={applyActionResult}
          />
        ))}
        <div ref={messagesEndRef} className="scroll-mb-40" />
      </main>
      <div className="fixed inset-x-0 bottom-[calc(72px+var(--safe-bottom))] z-40 mx-auto w-full max-w-[1180px] border-t border-outline-variant/20 bg-surface/95 px-container-padding py-3 backdrop-blur-md sm:px-6 md:px-8">
        {listening ? <p className="mx-auto mb-2 max-w-3xl text-xs font-bold text-on-tertiary-fixed-variant">{t("chat.listening")}</p> : null}
        <div className="mx-auto flex h-14 max-w-3xl items-center rounded-2xl border border-outline-variant/50 bg-surface-container-lowest shadow-sm focus-within:border-primary-container">
          <input
            className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-sm outline-none placeholder:text-outline disabled:cursor-not-allowed"
            disabled={isBusy}
            placeholder={isBusy ? t("chat.thinking") : t("chat.inputPlaceholder")}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }}
          />
          <button className={`mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl active:scale-95 ${listening ? "bg-secondary-container text-on-secondary-container" : "bg-primary-fixed/60 text-on-primary-fixed"}`} type="button" onClick={() => setListening((current) => !current)}>
            <Icon name="mic" filled className="text-xl" />
          </button>
          <button
            className="mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBusy}
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
