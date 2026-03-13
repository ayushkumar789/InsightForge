import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart2, ArrowRight, CheckCircle2, Zap, Shield, TrendingUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

const features = [
  { icon: BarChart2, title: "Deterministic Analysis", desc: "Python-powered statistical analysis with automatic chart generation — no guessing, pure data." },
  { icon: Zap, title: "AI-Powered Insights", desc: "Gemini generates natural language business insights from your analysis results." },
  { icon: TrendingUp, title: "Interactive Charts", desc: "Auto-recommended visualizations: histograms, scatter plots, bar charts, correlation heatmaps." },
  { icon: Shield, title: "Professional Reports", desc: "Export polished PDF reports with statistics, charts, and AI insights for client delivery." },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg gradient-indigo flex items-center justify-center">
              <BarChart2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              InsightForge
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" data-testid="nav-login-btn">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="gradient-indigo text-white" data-testid="nav-signup-btn">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-6 border-primary/30 text-primary bg-primary/5">
              Analytics Workspace Platform
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
              From raw data to{" "}
              <span className="text-gradient">clear insights</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl leading-relaxed">
              Organize datasets by workspace and project. Run automated analysis, visualize results,
              generate AI-powered insights with Gemini, and export professional PDF reports.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="gradient-indigo text-white gap-2 px-8"
                onClick={() => navigate("/signup")}
                data-testid="hero-get-started-btn"
              >
                Start for free <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/login")}
                data-testid="hero-signin-btn"
              >
                Sign in
              </Button>
            </div>

            <div className="flex items-center gap-6 mt-10 text-sm text-muted-foreground">
              {["CSV & XLSX support", "Gemini AI insights", "PDF report export"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">How it works</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {["Account", "Workspace", "Project", "Dataset", "Analysis", "Insights", "Report"].map((s, i, arr) => (
            <React.Fragment key={s}>
              <span className="px-3 py-1.5 rounded-md bg-card border border-border/50 font-medium">{s}</span>
              {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-12 pb-24">
        <h2 className="text-3xl font-semibold tracking-tight mb-12">Everything you need</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-colors"
              data-testid={`feature-card-${f.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>InsightForge — Dataset Analytics Workspace</span>
          <span>Built with React + FastAPI + Gemini</span>
        </div>
      </footer>
    </div>
  );
}
