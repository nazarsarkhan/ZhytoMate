import Icon from "./Icon.jsx";

export default function SearchInput({ value, onChange, placeholder, dark = false }) {
  return (
    <label className={`flex h-12 items-center rounded-xl px-3 transition focus-within:ring-2 md:h-14 ${dark ? "bg-surface text-on-surface shadow-sm focus-within:ring-secondary-container" : "border border-surface-variant bg-surface-container-low focus-within:ring-primary-container"}`}>
      <Icon name="search" className={dark ? "text-on-primary-container" : "text-outline"} />
      <input
        className="ml-2 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
        placeholder={placeholder}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
