import { useEffect, useState } from "react";

function App() {
  const [apiStatus, setApiStatus] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setApiStatus(data.status ?? "unknown"))
      .catch(() => setApiStatus("unreachable"));
  }, []);

  return (
    <main>
      <h1>Event Booking</h1>
      <p>API status: {apiStatus}</p>
    </main>
  );
}

export default App;
