export default function Modal({ open, title, children, footer, onClose, sheet = false }) {
  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex ${sheet ? "items-end md:items-center" : "items-center"} justify-center px-4`}>
      <button aria-label="Закрити" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <section className={`relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden bg-surface-container-lowest shadow-xl ${sheet ? "rounded-t-3xl md:rounded-3xl" : "rounded-3xl"} border border-outline-variant/30`}>
        <header className="flex items-center justify-between border-b border-outline-variant/30 p-4">
          <h2 className="text-lg font-bold text-on-surface md:text-xl">{title}</h2>
          <button className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-surface-container active:scale-95" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="border-t border-outline-variant/30 p-4">{footer}</footer> : null}
      </section>
    </div>
  );
}
