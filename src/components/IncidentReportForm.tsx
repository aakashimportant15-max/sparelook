"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch, fieldErrorsFrom } from "@/lib/client-api";

export function IncidentReportForm({
  resourceId,
  bookingId,
}: {
  resourceId: string;
  bookingId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("DAMAGE");
  const [severity, setSeverity] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const result = await apiFetch<{ incident: { id: string } }>("/api/incidents", {
        method: "POST",
        json: { resourceId, bookingId, type, severity, description },
      });
      setCreatedId(result.incident.id);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFields(fieldErrorsFrom(caught));
        setError(caught.message);
      } else {
        setError("Could not report the incident.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (createdId) {
    return (
      <div className="alert alert-success" role="status">
        Incident recorded. <Link href={`/incidents/${createdId}`}>Open the incident</Link>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Report an issue with this booking
      </button>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="field-row">
        <div className="field">
          <label htmlFor="incident-type">Type</label>
          <select
            id="incident-type"
            className="select"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="DAMAGE">Damage</option>
            <option value="MISSING_ITEM">Missing item</option>
            <option value="LATE_RETURN">Late return</option>
            <option value="CONDITION_DISPUTE">Condition dispute</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="incident-severity">Severity</label>
          <select
            id="incident-severity"
            className="select"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="incident-description">What happened?</label>
        <textarea
          id="incident-description"
          className="textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
          minLength={10}
          placeholder="Describe the issue without including personal or sensitive information."
          aria-invalid={fields.description ? true : undefined}
          required
        />
        {fields.description ? (
          <span className="field-error">{fields.description}</span>
        ) : null}
        <span className="hint">
          10–2000 characters. Visible to the owner and administrators.
        </span>
      </div>
      <div className="row">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || description.trim().length < 10}
        >
          {busy ? "Submitting…" : "Submit incident"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
