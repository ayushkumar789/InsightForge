import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Loader2, User, Key, Shield } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Settings() {
  const { user, checkAuth } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const initials = (user?.name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    try {
      await axios.put(`${API}/auth/profile`, { name }, { withCredentials: true });
      await checkAuth();
      toast.success("Profile updated");
    } catch { toast.error("Failed to update"); }
    finally { setSavingName(false); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (pwForm.new_password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSavingPw(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      }, { withCredentials: true });
      toast.success("Password changed");
      setPwForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to change password");
    } finally { setSavingPw(false); }
  };

  return (
    <Layout>
      <div className="p-6 w-full max-w-4xl mx-auto" data-testid="settings-page">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Settings</h1>

        {/* Profile */}
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </h2>
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <div className="flex items-center gap-4 mb-5">
              <Avatar className="h-14 w-14">
                <AvatarImage src={user?.picture} />
                <AvatarFallback className="gradient-indigo text-white text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {user?.auth_provider === "google" ? "Google Account" : "Email/Password"}
                </p>
              </div>
            </div>
            <Separator className="mb-5" />
            <form onSubmit={saveName} className="space-y-3">
              <div>
                <Label>Display name</Label>
                <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} data-testid="name-input" />
              </div>
              <div>
                <Label>Email</Label>
                <Input className="mt-1" value={user?.email || ""} disabled />
              </div>
              <Button type="submit" size="sm" className="gradient-indigo text-white" disabled={savingName} data-testid="save-profile-btn">
                {savingName ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save changes
              </Button>
            </form>
          </div>
        </section>

        {/* Password */}
        {user?.auth_provider !== "google" && (
          <section>
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Key className="h-4 w-4" /> Change Password
            </h2>
            <div className="p-5 rounded-xl bg-card border border-border/50">
              <form onSubmit={savePassword} className="space-y-3">
                <div>
                  <Label>Current password</Label>
                  <Input className="mt-1" type="password" value={pwForm.current_password}
                    onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} data-testid="current-password-input" />
                </div>
                <div>
                  <Label>New password</Label>
                  <Input className="mt-1" type="password" value={pwForm.new_password}
                    onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} data-testid="new-password-input" />
                </div>
                <div>
                  <Label>Confirm new password</Label>
                  <Input className="mt-1" type="password" value={pwForm.confirm}
                    onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} data-testid="confirm-password-input" />
                </div>
                <Button type="submit" size="sm" variant="outline" disabled={savingPw} data-testid="save-password-btn">
                  {savingPw ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update password
                </Button>
              </form>
            </div>
          </section>
        )}

        {user?.auth_provider === "google" && (
          <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            Password management is not available for Google accounts.
          </div>
        )}
      </div>
    </Layout>
  );
}
