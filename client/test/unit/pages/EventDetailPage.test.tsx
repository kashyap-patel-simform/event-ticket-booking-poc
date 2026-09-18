import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEventRequest, listSeatsRequest } from "@/features/events/api/events.api";
import EventDetailPage from "@/pages/EventDetailPage";
import { renderWithProviders } from "../../test-utils";

vi.mock("@/features/events/api/events.api");

const mockedGetEventRequest = vi.mocked(getEventRequest);
const mockedListSeatsRequest = vi.mocked(listSeatsRequest);

beforeEach(() => {
  mockedGetEventRequest.mockReset();
  mockedListSeatsRequest.mockReset();
});

describe("EventDetailPage", () => {
  it("renders event info and seats with distinct styling per status", async () => {
    mockedGetEventRequest.mockResolvedValue({
      id: "evt-1",
      organiserId: "u1",
      name: "Concert A",
      date: "2027-01-01T00:00:00.000Z",
      venue: "Arena A",
      priceCents: 2500,
      createdAt: "2026-01-01T00:00:00.000Z",
      seatCounts: { available: 1, held: 1, booked: 1 },
    });
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
});
