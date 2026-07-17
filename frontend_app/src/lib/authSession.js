const sessionInvalidationListeners = new Set();
let sessionGeneration = 0;

export function getSessionGeneration() {
  return sessionGeneration;
}

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
  sessionGeneration += 1;
  clearSession?.();

  for (const listener of [...sessionInvalidationListeners]) {
    listener();
  }

  if (redirect && currentPath() !== redirectTo) {
    replaceLocation(redirectTo);
  }
}
