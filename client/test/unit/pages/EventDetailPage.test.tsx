import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEventRequest, listSeatsRequest } from "@/features/events/api/events.api";
import { createHoldRequest } from "@/features/holds/api/holds.api";
import { createCheckoutRequest } from "@/features/payments/api/payments.api";
import { ApiError } from "@/lib/api-client";
import EventDetailPage from "@/pages/EventDetailPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("@/features/events/api/events.api");
vi.mock("@/features/holds/api/holds.api");
vi.mock("@/features/payments/api/payments.api");

const mockedGetEventRequest = vi.mocked(getEventRequest);
const mockedListSeatsRequest = vi.mocked(listSeatsRequest);
const mockedCreateHoldRequest = vi.mocked(createHoldRequest);
const mockedCreateCheckoutRequest = vi.mocked(createCheckoutRequest);

const EVENT = {
  id: "evt-1",
  organiserId: "u1",
  name: "Concert A",
  date: "2027-01-01T00:00:00.000Z",
  venue: "Arena A",
  priceCents: 2500,
  createdAt: "2026-01-01T00:00:00.000Z",
  seatCounts: { available: 1, held: 1, booked: 1 },
};

beforeEach(() => {
  mockedGetEventRequest.mockReset();
  mockedListSeatsRequest.mockReset();
  mockedCreateHoldRequest.mockReset();
  mockedCreateCheckoutRequest.mockReset();
});

describe("EventDetailPage", () => {
  it("renders event info and seats with distinct styling per status", async () => {
    mockedGetEventRequest.mockResolvedValue(EVENT);
    mockedListSeatsRequest.mockResolvedValue([
      { id: "s1", label: "1", status: "available" },
      { id: "s2", label: "2", status: "held" },
      { id: "s3", label: "3", status: "booked" },
    ]);

    renderWithProviders(<EventDetailPage />, "/events/evt-1", "/events/:eventId");

    expect(await screen.findByText("Concert A")).toBeInTheDocument();
    expect(screen.getByText("Arena A")).toBeInTheDocument();
    expect(screen.getByText(/\$25\.00/)).toBeInTheDocument();

    const available = screen.getByTitle("Seat 1 — Available");
    const held = screen.getByTitle("Seat 2 — Held");
    const booked = screen.getByTitle("Seat 3 — Booked");

    expect(available.querySelector("svg")).toHaveClass("text-muted-foreground");
    expect(held.querySelector("svg")).toHaveClass("text-accent");
    expect(booked.querySelector("svg")).toHaveClass("text-primary");
  });

  it("shows an error state when the event isn't found", async () => {
    mockedGetEventRequest.mockRejectedValue(new Error("not found"));
    mockedListSeatsRequest.mockResolvedValue([]);

    renderWithProviders(<EventDetailPage />, "/events/evt-1", "/events/:eventId");

    expect(await screen.findByText(/event not found/i)).toBeInTheDocument();
  });

  it("selecting an available seat marks it selected and enables the hold button", async () => {
    mockedGetEventRequest.mockResolvedValue(EVENT);
    mockedListSeatsRequest.mockResolvedValue([{ id: "s1", label: "1", status: "available" }]);

    renderWithProviders(<EventDetailPage />, "/events/evt-1", "/events/:eventId");

    const holdButton = await screen.findByRole("button", { name: /hold seats/i });
    expect(holdButton).toBeDisabled();

    fireEvent.click(screen.getByTitle("Seat 1 — Available"));

    expect(screen.getByTitle("Seat 1 — Selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hold 1 seat/i })).toBeEnabled();
  });

  it("holds the selected seats and shows a countdown + Pay Now on success", async () => {
    mockedGetEventRequest.mockResolvedValue(EVENT);
    mockedListSeatsRequest.mockResolvedValue([{ id: "s1", label: "1", status: "available" }]);
    mockedCreateHoldRequest.mockResolvedValue({
      id: "hold-1",
      status: "active",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      seats: [{ id: "s1", label: "1" }],
    });

    renderWithProviders(<EventDetailPage />, "/events/evt-1", "/events/:eventId");

    fireEvent.click(await screen.findByTitle("Seat 1 — Available"));
    fireEvent.click(screen.getByRole("button", { name: /hold 1 seat/i }));

    expect(await screen.findByText(/held — expires in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pay now/i })).toBeInTheDocument();
    expect(mockedCreateHoldRequest).toHaveBeenCalledWith("evt-1", ["s1"]);
  });

  it("shows the server's error message when holding fails", async () => {
    mockedGetEventRequest.mockResolvedValue(EVENT);
    mockedListSeatsRequest.mockResolvedValue([{ id: "s1", label: "1", status: "available" }]);
    mockedCreateHoldRequest.mockRejectedValue(new ApiError(409, "Seat no longer available"));

    renderWithProviders(<EventDetailPage />, "/events/evt-1", "/events/:eventId");

    fireEvent.click(await screen.findByTitle("Seat 1 — Available"));
    fireEvent.click(screen.getByRole("button", { name: /hold 1 seat/i }));

    expect(await screen.findByText("Seat no longer available")).toBeInTheDocument();
  });

  it("redirects to Stripe checkout when Pay Now succeeds", async () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, href: "" },
      writable: true,
    });

    mockedGetEventRequest.mockResolvedValue(EVENT);
    mockedListSeatsRequest.mockResolvedValue([{ id: "s1", label: "1", status: "available" }]);
    mockedCreateHoldRequest.mockResolvedValue({
      id: "hold-1",
      status: "active",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      seats: [{ id: "s1", label: "1" }],
    });
    mockedCreateCheckoutRequest.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com/pay/cs_test_1",
      paymentAttemptId: "attempt-1",
    });

    renderWithProviders(<EventDetailPage />, "/events/evt-1", "/events/:eventId");

    fireEvent.click(await screen.findByTitle("Seat 1 — Available"));
    fireEvent.click(screen.getByRole("button", { name: /hold 1 seat/i }));
    fireEvent.click(await screen.findByRole("button", { name: /pay now/i }));

    await waitFor(() => {
      expect(window.location.href).toBe("https://checkout.stripe.com/pay/cs_test_1");
    });
    expect(mockedCreateCheckoutRequest).toHaveBeenCalledWith("hold-1");
  });
});
