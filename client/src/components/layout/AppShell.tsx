import { LogOut, Ticket } from "lucide-react";
import { Link, Outlet } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { cn } from "cn";

// Responsive: header spans the full viewport width at every breakpoint; the content region below
// it grows its max-width by breakpoint (mobile full-bleed -> wider column on tablet/desktop)
// instead of #15's single fixed tablet width. Pages keep controlling their own internal padding.
function AppShell() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:max-w-3xl sm:px-6 lg:max-w-5xl">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Ticket className="size-5 text-primary" />
            Event Booking
          </Link>

          {user && (
            <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
              <Link
                to="/"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-sm")}
              >
                Events
              </Link>
              <Link
                to="/bookings"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-sm")}
              >
                My Bookings
              </Link>
              <Link
                to="/events/new"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-sm")}
              >
                Create Event
              </Link>
              <span className="mx-1 hidden text-sm text-muted-foreground sm:inline">
                {user.name}
              </span>
              <button
                type="button"
                onClick={() => logout()}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
              >
                <LogOut className="size-3.5" />
                Log out
              </button>
            </nav>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col bg-secondary shadow-sm sm:max-w-3xl lg:max-w-5xl">
        <Outlet />
      </div>
    </div>
  );
}

export default AppShell;
