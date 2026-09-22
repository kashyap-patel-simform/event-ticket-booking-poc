import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listBookingsRequest } from "@/features/payments/api/payments.api";
import CheckoutSuccessPage from "@/pages/CheckoutSuccessPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("@/features/payments/api/payments.api");

const mockedListBookingsRequest = vi.mocked(listBookingsRequest);

beforeEach(() => {
  mockedListBookingsRequest.mockReset();
});

describe("CheckoutSuccessPage", () => {
  it("shows the most recent booking's ticket reference", async () => {
    mockedListBookingsRequest.mockResolvedValue([
      {
        id: "booking-2",
        eventId: "evt-1",
        eventName: "Concert A",
        ticketReference: "ticket-newest",
        status: "confirmed",
        amountCents: 5000,
        currency: "usd",
        createdAt: "2026-02-01T00:00:00.000Z",
        seats: [{ id: "s1", label: "1" }],
      },
    ]);

    renderWithProviders(<CheckoutSuccessPage />, "/checkout/success");

    expect(await screen.findByText(/payment successful/i)).toBeInTheDocument();
    expect(await screen.findByText("ticket-newest")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my bookings/i })).toHaveAttribute(
      "href",
      "/bookings",
    );
  });
});
