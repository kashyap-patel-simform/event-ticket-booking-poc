import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginRequest } from "@/features/auth/api/auth.api";
import { ApiError } from "@/lib/api-client";
import LoginPage from "@/pages/LoginPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("@/features/auth/api/auth.api");

const mockedLoginRequest = vi.mocked(loginRequest);

beforeEach(() => {
  mockedLoginRequest.mockReset();
  localStorage.clear();
});

describe("LoginPage", () => {
  it("shows validation errors when submitted empty", async () => {
    renderWithProviders(<LoginPage />, "/login");

    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/must be a valid email/i)).toBeInTheDocument();
    expect(mockedLoginRequest).not.toHaveBeenCalled();
  });

  it("logs in and redirects home on success", async () => {
    mockedLoginRequest.mockResolvedValue({
      token: "fake-token",
      user: { id: "u1", name: "Jane", email: "jane@example.com" },
    });

    renderWithProviders(<LoginPage />, "/login");

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(localStorage.getItem("auth_token")).toBe("fake-token");
  });

  it("shows the server's error message on failed login", async () => {
    mockedLoginRequest.mockRejectedValue(new ApiError(401, "Invalid email or password"));

    renderWithProviders(<LoginPage />, "/login");

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  it("disables the submit button while the request is pending", async () => {
    let resolveLogin: (value: Awaited<ReturnType<typeof loginRequest>>) => void = () => {};
    mockedLoginRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    renderWithProviders(<LoginPage />, "/login");

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByRole("button", { name: /logging in/i })).toBeDisabled();

    resolveLogin({ token: "t", user: { id: "u1", name: "Jane", email: "jane@example.com" } });
  });
});
