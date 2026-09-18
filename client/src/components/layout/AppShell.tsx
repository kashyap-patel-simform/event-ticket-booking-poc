import { Outlet } from "react-router";

// Tablet-only target (~672px, Tailwind's max-w-2xl) — no mobile/desktop responsive breakpoints.
// The tinted frame spans the full viewport height edge-to-edge (not floating with margin) so its
// boundary against the white page is visible top to bottom. Pages control their own internal
// padding/centering.
function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-secondary shadow-sm">
        <Outlet />
      </div>
    </div>
  );
}

export default AppShell;
