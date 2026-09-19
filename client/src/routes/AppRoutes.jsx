import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import AuthLayout from "../layouts/AuthLayout";
import UserLayout from "../layouts/UserLayout";
import DashboardPage from "../pages/dashboard/DashboardPage";
import DailyEntryPage from "../pages/cadre/DailyEntryPage";
import WeeklyViewPage from "../pages/cadre/WeeklyViewPage";
import WeekEntryPage from "../pages/users/WeekEntryPage";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ChangePasswordPage from "../pages/auth/ChangePasswordPage";
import ManageUsersPage from "../pages/admin/ManageUsersPage";
import ProtectedRoute from "./ProtectedRoute";
import ManageFactoryPage from "../pages/admin/ManageFactoryPage";
import ManageBudget from "../pages/admin/ManageBudget";
import ManageResignationReasonPage from "../pages/admin/ManageResignationReasonPage";
import ManageServiceRanges from "../pages/admin/ManageServiceRanges";
import ManageDesignationPage from "../pages/admin/ManageDesignationPage";
import ManageDepartmentPage from "../pages/admin/ManageDepartmentPage";
import ManageSectionPage from "../pages/admin/ManageSectionPage";
import ManageEmployeesPage from "../pages/admin/ManageEmployeesPage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            {/* Rendered inside the branding/card chrome, not the full nav shell - an
                account with mustChangePassword is confined here until it changes. */}
            <Route element={<AuthLayout />}>
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>

            <Route element={<UserLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/week-entry" element={<WeekEntryPage />} />
              <Route path="/daily-entry" element={<DailyEntryPage />} />
              <Route path="/weekly-view" element={<WeeklyViewPage />} />

              {/* Manage Users is sensitive (lists every account's email etc.) - Administrator-only, not SuperUser. */}
              <Route element={<ProtectedRoute roles={["Administrator"]} />}>
                <Route path="/manage-users" element={<ManageUsersPage />} />
              </Route>

              {/* The rest of the Admin section is viewable (read-only) by SuperUser too - each page itself hides its add/edit/delete controls for that role. */}
              <Route element={<ProtectedRoute roles={["Administrator", "SuperUser"]} />}>
                <Route path="/manage-employees" element={<ManageEmployeesPage />} />
                <Route path="/factory-master" element={<ManageFactoryPage />} />
                <Route path="/budget-master" element={<ManageBudget />} />
                <Route
                  path="/resignation-reasons"
                  element={<ManageResignationReasonPage />}
                />
                <Route
                  path="/service-master"
                  element={<ManageServiceRanges />}
                />
                <Route path="/designation-master" element={<ManageDesignationPage />} />
                <Route path="/department-master" element={<ManageDepartmentPage />} />
                <Route path="/section-master" element={<ManageSectionPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
