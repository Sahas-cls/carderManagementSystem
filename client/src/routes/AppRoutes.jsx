import { BrowserRouter, Route, Routes } from "react-router-dom";
import UserLayout from "../layouts/UserLayout";
import DashboardPage from "../pages/dashboard/DashboardPage";
import DailyEntryPage from "../pages/cadre/DailyEntryPage";
import WeeklyViewPage from "../pages/cadre/WeeklyViewPage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<UserLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/daily-entry" element={<DailyEntryPage />} />
          <Route path="/weekly-view" element={<WeeklyViewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
