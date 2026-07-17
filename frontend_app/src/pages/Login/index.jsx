import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import { ApiError } from "../../lib/apiClient.js";
import Icon from "../../components/ui/Icon.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [login_, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = login_.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    setIsSubmitting(true);
    try {
      await login({ login: login_.trim(), password });
      navigate(location.state?.from?.pathname || "/assistant", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-container-padding py-section-margin">
      <div className="w-full max-w-sm rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-soft">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary">
            <Icon name="location_city" filled className="text-[28px]" />
          </span>
          <h1 className="text-xl font-bold text-on-surface">Увійти</h1>
          <p className="mt-1 text-sm text-on-surface-variant">ZhytoMate</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Email або логін</span>
            <input
              autoComplete="username"
              className="h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm outline-none focus:ring-0"
              placeholder="you@example.com"
              type="text"
              value={login_}
              onChange={(event) => setLogin(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Пароль</span>
            <input
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border-0 bg-surface px-4 text-sm outline-none focus:ring-0"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="rounded-xl border border-error-container bg-error-container/30 p-3 text-sm text-error">{error}</p> : null}
          <button
            className="h-12 w-full rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container transition disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? "Вхід..." : "Увійти"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-on-surface-variant">
          Немає акаунту? <Link className="font-bold text-on-tertiary-fixed-variant" to="/register">Створити акаунт</Link>
        </p>
      </div>
    </div>
  );
}
