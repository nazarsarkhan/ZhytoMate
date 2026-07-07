import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import { useCurrentUser } from "../../hooks/useCurrentUser.js";

export default function RequireAdmin({ children }) {
  const { authenticated } = useAuth();
  const currentUser = useCurrentUser();
  const location = useLocation();

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (currentUser.isLoading) return null;

  if (currentUser.data?.role !== "admin") {
    return <Navigate to="/assistant" replace />;
  }

  return children;
}
