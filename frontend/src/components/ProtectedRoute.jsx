import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/roles";
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
    if (!canAccess(user.role, allowedRoles)) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
