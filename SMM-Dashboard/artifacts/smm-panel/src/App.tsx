import { Router as WouterRouter, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { SupabaseAuthProvider, useSupabaseAuth } from "@/context/AuthContext";
import { AuthProvider } from "@/lib/auth-context";
import "@/lib/token";

import { Landing } from "@/pages/landing";
import { Dashboard } from "@/pages/dashboard";
import { Login } from "@/pages/login";
import { Register } from "@/pages/register";
import { Services } from "@/pages/services";
import { NewOrder } from "@/pages/order";
import { Orders } from "@/pages/orders";
import { Wallet } from "@/pages/wallet";
import { Transactions } from "@/pages/transactions";
import { AdminDashboard } from "@/pages/admin/dashboard";
import { AdminPayments } from "@/pages/admin/payments";
import { AdminOrders } from "@/pages/admin/orders";
import { AdminUsers } from "@/pages/admin/users";
import { AdminServices } from "@/pages/admin/services";
import { AdminSettings } from "@/pages/admin/settings";

const queryClient = new QueryClient();

// Home route: landing page for guests, dashboard for logged-in users
function HomeRoute() {
  const { supabaseUser, isLoading } = useSupabaseAuth();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: "#0F172A" }}>
        <div className="w-12 h-12 rounded-full animate-spin"
          style={{ border: "3px solid rgba(99,102,241,0.2)", borderTop: "3px solid #6366F1" }} />
      </div>
    );
  }

  return supabaseUser ? <Dashboard /> : <Landing />;
}

const ROUTES: Record<string, React.ComponentType> = {
  "/": HomeRoute,
  "/login": Login,
  "/register": Register,
  "/services": Services,
  "/order": NewOrder,
  "/orders": Orders,
  "/wallet": Wallet,
  "/transactions": Transactions,
  "/admin": AdminDashboard,
  "/admin/payments": AdminPayments,
  "/admin/orders": AdminOrders,
  "/admin/users": AdminUsers,
  "/admin/services": AdminServices,
  "/admin/settings": AdminSettings,
};

function Router() {
  const [location] = useLocation();
  const path = location.split("?")[0];
  const Component = ROUTES[path];
  if (Component) return <Component />;
  return <NotFound />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter hook={useHashLocation}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </SupabaseAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
