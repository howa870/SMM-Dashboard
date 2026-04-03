import { Router as WouterRouter, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { SupabaseAuthProvider } from "@/context/AuthContext";
import { AuthProvider } from "@/lib/auth-context";
import "@/lib/token";

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

const queryClient = new QueryClient();

const ROUTES: Record<string, React.ComponentType> = {
  "/": Dashboard,
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
