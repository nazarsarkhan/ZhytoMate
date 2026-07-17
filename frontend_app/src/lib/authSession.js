const sessionInvalidationListeners = new Set();

export function subscribeToSessionInvalidation(listener) {
  sessionInvalidationListeners.add(listener);
  return () => {
    sessionInvalidationListeners.delete(listener);
  };
}

export function performLogout({
  clearSession,
  redirect = true,
  redirectTo = "/login",
  currentPath = () => window.location.pathname,
  replaceLocation = (path) => window.location.replace(path),
} = {}) {
  clearSession?.();

  for (const listener of [...sessionInvalidationListeners]) {
    listener();
  }

  if (redirect && currentPath() !== redirectTo) {
    replaceLocation(redirectTo);
  }
}
