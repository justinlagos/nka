"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { safeFileName, fileSize } from "@/lib/format";
import { recordAttachment } from "@/app/app/actions";

const MAX = 500 * 1024 * 1024;

type Row = { name: string; state: "uploading" | "done" | "error"; note?: string };

export async function uploadToStorage(orgId: string, folder: string, file: File) {
  const path = `${orgId}/${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await supabaseBrowser()
    .storage.from("files")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

// Drop or pick files; each goes to storage, then gets recorded against the project or brand book.
export function Uploader({
  orgId,
  projectId,
  kind,
  label = "Add files",
}: {
  orgId: string;
  projectId: string | null;
  kind: "reference" | "brand";
  label?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [over, setOver] = useState(false);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setRows(list.map((f) => ({ name: f.name, state: "uploading" })));
    await Promise.all(
      list.map(async (file, i) => {
        const set = (r: Partial<Row>) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, ...r } : x)));
        if (file.size > MAX) return set({ state: "error", note: `${fileSize(file.size)} is over the 500 MB limit` });
        try {
          const path = await uploadToStorage(orgId, projectId ?? "brand", file);
          const res = await recordAttachment({
            orgId,
            projectId,
            kind,
            path,
            fileName: file.name,
            mime: file.type,
            size: file.size,
          });
          set(res.ok ? { state: "done" } : { state: "error", note: res.error });
        } catch (e) {
          set({ state: "error", note: e instanceof Error ? e.message : "Upload failed" });
        }
      }),
    );
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div
      className={`drop ${over ? "is-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
    >
      <p style={{ margin: 0, maxWidth: "none" }}>
        Drop files here or{" "}
        <label>
          {label.toLowerCase()}
          <input ref={input} type="file" multiple onChange={(e) => handle(e.target.files)} />
        </label>
        . Up to 500 MB each.
      </p>
      {rows.length > 0 && (
        <ul className="upload-list" aria-live="polite">
          {rows.map((r, i) => (
            <li key={i}>
              {r.name}:{" "}
              {r.state === "uploading" ? "uploading…" : r.state === "done" ? "added" : <span style={{ color: "var(--laterite)" }}>{r.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
