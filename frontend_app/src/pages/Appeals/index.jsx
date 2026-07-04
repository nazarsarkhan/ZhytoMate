import { useState } from "react";
import Shell from "../../components/layout/Shell.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Modal from "../../components/overlay/Modal.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { appeals } from "../../consts/serviceData.js";

export default function AppealsPage() {
  const [open, setOpen] = useState(false);

  return (
    <Shell className="bg-background pb-28">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-primary-container px-container-padding py-4 text-on-primary shadow-sm sm:px-6 md:px-8">
        <Icon name="account_balance" className="text-primary-fixed-dim" />
        <h1 className="text-lg font-bold md:text-2xl">Zhytomyr Assistant</h1>
        <Icon name="notifications" className="text-primary-fixed-dim" />
      </header>
      <main className="mx-auto w-full max-w-5xl">
        <section className="rounded-b-3xl bg-primary-container px-container-padding pb-8 pt-6 text-on-primary shadow-sm sm:px-6 md:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold">Нове звернення</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-fixed-dim">Повідомте про проблему в місті, і ми передамо її до відповідних служб для оперативного вирішення.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Інфраструктура", "Комунальні", "Екологія"].map((label) => (
                <span key={label} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs">{label}</span>
              ))}
            </div>
            <button className="mt-6 flex h-14 w-full max-w-md items-center justify-center gap-2 rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container shadow-sm active:scale-95" onClick={() => setOpen(true)}>
              <Icon name="add_circle" filled /> Створити звернення
            </button>
          </div>
        </section>
        <section className="px-container-padding py-section-margin sm:px-6 md:px-8">
          <div className="mb-4 flex items-end justify-between">
            <h3 className="text-lg font-bold text-on-surface">Історія звернень</h3>
            <button className="flex items-center gap-1 text-xs font-bold text-on-tertiary-fixed-variant">Фільтр <Icon name="filter_list" className="text-lg" /></button>
          </div>
          <div className="grid gap-stack-gap md:grid-cols-2">
            {appeals.map((item) => (
              <article key={item.title} className="motion-card rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1 text-xs text-on-surface-variant"><Icon name="calendar_today" className="text-base" /> {item.date}</span>
                  <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${item.tone}`}>{item.status}</span>
                </div>
                <h4 className="text-lg font-bold text-on-surface">{item.title}</h4>
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-on-surface-variant">{item.text}</p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-surface-container-low px-2 py-1.5 text-xs text-on-surface-variant">
                  <Icon name="location_on" className="text-base" /> {item.address}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <BottomNav active="profile" />
      <Modal
        open={open}
        title="Нове звернення"
        sheet
        onClose={() => setOpen(false)}
        footer={<button className="h-14 w-full rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container active:scale-95">Надіслати звернення</button>}
      >
        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Категорія</label>
            <div className="flex flex-wrap gap-2">
              {["Інфраструктура", "Комунальні", "Екологія", "Транспорт"].map((label, index) => (
                <button key={label} className={`rounded-full border px-4 py-2 text-sm ${index === 0 ? "border-primary-container bg-primary-container text-on-primary" : "border-outline-variant text-on-surface-variant"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Фотографії</label>
            <button className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant">
              <Icon name="add_a_photo" className="text-4xl" /> Додати фото
            </button>
          </div>
          <div>
            <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Опис проблеми</label>
            <textarea className="min-h-32 w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm outline-none focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/30" placeholder="Опишіть проблему..." />
          </div>
        </div>
      </Modal>
    </Shell>
  );
}
