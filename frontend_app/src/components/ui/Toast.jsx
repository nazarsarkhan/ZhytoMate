export default function Toast({ message }) {
  if (!message) return null;

  return (
    <div className="fixed inset-x-4 bottom-[calc(88px+var(--safe-bottom))] z-[120] mx-auto max-w-sm rounded-full bg-primary-container px-4 py-3 text-center text-sm font-bold text-on-primary shadow-header">
      {message}
    </div>
  );
}
