import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import Icon from "../../components/ui/Icon.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import FilterChips from "../../components/ui/FilterChips.jsx";
import Modal from "../../components/overlay/Modal.jsx";
import { useAuth } from "../../hooks/useAuth.jsx";
import { AdminDataProvider, useAdminData } from "./AdminDataContext.jsx";

const sections = [
  { entity: "users", path: "users", label: "Юзери", singular: "юзера", icon: "group", searchable: ["firstName", "lastName", "username", "email", "phone", "role"], canCreate: false, canDelete: false },
  { entity: "surveys", path: "surveys", label: "Опитування", singular: "опитування", icon: "poll", searchable: ["title", "description", "category", "status"], canCreate: true, canDelete: true },
  { entity: "announcements", path: "announcements", label: "Анонси", singular: "анонс", icon: "campaign", searchable: ["title", "summary", "body", "category", "tags"], canCreate: false, canDelete: true },
  { entity: "news", path: "news", label: "Новини", singular: "новину", icon: "newspaper", searchable: ["title", "summary", "body", "category", "tags"], canCreate: false, canDelete: true },
  { entity: "appeals", path: "appeals", label: "Звернення", singular: "звернення", icon: "assignment", searchable: ["user", "category", "address", "description", "status"], canCreate: false, canDelete: false },
  { entity: "contacts", path: "contacts", label: "Контакти", singular: "контакт", icon: "contacts", searchable: ["name", "phone", "group", "kind"], canCreate: true, canDelete: true },
  { entity: "places", path: "places", label: "Місця", singular: "місце", icon: "place", searchable: ["name", "address", "phone", "category", "source"], canCreate: false, canDelete: true },
  { entity: "settings", path: "settings", label: "Налаштування", singular: "налаштування", icon: "settings", searchable: ["title", "cityHotline"], canCreate: false, canDelete: false },
];

const sectionByEntity = Object.fromEntries(sections.map((section) => [section.entity, section]));
const dateFieldNames = new Set(["startsAt", "endsAt", "publishAt", "date", "createdAt", "publishedAt", "expiresAt", "eventDate"]);

const statusTone = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-surface-container-high text-on-surface-variant",
  blocked: "bg-error-container text-error",
  draft: "bg-surface-container-high text-on-surface-variant",
  published: "bg-green-100 text-green-700",
  review: "bg-primary-fixed text-on-primary-fixed",
  new: "bg-secondary-container text-on-secondary-container",
  in_progress: "bg-primary-fixed text-on-primary-fixed",
  resolved: "bg-green-100 text-green-700",
  rejected: "bg-error-container text-error",
  high: "bg-error-container text-error",
  medium: "bg-secondary-container text-on-secondary-container",
  low: "bg-surface-container-high text-on-surface-variant",
  admin: "bg-primary-container text-on-primary",
  user: "bg-surface-container-high text-on-surface-variant",
  emergency: "bg-error-container text-error",
  utility: "bg-surface-container-high text-on-surface-variant",
};

const statusLabel = {
  active: "Активне",
  inactive: "Неактивне",
  blocked: "Заблокований",
  draft: "Чернетка",
  published: "Опубліковано",
  review: "На перевірці",
  new: "Нове",
  in_progress: "В роботі",
  resolved: "Вирішено",
  rejected: "Відхилено",
  high: "Високий",
  medium: "Середній",
  low: "Низький",
  admin: "Адмін",
  user: "Юзер",
  emergency: "Екстрена",
  utility: "Служба",
};

const fieldsByEntity = {
  users: [
    ["firstName", "Ім'я"],
    ["lastName", "Прізвище"],
    ["username", "Логін"],
    ["email", "Email"],
    ["phone", "Телефон"],
    ["role", "Роль", "select", ["user", "admin"]],
    ["status", "Статус", "select", ["active", "blocked"]],
  ],
  surveys: [
    ["title", "Назва"],
    ["description", "Опис", "textarea"],
    ["category", "Категорія"],
    ["status", "Статус", "select", ["draft", "active", "published"]],
    ["startsAt", "Початок"],
    ["endsAt", "Кінець"],
  ],
  announcements: [
    ["title", "Назва"],
    ["summary", "Короткий опис", "textarea"],
    ["body", "Текст", "textarea"],
    ["category", "Категорія"],
    ["importance", "Пріоритет", "number"],
    ["publishedAt", "Дата публікації"],
    ["expiresAt", "Показувати до"],
    ["tags", "Теги"],
  ],
  news: [
    ["title", "Назва"],
    ["summary", "Короткий опис", "textarea"],
    ["body", "Текст", "textarea"],
    ["category", "Категорія"],
    ["importance", "Пріоритет", "number"],
    ["publishedAt", "Дата публікації"],
    ["expiresAt", "Показувати до"],
    ["tags", "Теги"],
  ],
  appeals: [
    ["status", "Статус", "select", ["new", "in_progress", "resolved", "rejected"]],
    ["response", "Відповідь мешканцю", "textarea"],
  ],
  contacts: [
    ["name", "Назва"],
    ["phone", "Телефон"],
    ["icon", "Іконка"],
    ["group", "Група"],
    ["kind", "Тип", "select", ["emergency", "utility"]],
    ["order", "Порядок", "number"],
    ["status", "Статус", "select", ["active", "inactive"]],
  ],
  places: [
    ["name", "Назва"],
    ["address", "Адреса"],
    ["phone", "Телефон"],
    ["openingHours", "Години роботи"],
    ["category", "Категорія", "select", ["food", "shopping", "health", "services", "education", "government", "culture", "transport", "other"]],
  ],
  settings: [["cityHotline", "Гаряча лінія міськради"]],
};

function toDateInputValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function normalizeSurveyForForm(item) {
  if (!item) return null;
  return {
    ...item,
    options: item.options?.length
      ? item.options.map((option, index) => ({ ...option, id: option.id || `opt-${index + 1}` }))
      : [{ id: "opt-1", label: "Так", votes: 0, percent: 0 }, { id: "opt-2", label: "Ні", votes: 0, percent: 0 }],
  };
}

function emptyItem(entity) {
  const today = new Date().toISOString().slice(0, 10);
  const defaults = {
    users: { firstName: "", lastName: "", username: "", email: "", phone: "", role: "user", status: "active" },
    surveys: {
      title: "",
      description: "",
      category: "",
      status: "draft",
      startsAt: today,
      endsAt: "",
      totalVotes: 0,
      options: [{ id: "opt-1", label: "Так", votes: 0, percent: 0 }, { id: "opt-2", label: "Ні", votes: 0, percent: 0 }],
    },
    announcements: { title: "", summary: "", body: "", category: "", importance: 3, publishedAt: today, expiresAt: "", tags: "" },
    news: { title: "", summary: "", body: "", category: "", importance: 3, publishedAt: today, expiresAt: "", tags: "" },
    appeals: { status: "new", response: "" },
    contacts: { name: "", phone: "", icon: "call", group: "", kind: "utility", order: 0, status: "active" },
    places: { name: "", address: "", phone: "", openingHours: "", category: "other" },
    settings: { cityHotline: "" },
  };
  return defaults[entity];
}

function normalizeItemForForm(entity, item) {
  let base = entity === "surveys" ? normalizeSurveyForForm(item) : item ? { ...item } : emptyItem(entity);
  if (entity === "news" || entity === "announcements") {
    base = { ...base, tags: Array.isArray(base.tags) ? base.tags.join(", ") : base.tags || "" };
  }
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, dateFieldNames.has(key) ? toDateInputValue(value) : value]),
  );
}

function normalizeFormForSave(entity, form, options = {}) {
  if (entity === "users") {
    return {
      username: form.username,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || "",
      role: form.role,
      isActive: form.status !== "blocked",
    };
  }

  if (entity === "contacts") {
    return {
      name: form.name,
      phone: form.phone,
      icon: form.icon || "call",
      group: form.group || "",
      kind: form.kind || "utility",
      order: Number(form.order || 0),
      isActive: form.status !== "inactive",
    };
  }

  if (entity === "news" || entity === "announcements") {
    return {
      title: form.title,
      summary: form.summary || "",
      body: form.body || "",
      category: form.category || "",
      importance: Number(form.importance || 3),
      publishedAt: form.publishedAt || null,
      expiresAt: form.expiresAt || null,
      tags: String(form.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
  }

  if (entity === "settings") {
    return { cityHotline: form.cityHotline || "" };
  }

  if (entity !== "surveys") return form;

  const surveyOptions = (form.options || [])
    .map((option, index) => ({
      id: option.id || `opt-${Date.now().toString(36)}-${index}`,
      label: option.label.trim(),
      votes: Number(option.votes || 0),
      percent: Number(option.percent || 0),
    }))
    .filter((option) => option.label);
  const { options: _options, ...rest } = form;
  if (options.requireValid && surveyOptions.length < 2) return null;
  return { ...rest, totalVotes: Number(rest.totalVotes || 0), options: surveyOptions };
}

function Badge({ value }) {
  return <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold ${statusTone[value] || "bg-surface-container-high text-on-surface-variant"}`}>{statusLabel[value] || value}</span>;
}

function AdminSelectField({ ariaLabel, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const selectedLabel = statusLabel[value] || value || "Оберіть";

  return (
    <div className="relative">
      <button
        aria-label={ariaLabel}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-surface px-3 text-left text-sm outline-none transition"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selectedLabel}</span>
        <Icon name={open ? "expand_less" : "expand_more"} className="text-xl text-on-surface-variant" />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-[120] overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-1 shadow-xl">
          {options.map((option) => {
            const active = option === value;
            return (
              <button
                key={option}
                className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface hover:bg-surface-container"}`}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span>{statusLabel[option] || option}</span>
                {active ? <Icon name="check" className="text-lg" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AdminDateField({ ariaLabel, value, onChange }) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3 transition">
      <Icon name="calendar_today" className="text-lg text-on-surface-variant" />
      <input
        aria-label={ariaLabel}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
        type="date"
        value={toDateInputValue(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Підтвердити",
  cancelLabel = "Скасувати",
  tone = "danger",
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={(
        <div className="flex gap-3">
          <button className="h-12 flex-1 rounded-full border border-outline-variant text-sm font-bold text-on-surface" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`h-12 flex-1 rounded-full text-sm font-bold ${tone === "danger" ? "bg-error-container text-error" : "bg-secondary-container text-on-secondary-container"}`} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      )}
    >
      <p className="text-sm leading-6 text-on-surface-variant">{description}</p>
    </Modal>
  );
}

function AdminMenuLinks({ onNavigate }) {
  return (
    <nav className="space-y-1.5">
      {sections.map((section) => (
        <NavLink
          key={section.entity}
          to={`/admin/${section.path}`}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${isActive ? "bg-secondary-container text-on-secondary-container" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
          onClick={onNavigate}
        >
          <Icon name={section.icon} filled />
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}

function AdminActions({ onLogoutClick, onNavigate }) {
  return (
    <div className="space-y-1.5 border-t border-white/10 pt-4">
      <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white" to="/assistant" onClick={onNavigate}>
        <Icon name="arrow_back" className="text-[22px]" /> До застосунку
      </Link>
      <Link className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white" to="/profile" onClick={onNavigate}>
        <Icon name="person" className="text-[22px]" /> Профіль
      </Link>
      <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white" type="button" onClick={onLogoutClick}>
        <Icon name="logout" className="text-[22px]" /> Вийти з акаунту
      </button>
    </div>
  );
}

function AdminDrawer({ open, onClose, onLogoutClick }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] lg:hidden">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" type="button" aria-label="Закрити меню" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-72 max-w-[86vw] flex-col bg-primary-container p-5 text-on-primary shadow-xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/assistant" className="flex min-w-0 items-center gap-3" onClick={onClose}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
              <Icon name="location_city" filled />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">Zhytomate</span>
              <span className="block truncate text-xs text-white/60">Адмін панель</span>
            </span>
          </Link>
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10" type="button" aria-label="Закрити меню" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AdminMenuLinks onNavigate={onClose} />
        </div>
        <AdminActions onNavigate={onClose} onLogoutClick={onLogoutClick} />
      </aside>
    </div>
  );
}

function AdminShell({ children }) {
  const { logout } = useAuth();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const confirmLogout = () => {
    setLogoutConfirmOpen(false);
    logout();
  };

  return (
    <div className="phone-shell min-h-dvh overflow-hidden bg-background md:min-h-[calc(100dvh-32px)]">
      <div className="flex min-h-dvh bg-surface-container-lowest md:min-h-[calc(100dvh-32px)]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-outline-variant/30 bg-primary-container p-5 text-on-primary lg:flex">
          <Link to="/assistant" className="mb-8 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary">
              <Icon name="location_city" filled />
            </span>
            <span>
              <span className="block text-sm font-bold">Zhytomate</span>
              <span className="block text-xs text-white/60">Адмін панель</span>
            </span>
          </Link>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AdminMenuLinks />
          </div>
          <AdminActions onLogoutClick={() => setLogoutConfirmOpen(true)} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <ConfirmModal
        open={logoutConfirmOpen}
        title="Вийти з акаунту?"
        description="Після виходу потрібно буде знову авторизуватися, щоб повернутися в адмінку."
        confirmLabel="Вийти"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}

function AdminHeader({ section, onCreate }) {
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const confirmLogout = () => {
    setLogoutConfirmOpen(false);
    logout();
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-outline-variant/30 bg-surface-container-lowest/95 px-container-padding py-4 backdrop-blur sm:px-6 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface lg:hidden" type="button" aria-label="Відкрити меню" onClick={() => setMenuOpen(true)}>
              <Icon name="menu" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-on-surface-variant">Адмін панель</p>
              <h1 className="truncate text-2xl font-bold text-on-surface">{section.label}</h1>
            </div>
          </div>
          {section.canCreate ? (
            <button className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary-container text-on-secondary-container active:scale-[0.98] sm:w-auto sm:px-4" type="button" aria-label={`Додати ${section.singular}`} onClick={onCreate}>
              <Icon name="add" className="text-lg" />
              <span className="hidden text-sm font-bold sm:inline">Додати</span>
            </button>
          ) : null}
        </div>
      </header>
      <AdminDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onLogoutClick={() => setLogoutConfirmOpen(true)} />
      <ConfirmModal
        open={logoutConfirmOpen}
        title="Вийти з акаунту?"
        description="Після виходу потрібно буде знову авторизуватися, щоб повернутися в адмінку."
        confirmLabel="Вийти"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
}

function LoadingBlock({ children = "Завантаження..." }) {
  return <p className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant shadow-soft">{children}</p>;
}

function ErrorBlock({ message, backTo }) {
  return (
    <div className="rounded-2xl border border-error-container bg-error-container/20 p-6 text-center shadow-soft">
      <p className="text-sm font-bold text-error">{message}</p>
      {backTo ? <Link className="mt-4 inline-flex rounded-full bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container" to={backTo}>Назад до списку</Link> : null}
    </div>
  );
}

function AdminEditorModal({ entity, item, open, onClose }) {
  const { createItem, updateItem } = useAdminData();
  const [form, setForm] = useState(() => normalizeItemForForm(entity, item));
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const nextForm = normalizeItemForForm(entity, item);
      setForm(nextForm);
      setInitialSnapshot(JSON.stringify(nextForm));
      setCloseConfirmOpen(false);
      setFormError("");
      setSaving(false);
    }
  }, [entity, item, open]);

  const fields = fieldsByEntity[entity] || [];
  const section = sectionByEntity[entity];

  const save = async () => {
    const payload = normalizeFormForSave(entity, form, { requireValid: true });
    if (!payload) {
      setFormError("Додайте мінімум 2 заповнені варіанти відповіді.");
      return;
    }

    try {
      setSaving(true);
      if (item?.id) await updateItem(entity, item.id, payload);
      else await createItem(entity, payload);
      onClose();
    } catch (error) {
      setFormError(error.message || "Не вдалося зберегти зміни.");
    } finally {
      setSaving(false);
    }
  };

  const updateSurveyOption = (optionId, label) => {
    setForm((current) => ({
      ...current,
      options: (current.options || []).map((option) => (option.id === optionId ? { ...option, label } : option)),
    }));
    setFormError("");
  };

  const addSurveyOption = () => {
    setForm((current) => ({
      ...current,
      options: [...(current.options || []), { id: `opt-${Date.now().toString(36)}`, label: "", votes: 0, percent: 0 }],
    }));
    setFormError("");
  };

  const removeSurveyOption = (optionId) => {
    setForm((current) => {
      const options = current.options || [];
      if (options.length <= 2) return current;
      return { ...current, options: options.filter((option) => option.id !== optionId) };
    });
    setFormError("");
  };

  const requestClose = () => {
    if (JSON.stringify(form) !== initialSnapshot) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        title={item?.id ? `Редагувати ${section.singular}` : `Додати ${section.singular}`}
        sheet
        onClose={requestClose}
        footer={(
          <div className="flex gap-3">
            <button className="h-12 flex-1 rounded-full border border-outline-variant text-sm font-bold text-on-surface" type="button" onClick={requestClose}>
              Скасувати
            </button>
            <button className="h-12 flex-1 rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container disabled:opacity-60" type="button" disabled={saving} onClick={save}>
              {saving ? "Збереження..." : "Зберегти"}
            </button>
          </div>
        )}
      >
        <div className="space-y-3">
          {formError ? <p className="rounded-xl border border-error-container bg-error-container/30 p-3 text-sm font-bold text-error">{formError}</p> : null}
          {fields.map(([name, label, type, options]) => (
            <label key={name} className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase text-on-surface-variant">{label}</span>
              {type === "textarea" ? (
                <textarea aria-label={label} className="min-h-24 w-full rounded-xl border-0 bg-surface px-3 py-2 text-sm outline-none focus:ring-0" value={form[name] || ""} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} />
              ) : type === "select" ? (
                <AdminSelectField ariaLabel={label} value={form[name] || options[0]} options={options} onChange={(nextValue) => setForm((current) => ({ ...current, [name]: nextValue }))} />
              ) : dateFieldNames.has(name) ? (
                <AdminDateField ariaLabel={label} value={form[name] || ""} onChange={(nextValue) => setForm((current) => ({ ...current, [name]: nextValue }))} />
              ) : (
                <input aria-label={label} className="h-11 w-full rounded-xl border-0 bg-surface px-3 text-sm outline-none focus:ring-0" type={type === "number" ? "number" : "text"} value={form[name] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))} />
              )}
            </label>
          ))}
          {entity === "surveys" ? (
            <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Варіанти відповіді</h3>
                  <p className="mt-1 text-xs text-on-surface-variant">Мінімум 2 варіанти. Порядок збережеться як у формі.</p>
                </div>
                <button className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-secondary-container px-3 text-xs font-bold text-on-secondary-container" type="button" onClick={addSurveyOption}>
                  <Icon name="add_circle" className="text-base" /> Додати
                </button>
              </div>
              <div className="space-y-2">
                {(form.options || []).map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed/50 text-xs font-bold text-primary-container">{index + 1}</span>
                    <input
                      className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-on-surface outline-none placeholder:text-on-surface-variant"
                      placeholder={`Варіант ${index + 1}`}
                      value={option.label}
                      onChange={(event) => updateSurveyOption(option.id, event.target.value)}
                    />
                    <button
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-error transition hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-30"
                      disabled={(form.options || []).length <= 2}
                      type="button"
                      aria-label="Видалити варіант"
                      onClick={() => removeSurveyOption(option.id)}
                    >
                      <Icon name="delete" className="text-lg" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </Modal>
      <ConfirmModal
        open={closeConfirmOpen}
        title="Закрити без збереження?"
        description="Зміни в цій формі не будуть збережені."
        confirmLabel="Закрити"
        cancelLabel="Продовжити редагування"
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirm={onClose}
      />
    </>
  );
}

function itemTitle(entity, item) {
  if (entity === "users") return `${item.firstName} ${item.lastName}`.trim() || item.username;
  if (entity === "appeals") return `${item.category}: ${item.address}`;
  if (entity === "contacts") return item.name;
  if (entity === "settings") return item.title;
  return item.title;
}

function itemSubtitle(entity, item) {
  if (entity === "users") return item.email;
  if (entity === "surveys") return item.description;
  if (entity === "announcements" || entity === "news") return item.summary || item.body;
  if (entity === "contacts") return [item.phone, item.group].filter(Boolean).join(" · ");
  if (entity === "settings") return item.cityHotline || "Номер ще не вказано.";
  return item.description;
}

function filterValue(entity, item) {
  if (entity === "users") return item.role;
  if (entity === "contacts") return item.kind;
  if (entity === "announcements" || entity === "news") return item.importance >= 5 ? "high" : item.importance >= 4 ? "medium" : "low";
  return item.status || item.priority || null;
}

function AdminListPage({ entity }) {
  const section = sectionByEntity[entity];
  const { data, meta, removeItem } = useAdminData();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [actionError, setActionError] = useState("");

  const state = meta[entity] || { isLoading: false, error: null };
  const items = Array.isArray(data[entity]) ? data[entity] : [];

  const filterItems = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => filterValue(entity, item)).filter(Boolean)));
    return [{ value: "all", label: "Усі" }, ...values.map((value) => ({ value, label: statusLabel[value] || value }))];
  }, [entity, items]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !normalized || section.searchable.some((key) => String(item[key] || "").toLowerCase().includes(normalized));
      const matchesFilter = !filters.length || filters.includes(filterValue(entity, item));
      return matchesQuery && matchesFilter;
    });
  }, [entity, filters, items, query, section.searchable]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await removeItem(entity, pendingDelete.id);
      setPendingDelete(null);
      setActionError("");
    } catch (error) {
      setActionError(error.message || "Не вдалося видалити запис.");
      setPendingDelete(null);
    }
  };

  return (
    <AdminShell>
      <AdminHeader section={section} onCreate={() => setEditorOpen(true)} />
      <main className="space-y-5 px-container-padding py-section-margin sm:px-6 md:px-8">
        {actionError ? <ErrorBlock message={actionError} /> : null}
        <section className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <SearchInput value={query} onChange={setQuery} placeholder={`Пошук: ${section.label.toLowerCase()}`} />
          <FilterChips items={filterItems} selectedValues={filters} onChange={setFilters} />
        </section>
        {state.error && !items.length ? <ErrorBlock message={state.error.message || "Не вдалося завантажити розділ."} /> : null}
        {state.isLoading && !items.length ? <LoadingBlock /> : null}
        {!state.error && !state.isLoading ? (
          <section className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-soft">
            <div className="hidden grid-cols-[1.4fr_1fr_160px_120px] gap-4 border-b border-outline-variant/30 px-4 py-3 text-xs font-bold uppercase text-on-surface-variant md:grid">
              <span>Назва</span>
              <span>Деталі</span>
              <span>Статус</span>
              <span>Дії</span>
            </div>
            <div className="divide-y divide-outline-variant/20">
              {filteredItems.map((item) => (
                <article key={item.id} className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_160px_120px] md:items-center">
                  <Link className="min-w-0" to={`/admin/${section.path}/${item.id}`}>
                    <h2 className="truncate text-base font-bold text-on-surface">{itemTitle(entity, item)}</h2>
                    <p className="mt-1 text-xs text-on-surface-variant">{item.id}</p>
                  </Link>
                  <p className="line-clamp-2 text-sm text-on-surface-variant">{itemSubtitle(entity, item)}</p>
                  {filterValue(entity, item) ? <Badge value={filterValue(entity, item)} /> : <span className="text-sm text-on-surface-variant">—</span>}
                  <div className="flex gap-2">
                    <Link className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant" to={`/admin/${section.path}/${item.id}`} aria-label="Відкрити">
                      <Icon name="visibility" className="text-lg" />
                    </Link>
                    {section.canDelete ? (
                      <button className="flex h-9 w-9 items-center justify-center rounded-full bg-error-container text-error" type="button" aria-label="Видалити" onClick={() => setPendingDelete(item)}>
                        <Icon name="delete" className="text-lg" />
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {!filteredItems.length ? <p className="p-6 text-center text-sm text-on-surface-variant">{query.trim() || filters.length ? "Нічого не знайдено" : "Записів ще немає."}</p> : null}
            </div>
          </section>
        ) : null}
      </main>
      <AdminEditorModal entity={entity} open={editorOpen} onClose={() => setEditorOpen(false)} />
      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Видалити запис?"
        description={pendingDelete ? `Запис "${itemTitle(entity, pendingDelete)}" буде видалено.` : ""}
        confirmLabel="Видалити"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </AdminShell>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-3">
      <p className="text-xs font-bold uppercase text-on-surface-variant">{label}</p>
      <div className="mt-1 text-sm font-semibold text-on-surface">{children || "—"}</div>
    </div>
  );
}

function SurveyOptions({ item }) {
  if (!item.options?.length) return null;
  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-soft">
      <h2 className="mb-3 text-lg font-bold">Варіанти</h2>
      <div className="space-y-3">
        {item.options.map((option) => (
          <div key={option.id} className="rounded-xl border border-outline-variant/30 p-3">
            <div className="mb-2 flex justify-between gap-3 text-sm font-bold">
              <span>{option.label}</span>
              <span>{option.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full rounded-full bg-secondary-container" style={{ width: `${option.percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-on-surface-variant">{option.votes} голосів</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminDetailPage({ entity }) {
  const section = sectionByEntity[entity];
  const { id } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { data, meta, removeItem } = useAdminData();
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  const state = meta[entity] || { isLoading: false, error: null };
  const item = (Array.isArray(data[entity]) ? data[entity] : []).find((entry) => entry.id === id);

  const confirmLogout = () => {
    setLogoutConfirmOpen(false);
    logout();
  };

  const handleDelete = async () => {
    try {
      await removeItem(entity, id);
      setDeleteConfirmOpen(false);
      navigate(`/admin/${section.path}`, { replace: true });
    } catch (error) {
      setActionError(error.message || "Не вдалося видалити запис.");
      setDeleteConfirmOpen(false);
    }
  };

  if (state.error && !item) {
    return (
      <AdminShell>
        <main className="px-container-padding py-section-margin sm:px-6 md:px-8">
          <ErrorBlock message={state.error.message || "Не вдалося завантажити розділ."} backTo={`/admin/${section.path}`} />
        </main>
      </AdminShell>
    );
  }

  if (state.isLoading && !item) {
    return (
      <AdminShell>
        <main className="px-container-padding py-section-margin sm:px-6 md:px-8">
          <LoadingBlock />
        </main>
      </AdminShell>
    );
  }

  if (!item) {
    return (
      <AdminShell>
        <main className="px-container-padding py-section-margin sm:px-6 md:px-8">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-soft">
            <h1 className="text-xl font-bold">Запис не знайдено</h1>
            <Link className="mt-4 inline-flex rounded-full bg-secondary-container px-4 py-2 text-sm font-bold text-on-secondary-container" to={`/admin/${section.path}`}>Назад до списку</Link>
          </div>
        </main>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <header className="sticky top-0 z-30 border-b border-outline-variant/30 bg-surface-container-lowest/95 px-container-padding py-4 backdrop-blur sm:px-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface lg:hidden" type="button" aria-label="Відкрити меню" onClick={() => setMenuOpen(true)}>
              <Icon name="menu" />
            </button>
            <div className="min-w-0">
              <Link className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-on-tertiary-fixed-variant" to={`/admin/${section.path}`}>
                <Icon name="arrow_back" className="text-base" /> Назад
              </Link>
              <h1 className="truncate text-2xl font-bold text-on-surface">{itemTitle(entity, item)}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex h-10 items-center gap-2 rounded-full bg-surface-container px-4 text-sm font-bold text-on-surface" type="button" onClick={() => setEditorOpen(true)}>
              <Icon name="edit" className="text-lg" /> {entity === "appeals" ? "Відповісти" : "Редагувати"}
            </button>
            {section.canDelete ? (
              <button className="flex h-10 items-center gap-2 rounded-full bg-error-container px-4 text-sm font-bold text-error" type="button" onClick={() => setDeleteConfirmOpen(true)}>
                <Icon name="delete" className="text-lg" /> Видалити
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <main className="grid gap-5 px-container-padding py-section-margin sm:px-6 md:px-8 xl:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-soft">
          {actionError ? <p className="mb-5 rounded-xl border border-error-container bg-error-container/20 p-3 text-sm font-bold text-error">{actionError}</p> : null}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {filterValue(entity, item) ? <Badge value={filterValue(entity, item)} /> : null}
            <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-bold text-on-surface-variant">{item.id}</span>
          </div>
          <p className="whitespace-pre-line text-base leading-7 text-on-surface-variant">{itemSubtitle(entity, item)}</p>
          {entity === "surveys" ? <div className="mt-5"><SurveyOptions item={item} /></div> : null}
          {entity === "appeals" ? (
            <div className="mt-5 flex h-48 items-center justify-center rounded-2xl border border-dashed border-outline-variant bg-surface-container text-sm font-bold text-on-surface-variant">
              Фото звернення
            </div>
          ) : null}
        </section>
        <aside className="space-y-3">
          {Object.entries(item)
            .filter(([key]) => !["body", "description", "options"].includes(key))
            .map(([key, value]) => (
              <DetailRow key={key} label={key}>
                {Array.isArray(value) ? value.join(", ") : key === "status" || key === "role" || key === "priority" ? <Badge value={value} /> : String(value || "")}
              </DetailRow>
            ))}
        </aside>
      </main>
      <AdminDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onLogoutClick={() => setLogoutConfirmOpen(true)} />
      <AdminEditorModal entity={entity} item={item} open={editorOpen} onClose={() => setEditorOpen(false)} />
      <ConfirmModal
        open={deleteConfirmOpen}
        title="Видалити запис?"
        description={`Запис "${itemTitle(entity, item)}" буде видалено.`}
        confirmLabel="Видалити"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
      <ConfirmModal
        open={logoutConfirmOpen}
        title="Вийти з акаунту?"
        description="Після виходу потрібно буде знову авторизуватися, щоб повернутися в адмінку."
        confirmLabel="Вийти"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
      />
    </AdminShell>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/users" replace />} />
      {sections.map((section) => (
        <Route key={section.entity} path={`${section.path}`} element={<AdminListPage entity={section.entity} />} />
      ))}
      {sections.map((section) => (
        <Route key={`${section.entity}-detail`} path={`${section.path}/:id`} element={<AdminDetailPage entity={section.entity} />} />
      ))}
      <Route path="*" element={<Navigate to="/admin/users" replace />} />
    </Routes>
  );
}

export default function AdminApp() {
  return (
    <AdminDataProvider>
      <AdminRoutes />
    </AdminDataProvider>
  );
}
