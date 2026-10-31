"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/client-api";

const NEXT: Record<string, { value: string; label: string; note?: boolean }[]> = {
  OPEN: [{ value: "INVESTIGATING", label: "Start investigating" }],
  INVESTIGATING: [
    { value: "RESOLVED", label: "Mark resolved", note: true },
    { value: "DISMISSED", label: "Dismiss", note: true },
  ],
  RESOLVED: [{ value: "OPEN", label: "Reopen" }],
  DISMISSED: [{ value: "OPEN", label: "Reopen" }],
};

export function IncidentStatusForm({
  incidentId,
  status,
  canReopen,
}: {
  incidentId: string;
  status: string;
  canReopen: boolean;
}) {
  const router = useRouter();
  const options = (NEXT[status] ?? []).filter(
    (option) => option.value !== "OPEN" || canReopen,
  );
  const [selected, setSelected] = useState(options[0]?.value ?? "");
  const target = options.some((option) => option.value === selected)
    ? selected
    : (options[0]?.value ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = options.find((option) => option.value === target);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/incidents/${incidentId}/status`, {
        method: "PATCH",
        json: { status: target, resolutionNote: note || undefined },
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not update the incident.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (options.length === 0) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        No status changes are available to you for this incident.
      </p>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="incident-status">Next status</label>
        <select
          id="incident-status"
          className="select"
          value={target}
          onChange={(event) => setSelected(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {chosen?.note ? (
        <div className="field">
          <label htmlFor="resolutionNote">Resolution note</label>
          <textarea
            id="resolutionNote"
            className="textarea"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            placeholder="What was found and what was decided?"
          />
          <span className="hint">
            At least 5 characters; visible to the borrower involved.
          </span>
        </div>
      ) : null}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy || (chosen?.note && note.trim().length < 5)}
      >
        {busy ? "Updating…" : "Update incident"}
      </button>
    </form>
  );
}
