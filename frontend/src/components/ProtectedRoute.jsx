import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

export default function ProtectedRoute({ children, role }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner message="Checking access..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role) {
    const allowedRoles = Array.isArray(role) ? role : [role];
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
