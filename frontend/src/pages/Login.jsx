import React from "react";
import { SignIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { BarChart2 } from "lucide-react";

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="login-page">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="h-8 w-8 rounded-lg gradient-indigo flex items-center justify-center">
            <BarChart2 className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>InsightForge</span>
        </Link>

        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/signup"
          fallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-card border border-border/50 shadow-sm",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              formFieldLabel: "text-foreground",
              formFieldInput: "bg-background border-border text-foreground",
              formButtonPrimary: "gradient-indigo",
              footerActionLink: "text-primary",
              socialButtonsBlockButton: "border-border text-foreground hover:bg-muted",
              dividerLine: "bg-border",
              dividerText: "text-muted-foreground",
            },
          }}
        />
      </div>
    </div>
  );
}
