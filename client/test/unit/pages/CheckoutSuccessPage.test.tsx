import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCheckoutSessionStatusRequest } from "@/features/payments/api/payments.api";
import CheckoutSuccessPage from "@/pages/CheckoutSuccessPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("@/features/payments/api/payments.api");

const mockedGetCheckoutSessionStatusRequest = vi.mocked(getCheckoutSessionStatusRequest);

beforeEach(() => {
  mockedGetCheckoutSessionStatusRequest.mockReset();
});

const ROUTE = "/checkout/success?session_id=cs_test_123";

describe("CheckoutSuccessPage", () => {
  it("shows the booking tied to this checkout session when it succeeded", async () => {
    mockedGetCheckoutSessionStatusRequest.mockResolvedValue({
      status: "succeeded",
      booking: {
        id: "booking-1",
        eventId: "evt-1",
        eventName: "Concert A",
        ticketReference: "ticket-this-session",
        status: "confirmed",
        amountCents: 5000,
        currency: "usd",
        createdAt: "2026-02-01T00:00:00.000Z",
        seats: [{ id: "s1", label: "1" }],
      },
    });

    renderWithProviders(<CheckoutSuccessPage />, ROUTE, "/checkout/success");

    expect(await screen.findByText(/payment successful/i)).toBeInTheDocument();
    expect(await screen.findByText("ticket-this-session")).toBeInTheDocument();
    expect(mockedGetCheckoutSessionStatusRequest).toHaveBeenCalledWith("cs_test_123");
  });

  it("does not claim success when the hold expired and the payment was refunded", async () => {
    mockedGetCheckoutSessionStatusRequest.mockResolvedValue({
      status: "refunded",
      booking: null,
    });

    renderWithProviders(<CheckoutSuccessPage />, ROUTE, "/checkout/success");

    expect(await screen.findByText(/hold expired/i)).toBeInTheDocument();
    expect(screen.queryByText(/payment successful/i)).not.toBeInTheDocument();
  });

  it("does not claim success when there is no session id to verify against", async () => {
    renderWithProviders(<CheckoutSuccessPage />, "/checkout/success", "/checkout/success");

    expect(await screen.findByText(/can't confirm this payment/i)).toBeInTheDocument();
    expect(screen.queryByText(/payment successful/i)).not.toBeInTheDocument();
    expect(mockedGetCheckoutSessionStatusRequest).not.toHaveBeenCalled();
  });
});
