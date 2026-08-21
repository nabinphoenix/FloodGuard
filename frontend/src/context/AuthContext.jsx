import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getMe, login, logout } from "../api/auth";

const TOKEN_KEY = "floodguard_token";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setUser(null);
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
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    refreshUser,
    signIn,
    signOut,
    setAuthenticatedUser: setUser,
  }), [isLoading, refreshUser, signIn, signOut, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside an AuthProvider");
  return value;
}
