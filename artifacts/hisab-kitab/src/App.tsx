import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { useLanguage } from "@/hooks/use-language";
import Layout from "@/components/Layout";
import { ReminderCall, type Reminder } from "@/components/ReminderCall";
import { fetchApi } from "@/lib/api";
import Login from "@/pages/login";
import Setup from "@/pages/setup";
import Dashboard from "@/pages/dashboard";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Labour from "@/pages/labour";
import LabourDetail from "@/pages/labour-detail";
import Mason from "@/pages/mason";
import MasonDetail from "@/pages/mason-detail";
import Attendance from "@/pages/attendance";
import MasonAttendance from "@/pages/mason-attendance";
import WeeklyPayment from "@/pages/weekly-payment";
import MasonPayments from "@/pages/mason-payments";
import Materials from "@/pages/materials";
import Equipment from "@/pages/equipment";
import Expenses from "@/pages/expenses";
import Payments from "@/pages/payments";
import Diary from "@/pages/diary";
import Photos from "@/pages/photos";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import Guide from "@/pages/guide";
import KbEditor from "@/pages/kb-editor";
import NotFound from "@/pages/not-found";
import LockScreen from "@/pages/lock-screen";
import { OfflineBanner } from "@/components/OfflineBanner";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
});

// Polls the backend every 60s and shows an incoming-call screen for
// any unopened reminder created in the last 10 minutes.
function ReminderPoll() {
  const [current, setCurrent] = useState<Reminder | null>(null);
  const shownRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled || current) return; // skip while a call screen is open
      try {
        const data = await fetchApi("/reminders/pending");
        const reminders: Reminder[] = data?.reminders ?? [];
        const next = reminders.find((r) => !shownRef.current.has(r.id));
        if (next) {
          shownRef.current.add(next.id);
          setCurrent(next);
        }
      } catch {
        // backend unreachable — try again next poll
      }
    };

    poll();
    const interval = window.setInterval(poll, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [current]);

  if (!current) return null;
  return (
    <ReminderCall
      reminder={current}
      onDismiss={() => setCurrent(null)}
      onAnswer={() => setCurrent(null)}
    />
  );
}

function AppRoutes() {
  const { isAuthenticated, needsSetup, isLoading, isSessionUnlocked } = useAuth();
  const { lang } = useLanguage();

  useEffect(() => {
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
    document.documentElement.lang = lang === "ur" ? "ur" : "en";
  }, [lang]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading Hisab Kitab...</p>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return (
      <Switch>
        <Route path="/setup" component={Setup} />
        <Route><Redirect to="/setup" /></Route>
      </Switch>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route><Redirect to="/login" /></Route>
      </Switch>
    );
  }

  if (!isSessionUnlocked) {
    return <LockScreen />;
  }

  return (
    <>
      <OfflineBanner />
      <ReminderPoll />
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/projects" component={Projects} />
          <Route path="/projects/:id" component={ProjectDetail} />
          <Route path="/labour" component={Labour} />
          <Route path="/labour/:id" component={LabourDetail} />
          <Route path="/mason" component={Mason} />
          <Route path="/mason/:id" component={MasonDetail} />
          <Route path="/attendance" component={Attendance} />
          <Route path="/mason-attendance" component={MasonAttendance} />
          <Route path="/weekly-payment" component={WeeklyPayment} />
          <Route path="/mason-payments" component={MasonPayments} />
          <Route path="/materials" component={Materials} />
          <Route path="/equipment" component={Equipment} />
          <Route path="/expenses" component={Expenses} />
          <Route path="/payments" component={Payments} />
          <Route path="/diary" component={Diary} />
          <Route path="/photos" component={Photos} />
          <Route path="/reports" component={Reports} />
          <Route path="/guide" component={Guide} />
          <Route path="/kb-editor" component={KbEditor} />
          <Route path="/settings" component={Settings} />
          <Route path="/login"><Redirect to="/" /></Route>
          <Route path="/setup"><Redirect to="/" /></Route>
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
