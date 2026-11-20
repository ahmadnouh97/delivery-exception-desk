import { useEffect, useState } from "react";

export function App() {
  const [status, setStatus] = useState("Checking backend");

  useEffect(() => {
    void fetch("/api/health")
      .then((response) => response.ok)
      .catch(() => false)
      .then((available) => {
        setStatus(available ? "Backend available" : "Backend unavailable");
      });
  }, []);

  return (
    <main>
      <h1>Delivery Exception Desk</h1>
      <p role="status">{status}</p>
    </main>
  );
}
