import { Router as WouterRouter, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/lib/auth-context";

import { Dashboard } from "@/pages/dashboard";
import { Login } from "@/pages/login";
import { Register } from "@/pages/register";
import { Services } from "@/pages/services";
import { NewOrder } from "@/pages/order";
import { Orders } from "@/pages/orders";
import { Wallet } from "@/pages/wallet";
import { AdminDashboard } from "@/pages/admin/dashboard";
import { AdminPayments } from "@/pages/admin/payments";
import { AdminOrders } from "@/pages/admin/orders";
import { AdminUsers } from "@/pages/admin/users";

const queryClient = new QueryClient();

const ROUTES: Record<string, React.ComponentType> = {
  "/": Dashboard,
  "/login": Login,
  "/register": Register,
  "/services": Services,
  "/order": NewOrder,
  "/orders": Orders,
  "/wallet": Wallet,
  "/admin": AdminDashboard,
  "/admin/payments": AdminPayments,
  "/admin/orders": AdminOrders,
  "/admin/users": AdminUsers,
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
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter hook={useHashLocation}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
