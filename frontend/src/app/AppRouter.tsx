import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppShell } from "./AppShell";
import { DashboardPage } from "../pages/DashboardPage";
import { FleetMapPage } from "../pages/FleetMapPage";
import { NewsPage } from "../pages/NewsPage";
import { DecisionQueuePage } from "../pages/DecisionQueuePage";
import { IncidentDecisionPage } from "../pages/IncidentDecisionPage";
import { ReportPage } from "../pages/ReportPage";

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "map", element: <FleetMapPage /> },
      { path: "news", element: <NewsPage /> },
      { path: "decisions", element: <DecisionQueuePage /> },
      { path: "decisions/incident/:incidentId", element: <IncidentDecisionPage /> },
      { path: "reports", element: <ReportPage /> },
      { path: "executions", element: <Navigate to="/decisions" replace /> },
      { path: "*", element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
