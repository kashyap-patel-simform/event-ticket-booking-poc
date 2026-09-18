import { Navigate, Outlet } from "react-router";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

function ProtectedRoute() {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default ProtectedRoute;
