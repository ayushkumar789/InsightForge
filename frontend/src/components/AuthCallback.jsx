import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing under React StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login");
      return;
    }

    const session_id = match[1];
    axios
      .post(`${API}/auth/google`, { session_id }, { withCredentials: true })
      .then((res) => {
        login(res.data.user, res.data.session_token);
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        navigate("/login?error=oauth_failed", { replace: true });
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}
