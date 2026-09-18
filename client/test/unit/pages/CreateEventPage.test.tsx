import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEventRequest } from "@/features/events/api/events.api";
import { ApiError } from "@/lib/api-client";
import CreateEventPage from "@/pages/CreateEventPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("@/features/events/api/events.api");

const mockedCreateEventRequest = vi.mocked(createEventRequest);

const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function fillForm(date = futureDate) {
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Concert" } });
  fireEvent.change(screen.getByLabelText(/date/i), { target: { value: date } });
  fireEvent.change(screen.getByLabelText(/venue/i), { target: { value: "Arena" } });
  fireEvent.change(screen.getByLabelText(/price/i), { target: { value: "49.99" } });
  fireEvent.change(screen.getByLabelText(/seat count/i), { target: { value: "10" } });
}

beforeEach(() => {
  mockedCreateEventRequest.mockReset();
});

describe("CreateEventPage", () => {
  it("shows validation errors when submitted empty", async () => {
    renderWithProviders(<CreateEventPage />, "/events/new");

    fireEvent.click(screen.getByRole("button", { name: /create event/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(mockedCreateEventRequest).not.toHaveBeenCalled();
  });

  it("rejects a date in the past", async () => {
    renderWithProviders(<CreateEventPage />, "/events/new");

    fillForm(pastDate);
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));

    expect(await screen.findByText(/date must be in the future/i)).toBeInTheDocument();
    expect(mockedCreateEventRequest).not.toHaveBeenCalled();
  });

  it("converts price to cents and creates, redirecting to the new event's detail page", async () => {
    mockedCreateEventRequest.mockResolvedValue({
      id: "evt-1",
      organiserId: "u1",
      name: "Concert",
      date: futureDate,
      venue: "Arena",
      priceCents: 4999,
      createdAt: futureDate,
      seatCounts: { available: 10, held: 0, booked: 0 },
    });

    renderWithProviders(<CreateEventPage />, "/events/new");

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));

    expect(await screen.findByText("Event detail page: evt-1")).toBeInTheDocument();
    expect(mockedCreateEventRequest).toHaveBeenCalledWith(
      expect.objectContaining({ priceCents: 4999, seatCount: 10 }),
    );
  });

  it("shows the server's error message on failure", async () => {
    mockedCreateEventRequest.mockRejectedValue(new ApiError(400, "seatCount must be at least 1"));

    renderWithProviders(<CreateEventPage />, "/events/new");

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));

    expect(await screen.findByText("seatCount must be at least 1")).toBeInTheDocument();
  });
});
