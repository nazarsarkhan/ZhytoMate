import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { appealCategoryMeta, appealStatusLabels, appealStatusTone } from "../../consts/appealCategories.js";
import { useAppeal } from "../../hooks/useAppeals.js";
import { formatDate } from "../../lib/formatDate.js";

const STATUS_STEP = { new: 1, in_progress: 2, resolved: 3, rejected: 3 };

function StatusTimeline({ status }) {
  const step = STATUS_STEP[status] || 1;
  const isRejected = status === "rejected";
  const nodes = [
    { key: "received", label: "Отримано", icon: "inbox", done: step >= 1 },
    { key: "inReview", label: "Розглядається", icon: "search", done: step >= 2 },
    isRejected
      ? { key: "rejected", label: "Відхилено", icon: "cancel", done: true, error: true }
      : { key: "resolved", label: "Вирішено", icon: "task_alt", done: step >= 3 },
  ];

  return (
    <ol className="space-y-1">
      {nodes.map((node, index) => {
        const nextDone = index < nodes.length - 1 && nodes[index + 1].done;
        return (
          <li key={node.key} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  node.done
                    ? node.error
                      ? "bg-error-container text-error"
                      : "bg-secondary-container text-on-secondary-container"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                <Icon name={node.done ? node.icon : "radio_button_unchecked"} className="text-lg" filled={node.done} />
              </span>
              {index < nodes.length - 1 ? (
                <span className={`my-1 w-0.5 flex-1 ${nextDone ? "bg-secondary-container" : "bg-surface-container-high"}`} />
              ) : null}
            </div>
            <span className={`pb-4 pt-1.5 text-sm font-bold ${node.done ? "text-on-surface" : "text-on-surface-variant"}`}>
              {node.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function AppealPhoto({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low text-on-surface-variant">
        <Icon name="image_not_supported" className="text-4xl" />
        <span className="text-sm font-bold">Фото недоступне</span>
      </div>
    );
  }

  return (
    <img
      className="aspect-video w-full rounded-2xl border border-outline-variant/30 object-cover shadow-soft"
      alt={alt}
      src={src}
      onError={() => setFailed(true)}
    />
  );
}

export default function AppealDetailPage() {
  const { appealId } = useParams();
  const appealQuery = useAppeal(appealId);
  const appeal = appealQuery.data;

  if (appealQuery.isError) return <Navigate to="/services/appeals" replace />;
  if (!appeal) return null;

  const meta = appealCategoryMeta(appeal.category);
  const reviewed = appeal.status !== "new";

  return (
    <Shell className="bg-background pb-28">
      <AppHeader title="Звернення" backTo="/services/appeals" rightIcon="notifications" rightTo="/notifications" />
      <main className="mx-auto w-full max-w-2xl space-y-section-margin px-container-padding py-section-margin sm:px-6 md:px-8">
        <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary">
              <Icon name={meta.icon} className="text-base" /> {meta.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${appealStatusTone[appeal.status] || appealStatusTone.new}`}>
              {appealStatusLabels[appeal.status] || appeal.status}
            </span>
          </div>
          <div
            className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold ${
              reviewed ? "bg-green-50 text-green-700" : "bg-surface-container-low text-on-surface-variant"
            }`}
          >
            <Icon name={reviewed ? "verified" : "hourglass_top"} filled className="text-lg" />
            {reviewed ? "Перевірено службою" : "Очікує розгляду"}
          </div>
        </section>

        <AppealPhoto src={appeal.imageUrl} alt={meta.label} />

        <section className="space-y-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft">
          <div className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2.5 text-sm text-on-surface-variant">
            <Icon name="location_on" className="shrink-0 text-lg text-outline" />
            <span className="font-semibold text-on-surface">{appeal.address}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2.5 text-sm text-on-surface-variant">
            <Icon name="calendar_today" className="shrink-0 text-lg text-outline" />
            <span>Подано: <b className="text-on-surface">{formatDate(appeal.createdAt)}</b></span>
          </div>
          <div>
            <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Опис проблеми</h2>
            <p className="whitespace-pre-line text-sm leading-6 text-on-surface">{appeal.description}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft">
          <h2 className="mb-4 text-lg font-bold text-on-surface">Статус опрацювання</h2>
          <StatusTimeline status={appeal.status} />
        </section>

        <section
          className={`rounded-2xl border p-4 shadow-soft ${
            appeal.response ? "border-secondary-container bg-secondary-container/10" : "border-outline-variant/30 bg-surface-container-lowest"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <Icon name="account_balance" filled className="text-lg text-primary" />
            <h2 className="text-lg font-bold text-on-surface">Відповідь від міста</h2>
          </div>
          {appeal.response ? (
            <>
              <p className="whitespace-pre-line text-sm leading-6 text-on-surface">{appeal.response}</p>
              <p className="mt-3 text-xs text-on-surface-variant">Оновлено: {formatDate(appeal.updatedAt)}</p>
            </>
          ) : (
            <div className="flex items-start gap-2 text-sm leading-6 text-on-surface-variant">
              <Icon name="schedule" className="mt-0.5 shrink-0 text-lg" />
              <p>Відповіді ще немає. Ми повідомимо, щойно звернення розглянуть.</p>
            </div>
          )}
        </section>
      </main>
      <BottomNav active="services" />
    </Shell>
  );
}
