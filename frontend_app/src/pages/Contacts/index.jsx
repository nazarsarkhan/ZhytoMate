import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { useContacts } from "../../hooks/useContacts.js";
import { usePublicSettings } from "../../hooks/usePublicSettings.js";

function StateCard({ children, tone = "neutral" }) {
  const classes = tone === "error"
    ? "border-error-container bg-error-container/20 text-error"
    : "border-surface-variant bg-surface-container-lowest text-on-surface-variant";

  return <div className={`rounded-xl border p-4 text-sm shadow-soft ${classes}`}>{children}</div>;
}

export default function ContactsPage() {
  const contactsQuery = useContacts();
  const settingsQuery = usePublicSettings();

  const emergency = Array.isArray(contactsQuery.data?.emergency) ? contactsQuery.data.emergency : [];
  const groups = Array.isArray(contactsQuery.data?.groups) ? contactsQuery.data.groups : [];
  const cityHotline = settingsQuery.data?.cityHotline || "";

  return (
    <Shell className="bg-background pb-28">
      <AppHeader title="Контакти міста" backTo="/services" rightIcon="notifications" rightTo="/notifications" />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-section-margin px-container-padding py-section-margin sm:px-6 md:grid md:grid-cols-[360px_minmax(0,1fr)] md:items-start md:px-8">
        <section className="rounded-xl bg-secondary-container p-4 text-on-secondary-container shadow-sm md:sticky md:top-24">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/30">
              <Icon name="support_agent" />
            </span>
            <div>
              <h2 className="text-lg font-bold">Гаряча лінія міськради</h2>
              <p className="text-sm text-on-secondary-container/75">Цілодобова підтримка</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-white/20 p-3">
            {settingsQuery.isLoading ? (
              <p className="text-sm font-semibold">Завантаження...</p>
            ) : settingsQuery.error ? (
              <p className="text-sm font-semibold">Не вдалося завантажити гарячу лінію.</p>
            ) : cityHotline ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xl font-bold">{cityHotline}</span>
                <a className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary active:scale-95" href={`tel:${cityHotline.replaceAll(" ", "")}`}>
                  <Icon name="call" className="text-lg" /> Телефонувати
                </a>
              </div>
            ) : (
              <p className="text-sm font-semibold">Номер ще не вказано.</p>
            )}
          </div>
        </section>
        <div className="space-y-section-margin">
          <section>
            <h2 className="mb-3 text-lg font-bold text-primary-container">Екстрені служби</h2>
            {contactsQuery.isLoading ? <StateCard>Завантаження...</StateCard> : null}
            {contactsQuery.error ? <StateCard tone="error">{contactsQuery.error.message || "Не вдалося завантажити контакти."}</StateCard> : null}
            {!contactsQuery.isLoading && !contactsQuery.error ? (
              emergency.length ? (
                <div className="grid grid-cols-2 gap-gutter">
                  {emergency.map((item) => (
                    <article key={item.id || item.phone} className="rounded-xl border border-surface-variant bg-surface-container-lowest p-4 text-center shadow-soft">
                      <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
                        <Icon name={item.icon} filled />
                      </span>
                      <p className="text-sm text-on-surface-variant">{item.name}</p>
                      <p className="mt-1 text-lg font-bold text-primary-container">{item.phone}</p>
                      <a className="mt-3 block w-full rounded-full border border-error py-2 text-xs font-bold text-error active:scale-95" href={`tel:${item.phone}`}>
                        Виклик
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                <StateCard>Екстрені контакти ще не додані.</StateCard>
              )
            ) : null}
          </section>

          {!contactsQuery.isLoading && !contactsQuery.error ? (
            groups.length ? (
              groups.map((group) => (
                <section key={group.group}>
                  <h2 className="mb-3 text-lg font-bold text-primary-container">{group.group}</h2>
                  <div className="overflow-hidden rounded-xl border border-surface-variant bg-surface-container-lowest shadow-soft">
                    {group.items.map((item, index) => (
                      <div key={item.id || item.name} className={`flex items-center justify-between p-4 ${index ? "border-t border-surface-variant" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
                            <Icon name={item.icon} />
                          </span>
                          <div>
                            <p className="font-semibold text-on-surface">{item.name}</p>
                            <p className="text-xs text-on-surface-variant">{item.phone}</p>
                          </div>
                        </div>
                        <a className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed/40 text-on-primary-fixed active:scale-95" href={`tel:${item.phone.replaceAll(" ", "")}`}>
                          <Icon name="call" />
                        </a>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <StateCard>Інші міські контакти ще не додані.</StateCard>
            )
          ) : null}
        </div>
      </main>
      <BottomNav active="services" dark />
    </Shell>
  );
}
