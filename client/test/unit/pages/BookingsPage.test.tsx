import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cancelBookingRequest, listBookingsRequest } from "@/features/payments/api/payments.api";
import BookingsPage from "@/pages/BookingsPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("@/features/payments/api/payments.api");

const mockedListBookingsRequest = vi.mocked(listBookingsRequest);
const mockedCancelBookingRequest = vi.mocked(cancelBookingRequest);

beforeEach(() => {
  mockedListBookingsRequest.mockReset();
  mockedCancelBookingRequest.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("BookingsPage", () => {
  it("renders a booking's ticket reference, event name, and status", async () => {
    mockedListBookingsRequest.mockResolvedValue([
      {
        id: "booking-1",
        eventId: "evt-1",
        eventName: "Concert A",
        eventDate: "2030-01-01T00:00:00.000Z",
        ticketReference: "ticket-abc-123",
        status: "confirmed",
        amountCents: 5000,
        currency: "usd",
        createdAt: "2026-01-01T00:00:00.000Z",
        seatLabels: ["1"],
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

  it("disables cancellation within 24h of the event and shows the cutoff caption", async () => {
    mockedListBookingsRequest.mockResolvedValue([
      {
        id: "booking-1",
        eventId: "evt-1",
        eventName: "Concert A",
        eventDate: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
        ticketReference: "ticket-abc-123",
        status: "confirmed",
        amountCents: 5000,
        currency: "usd",
        createdAt: "2026-01-01T00:00:00.000Z",
        seatLabels: ["1"],
      },
    ]);

    renderWithProviders(<BookingsPage />, "/bookings");

    expect(
      await screen.findByText(/cancellation closes 24h before the event/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel booking/i })).toBeDisabled();
  });

  it("cancels a booking more than 24h before the event", async () => {
    mockedListBookingsRequest.mockResolvedValue([
      {
        id: "booking-1",
        eventId: "evt-1",
        eventName: "Concert A",
        eventDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
        ticketReference: "ticket-abc-123",
        status: "confirmed",
        amountCents: 5000,
        currency: "usd",
        createdAt: "2026-01-01T00:00:00.000Z",
        seatLabels: ["1"],
      },
    ]);
    mockedCancelBookingRequest.mockResolvedValue(undefined);

    renderWithProviders(<BookingsPage />, "/bookings");

    const cancelButton = await screen.findByRole("button", { name: /cancel booking/i });
    expect(cancelButton).toBeEnabled();

    await userEvent.click(cancelButton);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(mockedCancelBookingRequest).toHaveBeenCalledWith("booking-1"));
  });

  it("does not cancel when the confirmation dialog is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mockedListBookingsRequest.mockResolvedValue([
      {
        id: "booking-1",
        eventId: "evt-1",
        eventName: "Concert A",
        eventDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
        ticketReference: "ticket-abc-123",
        status: "confirmed",
        amountCents: 5000,
        currency: "usd",
        createdAt: "2026-01-01T00:00:00.000Z",
        seatLabels: ["1"],
      },
    ]);

    renderWithProviders(<BookingsPage />, "/bookings");

    const cancelButton = await screen.findByRole("button", { name: /cancel booking/i });
    await userEvent.click(cancelButton);

    expect(mockedCancelBookingRequest).not.toHaveBeenCalled();
  });
});
