export const APP_ROUTE_ALLOWLIST = new Set([
  "/services",
  "/services/contacts",
  "/services/polls",
  "/services/appeals",
  "/services/transport",
  "/services/outages",
  "/places",
  "/news",
  "/notifications",
  "/profile",
  "/chat-history",
]);

export function isValidAppRoute(route) {
  return typeof route === "string"
    && APP_ROUTE_ALLOWLIST.has(route)
    && !route.startsWith("/admin")
    && !/[\\\r\n\t]/.test(route);
}
