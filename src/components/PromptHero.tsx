"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Real kinds of request, typed out as examples until the visitor starts typing.
const EXAMPLES = [
  "A pitch deck for our seed round",
  "Social ads for our Christmas launch",
  "Our annual report, 40 pages",
  "Branding for a conference in Lagos",
  "A new logo and brand guide",
  "Packaging for three products",
];

// The hero is the product: say what you need, and the demo starts with it.
export function PromptHero({ id = "need", label = "Start a project" }: { id?: string; label?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(EXAMPLES[0]);
  const typing = useRef(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    let n = EXAMPLES[0].length;
    let deleting = true;
    let pause = 28;
    const t = setInterval(() => {
      if (!typing.current) return;
      if (pause > 0) {
        pause -= 1;
        return;
      }
      const word = EXAMPLES[i];
      if (deleting) {
        n -= 1;
        if (n <= 0) {
          deleting = false;
          i = (i + 1) % EXAMPLES.length;
          n = 0;
          pause = 4;
        }
      } else {
        n += 1;
        if (n >= EXAMPLES[i].length) {
          deleting = true;
          pause = 32;
        }
      }
      setShown((deleting ? word : EXAMPLES[i]).slice(0, Math.max(0, n)));
    }, 55);
    return () => clearInterval(t);
  }, []);

  return (
    <form
      className="prompt-form"
      onSubmit={(e) => {
        e.preventDefault();
        const need = value.trim();
        router.push(need ? `/demo?need=${encodeURIComponent(need)}` : "/demo");
      }}
    >
      <label className="skip" htmlFor={id}>
        What do you need designed?
      </label>
      <input
        id={id}
        className="prompt-input"
        value={value}
        maxLength={300}
        autoComplete="off"
        placeholder={shown || " "}
        onFocus={() => (typing.current = false)}
        onBlur={() => (typing.current = value === "")}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn">
        {label}
      </button>
    </form>
  );
}
