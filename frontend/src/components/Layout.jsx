import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useUser, useClerk } from "@clerk/clerk-react";
import {
  LayoutDashboard, Settings, Sun, Moon, Menu,
  BarChart2, Layers, ChevronDown, LogOut,
} from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "../lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Workspaces", icon: Layers, path: "/workspaces" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      data-testid="theme-toggle"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-8 w-8"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const name = user?.fullName || user?.firstName || "User";
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const picture = user?.imageUrl;
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 flex items-center gap-2 px-2" data-testid="user-menu-trigger">
          <Avatar className="h-7 w-7">
            <AvatarImage src={picture} />
            <AvatarFallback className="text-xs gradient-indigo text-white">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium max-w-[100px] truncate hidden sm:block">{name}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="settings-menu-item">
          <Settings className="h-4 w-4 mr-2" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/" })} className="text-destructive" data-testid="logout-menu-item">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border/50">
        <div className="h-8 w-8 rounded-lg gradient-indigo flex items-center justify-center">
          <BarChart2 className="h-4 w-4 text-white" />
        </div>
        {sidebarOpen && (
          <span className="font-bold text-base tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            InsightForge
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              onClick={() => setMobileSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-border/50 hidden lg:block">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground text-xs"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          data-testid="sidebar-toggle"
        >
          <Menu className="h-4 w-4" />
          {sidebarOpen && <span>Collapse</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border/50 bg-card transition-all duration-300",
          sidebarOpen ? "w-56" : "w-14"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-card border-r border-border flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border/50 glass sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              data-testid="mobile-menu-toggle"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div id="breadcrumb-portal" />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
