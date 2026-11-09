"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadToStorage } from "@/components/Uploader";
import { addDeliverable } from "@/app/admin/actions";

// Studio side: upload a file for the client to review. Same title means a new version.
export function DeliverableUploader({ projectId, orgId, titles }: { projectId: string; orgId: string; titles: string[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!file || !title.trim()) {
      setMsg({ ok: false, text: "Choose a file and give it a title." });
      return;
    }
    setMsg(null);
    start(async () => {
      try {
        const path = await uploadToStorage(orgId, projectId, file);
        const res = await addDeliverable({ projectId, title, path, fileName: file.name, mime: file.type, size: file.size, note });
        setMsg({ ok: Boolean(res.ok), text: res.ok ? res.message ?? "Uploaded." : res.error ?? "Upload failed." });
        if (res.ok) {
          setFile(null);
          setNote("");
          router.refresh();
        }
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : "Upload failed." });
      }
    });
  }

  return (
    <div>
      <label className="field">
        <span>Title</span>
        <input type="text" list={`titles-${projectId}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Booth back wall" />
        <datalist id={`titles-${projectId}`}>
          {titles.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <span className="hint">Reuse a title to upload a new version.</span>
      </label>
      <label className="field">
        <span>File</span>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <label className="field">
        <span>Note for the client</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </label>
      <div className="form-foot">
        <button type="button" className="btn btn-small" onClick={submit} disabled={pending}>
          {pending ? "Uploading…" : "Upload for review"}
        </button>
        {msg && (
          <p className={`form-result ${msg.ok ? "" : "is-error"}`} role="status">
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
