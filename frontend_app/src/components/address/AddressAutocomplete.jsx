import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiClient.js";
import Icon from "../ui/Icon.jsx";

export function formatAddress(address = {}) {
  return [
    [address.building, address.street].filter(Boolean).join(", "),
    address.neighborhood,
    address.district,
    address.city,
  ]
    .filter(Boolean)
    .join(", ") || address.formatted || "";
}

export default function AddressAutocomplete({
  id = "address-search",
  value,
  selected,
  onChange,
  onSelect,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (selected || query.length < 3) {
      setSuggestions([]);
      setHasLoaded(false);
      setIsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await apiFetch(
          `/users/me/address/suggestions?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);
          setHasLoaded(true);
          setIsOpen(true);
        }
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          setSuggestions([]);
          setHasLoaded(true);
          setIsOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 1000);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [selected, value]);

  const handleChange = (event) => {
    onChange(event.target.value);
    onSelect(null);
    setIsOpen(true);
  };

  const handleSelect = (suggestion) => {
    onChange(suggestion.formatted);
    onSelect(suggestion);
    setSuggestions([]);
    setHasLoaded(false);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label className="mb-1 ml-1 block text-xs text-on-surface-variant" htmlFor={id}>
        Адреса
      </label>
      <div className="flex h-12 items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 focus-within:border-on-tertiary-fixed-variant focus-within:ring-2 focus-within:ring-on-tertiary-fixed-variant/20">
        <Icon name="location_on" className="shrink-0 text-lg text-outline" />
        <input
          id={id}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
          placeholder="Почніть вводити вулицю та номер будинку"
          type="text"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          value={value}
          onChange={handleChange}
          onFocus={() => !selected && value.trim().length >= 3 && setIsOpen(true)}
        />
        {isLoading ? <Icon name="progress_activity" className="animate-spin text-lg text-outline" /> : null}
      </div>

      {isOpen && !selected && value.trim().length >= 3 ? (
        <div className="relative z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest shadow-xl" role="listbox">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              className="flex w-full items-start gap-3 border-b border-outline-variant/30 p-3 text-left transition last:border-b-0 hover:bg-surface-container active:bg-surface-container-high"
              type="button"
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(suggestion)}
            >
              <Icon name="location_on" className="mt-0.5 shrink-0 text-lg text-primary" />
              <span className="min-w-0 text-sm leading-5 text-on-surface">{suggestion.formatted}</span>
            </button>
          ))}
          {isLoading ? <p className="p-3 text-sm text-on-surface-variant">Пошук адрес...</p> : null}
          {!isLoading && hasLoaded && suggestions.length === 0 ? (
            <p className="p-3 text-sm text-on-surface-variant">Адресу не знайдено. Уточніть вулицю та номер будинку.</p>
          ) : null}
          <p className="border-t border-outline-variant/30 p-2 text-[11px] text-on-surface-variant">Дані OpenStreetMap</p>
        </div>
      ) : null}

      <p className="mt-1.5 ml-1 text-xs text-on-surface-variant">
        Оберіть адресу зі списку — довільний текст зберегти не можна.
      </p>
    </div>
  );
}
