import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import AppShell from "@/components/layout/AppShell";
import { clearAuthSession, setAuthSession } from "@/lib/auth-token";

function renderShell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<div>page content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  clearAuthSession();
});

describe("AppShell", () => {
  it("shows nav links and a logout button when a user is signed in", async () => {
    setAuthSession("token", { id: "u1", name: "Jane Doe", email: "jane@example.com" });

    renderShell();

    expect(await screen.findByRole("link", { name: /events/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /my bookings/i })).toHaveAttribute(
      "href",
      "/bookings",
    );
    expect(screen.getByRole("link", { name: /create event/i })).toHaveAttribute(
      "href",
      "/events/new",
    );
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("hides nav links when no user is signed in", () => {
    renderShell();

    expect(screen.queryByRole("button", { name: /log out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /my bookings/i })).not.toBeInTheDocument();
  });

  it("clears the session and hides nav when logging out", async () => {
    setAuthSession("token", { id: "u1", name: "Jane Doe", email: "jane@example.com" });

    renderShell();

    fireEvent.click(await screen.findByRole("button", { name: /log out/i }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /log out/i })).not.toBeInTheDocument(),
    );
  });
});
