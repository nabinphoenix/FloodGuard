import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getMe } from "../api/auth";
import LoadingSpinner from "./LoadingSpinner";

const TOKEN_KEY = "floodguard_token";

export default function ProtectedRoute({ children, role }) {
  const [state, setState] = useState({
    loading: true,
    user: null,
    unauthorized: false,
  });

  useEffect(() => {
    let ignore = false;
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setState({ loading: false, user: null, unauthorized: true });
      return undefined;
    }

    async function loadUser() {
      try {
        const user = await getMe();
        if (!ignore) {
          setState({ loading: false, user, unauthorized: false });
        }
      } catch {
        if (!ignore) {
          localStorage.removeItem(TOKEN_KEY);
          setState({ loading: false, user: null, unauthorized: true });
        }
      }
    }

    loadUser();

    return () => {
      ignore = true;
    };
  }, []);

  if (state.loading) {
    return <LoadingSpinner message="Checking access..." />;
  }

  if (state.unauthorized || !state.user) {
    return <Navigate to="/login" replace />;
  }

  if (role && state.user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}
