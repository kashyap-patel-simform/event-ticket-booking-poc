import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listEventsRequest } from "@/features/events/api/events.api";
import EventsListPage from "@/pages/EventsListPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("@/features/events/api/events.api");

const mockedListEventsRequest = vi.mocked(listEventsRequest);

beforeEach(() => {
  mockedListEventsRequest.mockReset();
});

describe("EventsListPage", () => {
  it("renders events returned by the API", async () => {
    mockedListEventsRequest.mockResolvedValue({
      data: [
        {
          id: "evt-1",
          name: "Concert A",
          date: "2027-01-01T00:00:00.000Z",
          venue: "Arena A",
          priceCents: 2500,
          organiserId: "u1",
          seatCount: 50,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    });

    renderWithProviders(<EventsListPage />, "/");

    expect(await screen.findByText("Concert A")).toBeInTheDocument();
    expect(screen.getByText("Arena A")).toBeInTheDocument();
    expect(screen.getByText(/\$25\.00/)).toBeInTheDocument();
    expect(screen.getByText(/50 seats/)).toBeInTheDocument();
  });

  it("shows a message when there are no events", async () => {
    mockedListEventsRequest.mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 });

    renderWithProviders(<EventsListPage />, "/");

    expect(await screen.findByText(/no events yet/i)).toBeInTheDocument();
  });

  it("paginates: Next requests the next page, Previous is disabled on page 1", async () => {
    mockedListEventsRequest.mockResolvedValue({
      data: [
        {
          id: "evt-1",
          name: "Concert A",
          date: "2027-01-01T00:00:00.000Z",
          venue: "Arena A",
          priceCents: 2500,
          organiserId: "u1",
          seatCount: 50,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      page: 1,
      limit: 1,
      total: 2,
    });

    renderWithProviders(<EventsListPage />, "/");

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(mockedListEventsRequest).toHaveBeenCalledWith({ page: 2, limit: 20 });
  });

  it('has a "Create Event" link to /events/new', async () => {
    mockedListEventsRequest.mockResolvedValue({ data: [], page: 1, limit: 20, total: 0 });

    renderWithProviders(<EventsListPage />, "/");

    expect(await screen.findByRole("link", { name: /create event/i })).toHaveAttribute(
      "href",
      "/events/new",
    );
  });
});
