import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router";

function EventDetailMarker() {
  const { eventId } = useParams<{ eventId: string }>();
  return <div>Event detail page: {eventId}</div>;
}

// Renders `ui` at `route` (or `path`, if given a param pattern like "/events/:eventId" differs
// from the concrete initial URL), with "/" and "/events/:eventId" rendering plain marker pages —
// enough to assert a post-success redirect landed on the expected page, without pulling in the
// real router/pages. The "/events/:eventId" marker is skipped when `path` is itself that pattern
// (i.e. when the page under test is the one mounted there) to avoid a duplicate-route collision.
export function renderWithProviders(ui: ReactElement, route: string, path: string = route) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const showEventDetailMarker = path !== "/events/:eventId";

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="/" element={<div>Home page</div>} />
          {showEventDetailMarker && (
            <Route path="/events/:eventId" element={<EventDetailMarker />} />
          )}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
