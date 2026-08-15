import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchApi, setAuthToken } from "../lib/api";

type User = {
  id: number;
  name: string;
  mobile: string;
  theme_preference: string;
  language_preference: string;
  role?: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  needsSetup: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  checkStatus: () => Promise<void>;
  isSessionUnlocked: boolean;
  unlockSession: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionUnlocked, setIsSessionUnlocked] = useState(
    () => sessionStorage.getItem("hk_unlocked") === "true"
  );

  const checkStatus = async () => {
    try {
      setIsLoading(true);
      const data = await fetchApi("/auth/status");
      
      setNeedsSetup(data.needsSetup);
      
      if (data.isAuthenticated && data.user) {
        setIsAuthenticated(true);
        setUser({ ...data.user, role: data.user.role || "admin" });
      } else {
        setIsAuthenticated(false);
        setUser(null);
        if (!data.needsSetup) {
          setAuthToken(null);
          setToken(null);
        }
      }
    } catch (err) {
      console.error("Auth status error", err);
      setAuthToken(null);
      setToken(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    // Persist the mobile so this device can sign in with PIN only on the next visit
    window.localStorage.setItem("hk_mobile", newUser.mobile);
    setAuthToken(newToken);
    setToken(newToken);
    setUser({ ...newUser, role: newUser.role || "admin" });
    setIsAuthenticated(true);
  };

  const logout = () => {
    setAuthToken(null);
    sessionStorage.removeItem("hk_unlocked");
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setIsSessionUnlocked(false);
  };

  const unlockSession = () => {
    sessionStorage.setItem("hk_unlocked", "true");
    setIsSessionUnlocked(true);
  };

  const isAdmin = !user?.role || user.role === "admin";

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, needsSetup, isLoading, isAdmin, login, logout, checkStatus, isSessionUnlocked, unlockSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
