import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/router";
import { authAPI } from "../lib/api";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initialize token from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        setToken(storedToken);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  // Verify token when it changes
  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const res = await authAPI.verify();
      setUser(res.user);
    } catch (err) {
      console.error("Token verification failed:", err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const res = await authAPI.login({ email, password });
      if (res.token) {
        localStorage.setItem("token", res.token);
        setToken(res.token);
        setUser(res.user);
        toast.success("Login successful!");

        // Redirect based on role
        if (res.user.role === "admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/search");
        }
        return res.user;
      }
    } catch (err) {
      const message = err.message || "Login failed";
      toast.error(message);
      throw err;
    }
  };

  const register = async (userData) => {
    try {
      const res = await authAPI.register(userData);
      toast.success("Registration successful! Please login.");
      router.push("/login");
      return res;
    } catch (err) {
      const message = err.message || "Registration failed";
      toast.error(message);
      throw err;
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const updateProfile = async (data) => {
    try {
      const res = await authAPI.updateProfile(data);
      setUser((prev) => ({ ...prev, ...res.user }));
      toast.success("Profile updated successfully!");
      return res;
    } catch (err) {
      const message = err.message || "Failed to update profile";
      toast.error(message);
      throw err;
    }
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    login,
    register,
    logout,
    updateProfile,
    refreshUser: verifyToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
