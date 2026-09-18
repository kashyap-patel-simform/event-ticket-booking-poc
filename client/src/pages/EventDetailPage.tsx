import { useParams } from "react-router";

function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  return (
    <div className="p-6">
      <h1>Event {eventId}</h1>
    </div>
  );
}

export default EventDetailPage;
