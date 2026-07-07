import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import { ApiError } from "../../lib/apiClient.js";
import Icon from "../../components/ui/Icon.jsx";

const initialForm = { username: "", firstName: "", lastName: "", email: "", password: "" };

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const canSubmit =
    form.username.trim().length >= 3 &&
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    !isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    setIsSubmitting(true);
    try {
      await register({
        username: form.username.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate("/assistant", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fields = [
    { key: "username", label: "Логін", autoComplete: "username", type: "text" },
    { key: "firstName", label: "Ім'я", autoComplete: "given-name", type: "text" },
    { key: "lastName", label: "Прізвище", autoComplete: "family-name", type: "text" },
    { key: "email", label: "Email", autoComplete: "email", type: "email" },
    { key: "password", label: "Пароль", autoComplete: "new-password", type: "password" },
  ];

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-container-padding py-section-margin">
      <div className="w-full max-w-sm rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-soft">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary">
            <Icon name="person_add" filled className="text-[28px]" />
          </span>
          <h1 className="text-xl font-bold text-on-surface">Створити акаунт</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Zhytomyr Assistant</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">{field.label}</span>
              <input
                autoComplete={field.autoComplete}
                className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 text-sm outline-none focus:border-secondary-container"
                type={field.type}
                value={form[field.key]}
                onChange={updateField(field.key)}
              />
            </label>
          ))}
          {error ? <p className="rounded-xl border border-error-container bg-error-container/30 p-3 text-sm text-error">{error}</p> : null}
          <button
            className="h-12 w-full rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container transition disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? "Створення акаунту..." : "Створити акаунт"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-on-surface-variant">
          Вже є акаунт? <Link className="font-bold text-on-tertiary-fixed-variant" to="/login">Увійти</Link>
        </p>
      </div>
    </div>
  );
}
