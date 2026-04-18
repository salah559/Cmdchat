import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PushNotificationProvider } from "@/contexts/PushNotificationContext";
import { VoiceCallProvider } from "@/contexts/VoiceCallContext";
import VoiceCallModal from "@/components/VoiceCallModal";
import LoginPage from "@/pages/LoginPage";
import ChatPage from "@/pages/ChatPage";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-sm animate-pulse text-green-400">Booting system...</div>
          <div className="text-green-700 text-xs">█████████░░ 90%</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <PushNotificationProvider>
      <VoiceCallProvider>
        <VoiceCallModal />
        <ChatPage />
      </VoiceCallProvider>
    </PushNotificationProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AppRoutes} />
      <Route path="/*" component={AppRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </AuthProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
