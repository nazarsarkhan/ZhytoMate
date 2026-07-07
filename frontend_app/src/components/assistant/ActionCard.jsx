import { useState } from "react";
import Icon from "../ui/Icon.jsx";

export default function ActionCard({ actionCard, onConfirm, onCancel }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const handle = async (fn) => {
    if (isPending) return;
    setIsPending(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err?.message || "Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-outline-variant/20 bg-surface-container p-4 text-sm leading-5 text-on-surface-variant">
      <p className="whitespace-pre-line font-medium text-on-surface">{actionCard.summary}</p>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handle(onConfirm)}
          className="flex flex-1 items-center justify-center gap-1 rounded-full bg-secondary-container px-3 py-2 text-sm font-bold text-on-secondary-container disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="check" className="text-base" /> Підтвердити
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handle(onCancel)}
          className="flex flex-1 items-center justify-center gap-1 rounded-full border border-outline-variant/50 px-3 py-2 text-sm font-bold text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="close" className="text-base" /> Скасувати
        </button>
      </div>
    </div>
  );
}
