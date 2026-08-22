import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getMe, login, logout } from "../api/auth";
import { VIEW_MODES } from "../utils/roles";

const TOKEN_KEY = "floodguard_token";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewAs, setViewAsState] = useState("admin");

  const setViewAs = useCallback((nextView) => {
    if (user?.role !== "admin" || !VIEW_MODES.includes(nextView)) return;
    setViewAsState(nextView);
  }, [user?.role]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      setViewAsState("admin");
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setUser(null);
      setViewAsState("admin");
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    try {
      const currentUser = await getMe();
      setUser(currentUser);
      return currentUser;
    } catch {
      logout();
      setUser(null);
      setViewAsState("admin");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const signIn = useCallback(async (email, password) => {
    await login(email, password);
    return refreshUser();
  }, [refreshUser]);

  const signOut = useCallback(() => {
    logout();
    setUser(null);
    setViewAsState("admin");
  }, []);

  const value = useMemo(() => ({
    user,
    realRole: user?.role,
    viewAs,
    isLoading,
    isAuthenticated: Boolean(user),
    refreshUser,
    signIn,
    signOut,
    setViewAs,
    setAuthenticatedUser: setUser,
  }), [isLoading, refreshUser, setViewAs, signIn, signOut, user, viewAs]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside an AuthProvider");
  return value;
}
