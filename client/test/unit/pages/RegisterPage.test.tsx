import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerRequest } from "@/features/auth/api/auth.api";
import { ApiError } from "@/lib/api-client";
import RegisterPage from "@/pages/RegisterPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("@/features/auth/api/auth.api");

const mockedRegisterRequest = vi.mocked(registerRequest);

beforeEach(() => {
  mockedRegisterRequest.mockReset();
  localStorage.clear();
});

function fillForm() {
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
}

describe("RegisterPage", () => {
  it("shows validation errors when submitted empty", async () => {
    renderWithProviders(<RegisterPage />, "/register");

    fireEvent.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(mockedRegisterRequest).not.toHaveBeenCalled();
  });

  it("rejects a password under 8 characters", async () => {
    renderWithProviders(<RegisterPage />, "/register");

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mockedRegisterRequest).not.toHaveBeenCalled();
  });

  it("registers and redirects home on success", async () => {
    mockedRegisterRequest.mockResolvedValue({
      token: "fake-token",
      user: { id: "u1", name: "Jane Doe", email: "jane@example.com" },
    });

    renderWithProviders(<RegisterPage />, "/register");
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(localStorage.getItem("auth_token")).toBe("fake-token");
  });

  it("shows the server's error message on duplicate email", async () => {
    mockedRegisterRequest.mockRejectedValue(
      new ApiError(409, "An account with this email already exists"),
    );

    renderWithProviders(<RegisterPage />, "/register");
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it("disables the submit button while the request is pending", async () => {
    mockedRegisterRequest.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<RegisterPage />, "/register");
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByRole("button", { name: /registering/i })).toBeDisabled();
  });
});
