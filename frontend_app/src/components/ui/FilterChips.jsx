export default function FilterChips({ items, selectedValues = [], onChange, allValue = "all", dark = false }) {
  const selectedSet = new Set(selectedValues);

  const toggle = (nextValue) => {
    if (nextValue === allValue) {
      onChange([]);
      return;
    }

    const next = new Set(selectedValues);
    if (next.has(nextValue)) next.delete(nextValue);
    else next.add(nextValue);
    next.delete(allValue);
    onChange([...next]);
  };

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = item.value === allValue ? selectedValues.length === 0 : selectedSet.has(item.value);
        return (
          <button
            key={item.value}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition active:scale-95 ${active ? "border-secondary-container bg-secondary-container text-on-secondary-container" : dark ? "border-white/20 bg-white/10 text-on-primary" : "border-surface-variant bg-surface-container text-on-surface-variant"}`}
            type="button"
            onClick={() => toggle(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
