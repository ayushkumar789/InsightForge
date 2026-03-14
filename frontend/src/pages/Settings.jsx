import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import axios from "axios";
import { toast } from "sonner";
import { User, Save } from "lucide-react";
import Layout from "../components/Layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Settings() {
  const { user: clerkUser } = useUser();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await axios.get(`${API}/auth/me`);
        setName(data.name || "");
      } catch {
        // fallback to Clerk user data
        setName(clerkUser?.fullName || clerkUser?.firstName || "");
      }
    };
    fetchProfile();
  }, [clerkUser]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/auth/profile`, { name });
      toast.success("Profile updated");
    } catch (e) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const email = clerkUser?.primaryEmailAddress?.emailAddress || "";
  const picture = clerkUser?.imageUrl;
  const initials = (name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Layout>
      <div className="p-6 w-full max-w-4xl mx-auto" data-testid="settings-page">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <div className="space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Profile
              </CardTitle>
              <CardDescription>Manage your display name. Authentication is managed by Clerk.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar & email (read-only from Clerk) */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={picture} />
                  <AvatarFallback className="text-lg gradient-indigo text-white">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{name || "User"}</p>
                  <p className="text-sm text-muted-foreground">{email}</p>
                </div>
              </div>

              {/* Display name */}
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your display name"
                  data-testid="settings-name-input"
                />
              </div>

              <Button onClick={handleSave} disabled={saving} data-testid="settings-save-btn">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Account info */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your account is managed through Clerk. Use the user menu to manage your password, linked accounts, and security settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Auth Provider</p>
                  <p className="font-medium">Clerk</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
