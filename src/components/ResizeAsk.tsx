"use client";
import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { requestResize } from "@/app/app/actions";

const COMMON = ["Instagram story 1080x1920", "Square post 1080x1080", "LinkedIn 1200x627", "Web banner 1920x600", "Email header 600x200", "A4 print PDF"];

// One tap per size; the list goes straight to the client's designer, free.
export function ResizeAsk({ id }: { id: string }) {
  const [sizes, setSizes] = useState("");
  const toggle = (s: string) => {
    const lines = sizes.split("\n").filter(Boolean);
    setSizes((lines.includes(s) ? lines.filter((l) => l !== s) : [...lines, s]).join("\n"));
  };
  return (
    <ActionForm action={requestResize} submit="Send to my designer" pending="Sending" buttonClass="btn btn-small">
      <input type="hidden" name="id" value={id} />
      <div className="chips">
        {COMMON.map((s) => (
          <button key={s} type="button" className={`chip ${sizes.split("\n").includes(s) ? "on" : ""}`} onClick={() => toggle(s)}>
            {s}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Sizes or formats you need</span>
        <textarea name="sizes" rows={3} required maxLength={2000} value={sizes} onChange={(e) => setSizes(e.target.value)} />
      </label>
    </ActionForm>
  );
}
