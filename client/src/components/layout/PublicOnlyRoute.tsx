import { Navigate, Outlet } from "react-router";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

function PublicOnlyRoute() {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) return null;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default PublicOnlyRoute;
