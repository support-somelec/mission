import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";

// Layout
import { AppLayout } from "@/components/layout";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import MissionsList from "@/pages/missions/index";
import MissionNew from "@/pages/missions/new";
import MissionEdit from "@/pages/missions/edit";
import MissionDetail from "@/pages/missions/detail";
import MissionOrderPrint from "@/pages/missions/order";
import MissionPaymentReceipt from "@/pages/missions/payment-receipt";
import EmployeesList from "@/pages/employees/index";
import AdminDepartments from "@/pages/admin/departments";
import AdminEmployees from "@/pages/admin/employees";
import AdminUsers from "@/pages/admin/users";
import AdminImport from "@/pages/admin/import";
import Reporting from "@/pages/reporting";

function ProtectedRoute({ component: Component, adminOnly = false, ...rest }: any) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>
      
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      
      <Route path="/missions">
        {() => <ProtectedRoute component={MissionsList} />}
      </Route>

      <Route path="/missions/new">
        {() => <ProtectedRoute component={MissionNew} />}
      </Route>

      <Route path="/missions/:id/edit">
        {() => <ProtectedRoute component={MissionEdit} />}
      </Route>

      <Route path="/missions/:id/order">
        {() => <ProtectedRoute component={MissionOrderPrint} />}
      </Route>

      <Route path="/missions/:id/payment-receipt">
        {() => <ProtectedRoute component={MissionPaymentReceipt} />}
      </Route>

      <Route path="/missions/:id">
        {() => <ProtectedRoute component={MissionDetail} />}
      </Route>

      <Route path="/employees">
        {() => <ProtectedRoute component={EmployeesList} />}
      </Route>

      <Route path="/admin/departments">
        {() => <ProtectedRoute component={AdminDepartments} adminOnly={true} />}
      </Route>

      <Route path="/admin/employees">
        {() => <ProtectedRoute component={AdminEmployees} adminOnly={true} />}
      </Route>

      <Route path="/admin/users">
        {() => <ProtectedRoute component={AdminUsers} adminOnly={true} />}
      </Route>

      <Route path="/admin/import">
        {() => <ProtectedRoute component={AdminImport} adminOnly={true} />}
      </Route>

      <Route path="/reporting">
        {() => <ProtectedRoute component={Reporting} />}
      </Route>

      <Route>
        {() => (
          <AppLayout>
            <div className="min-h-[50vh] flex items-center justify-center">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-gray-900">Page introuvable</h1>
                <p className="text-muted-foreground">L'URL demandée n'existe pas.</p>
              </div>
            </div>
          </AppLayout>
        )}
      </Route>
    </Switch>
  );
}

export default AppRouter;
