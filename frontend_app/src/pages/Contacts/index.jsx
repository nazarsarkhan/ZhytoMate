import Shell from "../../components/layout/Shell.jsx";
import TopBar from "../../components/topbar/TopBar.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { emergencyServices, utilityContacts } from "../../consts/serviceData.js";

export default function ContactsPage() {
  return (
    <Shell className="bg-background pb-10">
      <TopBar title="Контакти міста" backTo="/services" rightIcon="search" dark />
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
          <div className="mt-4 flex items-center justify-between rounded-lg bg-white/20 p-3">
            <span className="text-2xl font-bold">15-80</span>
            <button className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary active:scale-95">
              <Icon name="call" className="text-lg" /> Телефонувати
            </button>
          </div>
        </section>
        <div className="space-y-section-margin">
          <section>
            <h2 className="mb-3 text-lg font-bold text-primary-container">Екстрені служби</h2>
            <div className="grid grid-cols-2 gap-gutter">
              {emergencyServices.map((item) => (
                <article key={item.phone} className="rounded-xl border border-surface-variant bg-surface-container-lowest p-4 text-center shadow-soft">
                  <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
                    <Icon name={item.icon} filled />
                  </span>
                  <p className="text-sm text-on-surface-variant">{item.name}</p>
                  <p className="mt-1 text-lg font-bold text-primary-container">{item.phone}</p>
                  <button className="mt-3 w-full rounded-full border border-error py-2 text-xs font-bold text-error active:scale-95">Виклик</button>
                </article>
              ))}
            </div>
          </section>
          {utilityContacts.map((group) => (
            <section key={group.group}>
              <h2 className="mb-3 text-lg font-bold text-primary-container">{group.group}</h2>
              <div className="overflow-hidden rounded-xl border border-surface-variant bg-surface-container-lowest shadow-soft">
                {group.items.map((item, index) => (
                  <div key={item.name} className={`flex items-center justify-between p-4 ${index ? "border-t border-surface-variant" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed">
                        <Icon name={item.icon} />
                      </span>
                      <div>
                        <p className="font-semibold text-on-surface">{item.name}</p>
                        <p className="text-xs text-on-surface-variant">{item.phone}</p>
                      </div>
                    </div>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed/40 text-on-primary-fixed active:scale-95">
                      <Icon name="call" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </Shell>
  );
}
