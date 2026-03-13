import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { BarChart2, Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
    const params = new URLSearchParams(location.search);
    if (params.get("error") === "oauth_failed") {
      toast.error("Google sign-in failed. Please try again.");
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, form, { withCredentials: true });
      login(res.data.user, res.data.session_token);
      toast.success(`Welcome back, ${res.data.user.name}!`);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="login-page">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <div className="h-8 w-8 rounded-lg gradient-indigo flex items-center justify-center">
            <BarChart2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>InsightForge</span>
        </Link>

        <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-1">Sign in</h1>
          <p className="text-sm text-muted-foreground mb-6">Enter your credentials to continue</p>

          {/* Google OAuth */}
          <Button
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={handleGoogleLogin}
            data-testid="google-login-btn"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="mt-1"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="mt-1"
                data-testid="login-password-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full gradient-indigo text-white"
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline font-medium" data-testid="signup-link">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
