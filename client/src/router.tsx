import { createBrowserRouter } from "react-router";
import AppShell from "./components/layout/AppShell";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import PublicOnlyRoute from "./components/layout/PublicOnlyRoute";
import CreateEventPage from "./pages/CreateEventPage";
import EventDetailPage from "./pages/EventDetailPage";
import EventsListPage from "./pages/EventsListPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

export const router = createBrowserRouter([
  {
    Component: AppShell,
    children: [
      {
        Component: ProtectedRoute,
        children: [
          { path: "/", Component: EventsListPage },
          { path: "/events/new", Component: CreateEventPage },
          { path: "/events/:eventId", Component: EventDetailPage },
        ],
      },
      {
        Component: PublicOnlyRoute,
        children: [
          { path: "/login", Component: LoginPage },
          { path: "/register", Component: RegisterPage },
        ],
      },
    ],
  },
]);
