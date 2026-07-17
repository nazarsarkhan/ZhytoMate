import { useState } from "react";
import Icon from "../ui/Icon.jsx";

const REASONS = [
  ["incorrect_answer", "Неправильна відповідь"],
  ["missing_information", "Не вистачає інформації"],
  ["outdated_information", "Застаріла інформація"],
  ["poor_sources", "Погані джерела"],
  ["unclear_answer", "Незрозуміла відповідь"],
];

export default function MessageFeedback({ message, onSubmit }) {
  const [vote, setVote] = useState(message.feedback?.vote || null);
  const [reason, setReason] = useState(message.feedback?.reason || null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (nextVote, nextReason = null) => {
    const previous = { vote, reason };
    setVote(nextVote);
    setReason(nextReason);
    setPending(true);
    setError(false);
    try {
      await onSubmit({ vote: nextVote, reason: nextReason });
      setReasonOpen(false);
    } catch {
      setVote(previous.vote);
      setReason(previous.reason);
      setError(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-3 border-t border-outline-variant/20 pt-2">
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-[11px] text-on-surface-variant">Корисна відповідь?</span>
        <button type="button" aria-label="Оцінити відповідь позитивно" aria-pressed={vote === "up"} disabled={pending} onClick={() => submit("up")} className={`rounded-lg p-1.5 transition ${vote === "up" ? "bg-green-100 text-green-700" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
          <Icon name="thumb_up" className="text-base" />
        </button>
        <button type="button" aria-label="Оцінити відповідь негативно" aria-pressed={vote === "down"} disabled={pending} onClick={() => setReasonOpen(true)} className={`rounded-lg p-1.5 transition ${vote === "down" ? "bg-red-100 text-red-700" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
          <Icon name="thumb_down" className="text-base" />
        </button>
        {pending ? <span className="text-[11px] text-on-surface-variant">Зберігаємо…</span> : null}
      </div>
      {reasonOpen ? (
        <div className="mt-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2">
          <p className="mb-1.5 text-xs font-semibold text-on-surface">Що було не так?</p>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map(([value, label]) => <button key={value} type="button" disabled={pending} onClick={() => submit("down", value)} className="rounded-full border border-outline-variant/40 px-2.5 py-1 text-[11px] text-on-surface-variant hover:bg-surface-container-high">{label}</button>)}
            <button type="button" disabled={pending} onClick={() => submit("down")} className="rounded-full border border-outline-variant/40 px-2.5 py-1 text-[11px] text-on-surface-variant hover:bg-surface-container-high">Без причини</button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-[11px] text-error">Не вдалося зберегти оцінку. Спробуйте ще раз.</p> : null}
      {vote ? <p className="mt-1 text-[11px] text-on-surface-variant">Дякуємо за відгук.</p> : null}
    </div>
  );
}
