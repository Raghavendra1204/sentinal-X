import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setOperatorToken } from "../api/client";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  badge: string;
  avatar: string;
  token: string;
}

export const MOCK_USERS: MockUser[] = [
  {
    id: "OP-7701-ALPHA",
    name: "Alex Vance",
    email: "operator@sentinel-x.cyber",
    role: "Lead Security Engineer & Verifier",
    badge: "SOC-LEAD",
    avatar: "AV",
    token: "c0a80101-sentinel-operator-token-x-20261011",
  },
  {
    id: "AUD-4022-BETA",
    name: "Morgan Chase",
    email: "auditor@sentinel-x.cyber",
    role: "Compliance & Security Auditor",
    badge: "AUDITOR",
    avatar: "MC",
    token: "c0a80101-sentinel-operator-token-x-20261011",
  },
  {
    id: "IR-9910-GAMMA",
    name: "Sarah Connor",
    email: "responder@sentinel-x.cyber",
    role: "Incident Response Engineer",
    badge: "INCIDENT-LEAD",
    avatar: "SC",
    token: "c0a80101-sentinel-operator-token-x-20261011",
  },
];

interface AuthContextType {
  user: MockUser | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string, customToken?: string) => Promise<boolean>;
  logout: () => void;
  switchUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(() => {
    try {
      const stored = localStorage.getItem("sentinel_active_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setOperatorToken(parsed.token || "c0a80101-sentinel-operator-token-x-20261011");
        return parsed;
      }
    } catch {
      // fallback
    }
    return null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("sentinel_active_user", JSON.stringify(user));
      setOperatorToken(user.token);
    } else {
      localStorage.removeItem("sentinel_active_user");
    }
  }, [user]);

  const login = async (email: string, _password?: string, customToken?: string): Promise<boolean> => {
    const matched = MOCK_USERS.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || {
      id: `OP-${Math.floor(1000 + Math.random() * 9000)}-CUSTOM`,
      name: email.split("@")[0] || "Operator",
      email: email.trim(),
      role: "Security Operator",
      badge: "OPERATOR",
      avatar: (email[0] || "O").toUpperCase(),
      token: customToken || "c0a80101-sentinel-operator-token-x-20261011",
    };

    const finalToken = customToken || matched.token || "c0a80101-sentinel-operator-token-x-20261011";
    const loggedInUser: MockUser = { ...matched, token: finalToken };
    setUser(loggedInUser);
    setOperatorToken(finalToken);
    return true;
  };

  const logout = () => {
    setUser(null);
    setOperatorToken("");
    localStorage.removeItem("sentinel_active_user");
  };

  const switchUser = (userId: string) => {
    const target = MOCK_USERS.find(u => u.id === userId);
    if (target) {
      setUser(target);
      setOperatorToken(target.token);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
