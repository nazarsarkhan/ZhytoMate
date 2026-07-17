import { useState } from "react";
import { Link } from "react-router-dom";
import ActionCard from "../../components/assistant/ActionCard.jsx";
import AppCapabilityLinks from "../../components/assistant/AppCapabilityLinks.jsx";
import { getSourceLabel, getSourceUrl, isLinkableSource } from "../../lib/sourceDisplay.js";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import LinkifiedText from "../../components/assistant/LinkifiedText.jsx";
import MessageFeedback from "../../components/assistant/MessageFeedback.jsx";
import SinoptikWeatherWidget from "../../components/widgets/SinoptikWeatherWidget.jsx";
import OutageStatusCard from "../../components/widgets/OutageStatusCard.jsx";
import AirAlertStatusCard from "../../components/widgets/AirAlertStatusCard.jsx";
import { useAutoScrollToBottom } from "../../hooks/useAutoScrollToBottom.js";
import { useAssistantChat, useCancelAction, useConfirmAction } from "../../hooks/useAssistantChat.js";
import { useAssistantFeedback } from "../../hooks/useAssistantFeedback.js";
import { useCurrentUser } from "../../hooks/useCurrentUser.js";
import { chatSuggestions } from "../../consts/homeData.js";

export default function AssistantPage() {
  const currentUser = useCurrentUser();
  const assistantChat = useAssistantChat();
  const assistantFeedback = useAssistantFeedback();
  const confirmAction = useConfirmAction();
  const cancelAction = useCancelAction();
  // A pending confirm/cancel and a pending chat turn both mutate the same conversation's
  // pendingAction server-side - letting the composer send a new message while either is in flight
  // would race the atomic confirm/cancel claim against a chat turn that can also rewrite the draft.
  const isBusy = assistantChat.isPending || confirmAction.isPending || cancelAction.isPending;
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Вітаю. Можу підказати по транспорту, комунальних послугах, зверненнях або міських сервісах." },
  ]);
  // Starts a fresh conversation every visit to this page; set once the first exchange is
  // persisted, so subsequent sends within the same visit continue that same thread. Resuming an
  // older thread is what /chat-history is for, not this screen.
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useAutoScrollToBottom(messages);

  // A fresh confirming card always supersedes whatever was shown before - there is exactly one
  // pendingAction per conversation server-side, so a NEW actionCard means any earlier one is now
  // stale. A plain reply that carries no actionCard (e.g. an unrelated question the backend
  // answered without touching the draft) must leave earlier cards untouched - the design spec
  // requires the draft to survive an off-topic interruption, so collapsing on every reply would
  // wrongly kill the user's ability to confirm/cancel a draft that's still alive server-side.
  const collapseEarlierActionCards = (current) =>
    current.map((message) => (message.actionCard ? { ...message, actionCard: null } : message));

  const sendMessage = async (textFromChip) => {
    const text = (textFromChip || input).trim();
    if (!text || isBusy) return;
    setMessages((current) => [...current, { role: "user", text }]);
    setInput("");
    try {
      const result = await assistantChat.mutateAsync({ userQuery: text, conversationId });
      if (result.conversationId) setConversationId(result.conversationId);
      setMessages((current) => [
        ...(result.actionCard ? collapseEarlierActionCards(current) : current),
        {
          role: "assistant",
          text: result.answer,
          actionCard: result.actionCard || null,
          answerStatus: result.answerStatus || "ungrounded",
          verified: result.verified === true,
          sourcesUsed: Array.isArray(result.sourcesUsed) ? result.sourcesUsed : [],
          appLinks: Array.isArray(result.appLinks) ? result.appLinks : [],
          messageId: result.messageId || null,
          userQuery: text,
          feedback: null,
        },
      ]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "Щось пішло не так. Спробуйте ще раз.", isError: true }]);
    }
  };

  const submitFeedback = async (index, feedback) => {
    const message = messages[index];
    const result = await assistantFeedback.mutateAsync({
      messageId: message.messageId,
      conversationId,
      vote: feedback.vote,
      reason: feedback.reason,
      userQuery: message.userQuery,
      answer: message.text,
      answerStatus: message.answerStatus,
      verified: message.verified,
      sourcesUsed: message.sourcesUsed,
      appLinks: message.appLinks,
    });
    setMessages((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, feedback: result.feedback } : item));
  };

  // Once an action card is resolved, it must stop being interactive - otherwise a later re-click
  // would still reach the backend (safely, but as a confusing "No action awaiting confirmation"
  // error with no visible cause) since the card itself has no notion of its own past outcome.
  const applyActionResult = (index, actionResult) => {
    setMessages((current) => [
      ...current.map((message, messageIndex) =>
        messageIndex === index ? { ...message, actionCard: null } : message,
      ),
      { role: "assistant", text: actionResult.answer },
    ]);
  };

  return (
    <Shell className="bg-background pb-28">
      <AppHeader
        eyebrow="Zhytomyr Assistant"
        profile={
          currentUser.data
            ? {
                name: currentUser.data.firstName,
                location: "Житомир",
                avatarUrl: currentUser.data.avatarUrl,
              }
            : undefined
        }
      />

      <main className="relative z-20 -mt-8 space-y-section-margin md:mx-auto md:max-w-6xl md:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start lg:gap-6 lg:space-y-0 lg:px-10">
        <section className="overflow-hidden md:overflow-visible">
          <div className="px-container-padding pb-3 sm:px-6 md:px-0">
            <SinoptikWeatherWidget className="motion-card interactive-card overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm md:p-5" />
          </div>
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-container-padding pb-2 sm:px-6 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-2">
            <AirAlertStatusCard />
            <OutageStatusCard />
          </div>
          <div className="mt-2 flex justify-center gap-1 md:hidden">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-container" />
            <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
          </div>
        </section>

        <section className="motion-card interactive-card mx-4 rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm sm:mx-6 md:mx-0 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-on-surface">AI Асистент</h2>
            <Link to="/chat-history" className="flex items-center gap-1 text-xs font-medium text-on-primary-container">
              <Icon name="history" className="text-base" /> Історія чатів
            </Link>
          </div>
          <div className="mb-6 max-h-64 space-y-3 overflow-y-auto pr-1">
            {/* Keyed by role+index, not a stable id - relies on messages staying strictly
                append-only. An action-card message now carries meaningful local state inside
                ActionCard (its own isPending/error), so reordering or removing a message would
                silently hand that state to the wrong list item. */}
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div key={`${message.role}-${index}`} className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
                  {!isUser ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container shadow-sm">
                      <Icon name="smart_toy" className="text-lg text-on-primary" />
                    </div>
                  ) : null}
                  {message.actionCard ? (
                    <ActionCard
                      actionCard={message.actionCard}
                      onConfirm={async () => applyActionResult(index, await confirmAction.mutateAsync(conversationId))}
                      onCancel={async () => applyActionResult(index, await cancelAction.mutateAsync(conversationId))}
                    />
                  ) : (
                    <div className={`max-w-[85%] break-words rounded-2xl border p-4 text-sm leading-5 ${isUser ? "rounded-tr-sm border-primary-container/20 bg-primary-container text-on-primary" : message.isError ? "rounded-tl-sm border-error-container bg-error-container/30 text-error" : "rounded-tl-sm border-outline-variant/20 bg-surface-container text-on-surface-variant"}`}>
                      <LinkifiedText>{message.text}</LinkifiedText>
                      <AppCapabilityLinks links={message.appLinks} />
                      {message.verified && message.sourcesUsed?.length ? (
                        <div className="mt-2 border-t border-outline-variant/30 pt-2 text-xs text-on-surface-variant">
                          <p className="font-semibold">Джерела</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            {message.sourcesUsed.slice(0, 5).map((source, sourceIndex) => (
                              <li key={`${getSourceUrl(source)}-${sourceIndex}`}>
                                {isLinkableSource(source) ? (
                                  <a href={getSourceUrl(source)} target="_blank" rel="noreferrer" className="underline decoration-outline hover:text-primary-container">
                                    {getSourceLabel(source)}
                                  </a>
                                ) : getSourceLabel(source)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {!isUser && message.answerStatus === "verification_failed" ? (
                        <p className="mt-2 border-t border-outline-variant/30 pt-2 text-xs font-semibold text-on-surface-variant">
                          Інформацію не вдалося підтвердити офіційними джерелами.
                        </p>
                      ) : null}
                      {!isUser && !message.isError && message.messageId ? (
                        <MessageFeedback message={message} onSubmit={(feedback) => submitFeedback(index, feedback)} />
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
            {assistantChat.isPending ? (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container shadow-sm">
                  <Icon name="smart_toy" className="text-lg text-on-primary" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-outline-variant/20 bg-surface-container px-4 py-3">
                  <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-on-surface-variant" />
                  <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-on-surface-variant" style={{ animationDelay: "0.2s" }} />
                  <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-on-surface-variant" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
          <div className="mb-6 flex flex-wrap gap-2">
            {chatSuggestions.map((label) => (
              <button key={label} className="rounded-full border border-outline-variant/50 px-4 py-2 text-sm text-on-surface transition hover:border-primary-container hover:bg-primary-fixed/35 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50" disabled={isBusy} type="button" onClick={() => sendMessage(label)}>{label}</button>
            ))}
          </div>
          {listening ? <p className="mb-2 text-xs font-bold text-on-tertiary-fixed-variant">Слухаю запит...</p> : null}
          <div className="mb-4 flex h-14 items-center rounded-2xl border border-outline-variant/50 bg-surface shadow-sm focus-within:border-primary-container">
            <input
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 text-sm outline-none placeholder:text-outline disabled:cursor-not-allowed"
              disabled={isBusy}
              placeholder={isBusy ? "AI обмірковує відповідь..." : "Запитай асистента..."}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }}
            />
            <button className={`mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl active:scale-95 ${listening ? "bg-secondary-container text-on-secondary-container" : "bg-primary-fixed/60 text-on-primary-fixed"}`} type="button" onClick={() => setListening((current) => !current)}>
              <Icon name="mic" filled className="text-xl" />
            </button>
          </div>
          <button
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container shadow-md transition hover:bg-secondary-fixed hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBusy}
            type="button"
            onClick={() => sendMessage()}
          >
            {isBusy ? "AI обмірковує відповідь..." : "Запитати AI"} <Icon name="arrow_forward" className="text-xl" />
          </button>
        </section>
      </main>
      <BottomNav active="assistant" dark />
    </Shell>
  );
}
