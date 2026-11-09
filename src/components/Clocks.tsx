"use client";
import { useEffect, useState } from "react";

const PLACES = [
  { city: "London", zone: "Europe/London" },
  { city: "Lagos", zone: "Africa/Lagos" },
];

// Local time where the studio works. Renders after load so server and browser agree.
export function Clocks() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="clocks" aria-label="Studio local times">
      {PLACES.map((p) => (
        <div key={p.city}>
          <span>{p.city}</span>
          <b>{now ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: p.zone }) : "--:--"}</b>
        </div>
      ))}
    </div>
  );
}
