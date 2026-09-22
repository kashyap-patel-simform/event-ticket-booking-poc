import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listBookingsRequest } from "@/features/payments/api/payments.api";
import BookingsPage from "@/pages/BookingsPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("@/features/payments/api/payments.api");

const mockedListBookingsRequest = vi.mocked(listBookingsRequest);

beforeEach(() => {
  mockedListBookingsRequest.mockReset();
});

describe("BookingsPage", () => {
  it("renders a booking's ticket reference, event name, and status", async () => {
    mockedListBookingsRequest.mockResolvedValue([
      {
        id: "booking-1",
        eventId: "evt-1",
        eventName: "Concert A",
        ticketReference: "ticket-abc-123",
        status: "confirmed",
        amountCents: 5000,
        currency: "usd",
        createdAt: "2026-01-01T00:00:00.000Z",
        seats: [{ id: "s1", label: "1" }],
      },
    ]);

    renderWithProviders(<BookingsPage />, "/bookings");

    expect(await screen.findByText("Concert A")).toBeInTheDocument();
    expect(screen.getByText("ticket-abc-123")).toBeInTheDocument();
    expect(screen.getByText("confirmed")).toBeInTheDocument();
    expect(screen.getByText(/\$50\.00/)).toBeInTheDocument();
  });

  it("shows a message when there are no bookings", async () => {
    mockedListBookingsRequest.mockResolvedValue([]);

    renderWithProviders(<BookingsPage />, "/bookings");

    expect(await screen.findByText(/no bookings yet/i)).toBeInTheDocument();
  });
});
