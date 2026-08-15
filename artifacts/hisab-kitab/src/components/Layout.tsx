import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";
import {
  LayoutDashboard, FolderKanban, Users, CalendarCheck, Wallet,
  Package, Wrench, Receipt, CreditCard, BookOpen, Camera,
  BarChart3, Settings, LogOut, Menu, X, Sun, Moon, Languages,
   HardHat, ChevronRight, Compass
} from "lucide-react";
import { cn } from "@/lib/utils";
import VoiceAssistant from "./VoiceAssistant";
import GuideChat from "./GuideChat";

const NAV_ITEMS = [
  { path: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { path: "/projects", icon: FolderKanban, key: "projects" },
  { path: "/labour", icon: Users, key: "labour" },
  { path: "/mason", icon: Users, key: "mason" },
  { path: "/attendance", icon: CalendarCheck, key: "labour_attendance" },
  { path: "/mason-attendance", icon: CalendarCheck, key: "mason_attendance" },
  { path: "/weekly-payment", icon: Wallet, key: "labour_weekly_payments_title" },
  { path: "/mason-payments", icon: Wallet, key: "mason_payments" },
  { path: "/materials", icon: Package, key: "materials" },
  { path: "/equipment", icon: Wrench, key: "equipment" },
  { path: "/expenses", icon: Receipt, key: "expenses" },
  { path: "/payments", icon: CreditCard, key: "payments" },
  { path: "/diary", icon: BookOpen, key: "diary" },
  { path: "/photos", icon: Camera, key: "photos" },
  { path: "/reports", icon: BarChart3, key: "reports" },
  { path: "/guide", icon: Compass, key: "guide" },
  { path: "/settings", icon: Settings, key: "settings" },
] as const;

type NavKey = typeof NAV_ITEMS[number]["key"];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { t, lang, setLanguage } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
  const toggleLang = () => setLanguage(lang === "en" ? "ur" : "en");

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <Link href="/dashboard" className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border" onClick={() => setSidebarOpen(false)}>
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <HardHat className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sidebar-foreground text-base leading-tight">Hisab Kitab</div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.filter(({ key }) => key !== "reports" || isAdmin).map(({ path, icon: Icon, key }) => {
          const isActive = location === path || (path === "/dashboard" && (location === "/" || location === ""));
          return (
            <Link
              key={path}
              href={path}
              data-testid={`nav-${key}`}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{t(key as NavKey)}</span>
              {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-70" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <button
            data-testid="btn-toggle-theme"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground text-xs transition-colors"
          >
            {resolvedTheme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {resolvedTheme === "dark" ? t("light") : t("dark")}
          </button>
          <span className="text-sidebar-border mx-1">|</span>
          <button
            data-testid="btn-toggle-lang"
            onClick={toggleLang}
            className="flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground text-xs transition-colors"
          >
            <Languages className="w-3.5 h-3.5" />
            {lang === "en" ? "اردو" : "English"}
          </button>
        </div>

        {user && (
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="min-w-0">
              <div className="text-sidebar-foreground text-xs font-medium truncate">{user.name}</div>
              <div className="text-sidebar-foreground/50 text-xs truncate">{user.mobile}</div>
            </div>
            <button
              data-testid="btn-logout"
              onClick={logout}
              title={t("logout")}
              className="text-sidebar-foreground/50 hover:text-destructive transition-colors flex-shrink-0 ml-2"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 rtl:left-auto rtl:right-0 rtl:border-r-0 rtl:border-l z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 rtl:left-auto rtl:right-0 w-72 bg-sidebar z-50 md:hidden transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-60 rtl:md:ml-0 rtl:md:mr-60">
        {/* Mobile Top Bar */}
        <header className="md:hidden sticky top-0 z-30 bg-background border-b border-border flex items-center gap-3 px-4 h-14">
          <button
            data-testid="btn-menu-open"
            onClick={() => setSidebarOpen(true)}
            className="text-foreground"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
            <HardHat className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground text-sm">Hisab Kitab</span>
          </Link>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      <VoiceAssistant />
      <GuideChat variant="widget" />
    </div>
  );
}
