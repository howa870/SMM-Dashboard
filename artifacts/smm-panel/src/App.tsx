import { Switch, Route, Router as WouterRouter } from "wouter";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/services" component={Services} />
      <Route path="/order" component={NewOrder} />
      <Route path="/orders" component={Orders} />
      <Route path="/wallet" component={Wallet} />
      
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/payments" component={AdminPayments} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/users" component={AdminUsers} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
