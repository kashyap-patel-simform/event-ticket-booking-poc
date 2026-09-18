import { createBrowserRouter } from "react-router";
import AppShell from "./components/layout/AppShell";
import EventDetailPage from "./pages/EventDetailPage";
import EventsListPage from "./pages/EventsListPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

export const router = createBrowserRouter([
  {
    Component: AppShell,
    children: [
      { path: "/", Component: EventsListPage },
      { path: "/events/:eventId", Component: EventDetailPage },
      { path: "/login", Component: LoginPage },
      { path: "/register", Component: RegisterPage },
    ],
  },
]);
