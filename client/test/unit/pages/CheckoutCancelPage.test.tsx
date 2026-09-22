import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CheckoutCancelPage from "@/pages/CheckoutCancelPage";
import { renderWithProviders } from "../../test-utils";

describe("CheckoutCancelPage", () => {
  it("shows a cancelled message and links back to the event when eventId is present", () => {
    renderWithProviders(<CheckoutCancelPage />, "/checkout/cancel?eventId=evt-1", "/checkout/cancel");

    expect(screen.getByText(/payment cancelled/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to event/i })).toHaveAttribute(
      "href",
      "/events/evt-1",
    );
  });

  it("links back to the events list when no eventId is present", () => {
    renderWithProviders(<CheckoutCancelPage />, "/checkout/cancel");

    expect(screen.getByRole("link", { name: /back to events/i })).toHaveAttribute("href", "/");
  });
});
