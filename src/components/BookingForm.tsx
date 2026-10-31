"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ApiError, apiFetch, fieldErrorsFrom } from "@/lib/client-api";

type Reason = { code: string; message: string };

type CreateResponse = {
  booking: { id: string; status: string };
  replay: boolean;
};

function formatWindow(startAt: string, endAt: string, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatter.format(new Date(startAt))} – ${formatter.format(new Date(endAt))}`;
}

export function BookingForm({
  resourceId,
  resourceName,
  timeZone,
  defaultStart,
  defaultEnd,
  minStart,
  maxEnd,
  eligible,
  eligibilityReasons,
}: {
  resourceId: string;
  resourceName: string;
  timeZone: string;
  defaultStart: string;
  defaultEnd: string;
  minStart: string;
  maxEnd: string;
  eligible: boolean;
  eligibilityReasons: Reason[];
}) {
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(defaultEnd);
  const [purpose, setPurpose] = useState("");
  const [joinWaitlist, setJoinWaitlist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ startAt: string; endAt: string } | null>(
    null,
  );
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<CreateResponse["booking"] | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `key-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const conflictHint = useMemo(() => {
    if (!conflict) return null;
    return formatWindow(conflict.startAt, conflict.endAt, timeZone);
  }, [conflict, timeZone]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setConflict(null);
    setReasons([]);
    setFields({});
    try {
      const result = await apiFetch<CreateResponse>("/api/bookings", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        json: { resourceId, startAt, endAt, purpose, joinWaitlist },
      });
      setSuccess(result.booking);
      setIdempotencyKey(crypto.randomUUID());
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFields(fieldErrorsFrom(caught));
        if (caught.code === "BOOKING_CONFLICT") {
          const detail = caught.details?.conflict as
            { startAt: string; endAt: string } | undefined;
          setConflict(detail ?? null);
          setFormError(caught.message);
        } else if (caught.code === "NOT_ELIGIBLE") {
          const list = (caught.details?.reasons as Reason[] | undefined) ?? [];
          setReasons(list);
          setFormError(caught.message);
        } else if (caught.code === "VALIDATION_FAILED") {
          setFormError("Check the highlighted fields and try again.");
        } else {
          setFormError(caught.message);
        }
      } else {
        setFormError("Could not submit the request. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    const statusLabel =
      success.status === "APPROVED"
        ? "Approved automatically"
        : success.status === "WAITLISTED"
          ? "Added to the waitlist"
          : "Sent to the owner for approval";
    return (
      <div className="stack">
        <div className="alert alert-success" role="status">
          <div>
            <strong style={{ display: "block" }}>{statusLabel}</strong>
            Your request for {resourceName} is recorded. You can follow its status from
            your bookings.
          </div>
        </div>
        <div className="row">
          <Link href={`/bookings/${success.id}`} className="btn btn-primary">
            View this booking
          </Link>
          <Link href="/bookings" className="btn btn-secondary">
            All my bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate aria-describedby="booking-help">
      <p className="small muted" id="booking-help" style={{ margin: 0 }}>
        Times use {timeZone.replace("_", " ")} and must land on 15-minute boundaries. A
        request does not guarantee the slot until it is approved.
      </p>

      {formError ? (
        <div className="alert alert-error" role="alert">
          <div>
            <strong style={{ display: "block" }}>{formError}</strong>
            {conflictHint ? (
              <span>
                Conflicting booking: {conflictHint}. Pick a different window or join the
                waitlist.
              </span>
            ) : null}
            {reasons.length > 0 ? (
              <ul>
                {reasons.map((reason) => (
                  <li key={reason.code}>{reason.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="startAt">Start</label>
          <input
            id="startAt"
            type="datetime-local"
            className="input"
            value={startAt}
            min={minStart}
            max={maxEnd}
            step={900}
            onChange={(event) => {
              setStartAt(event.target.value);
              setConflict(null);
            }}
            aria-invalid={fields.startAt ? true : undefined}
            required
          />
          {fields.startAt ? <span className="field-error">{fields.startAt}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="endAt">End</label>
          <input
            id="endAt"
            type="datetime-local"
            className="input"
            value={endAt}
            min={startAt || minStart}
            max={maxEnd}
            step={900}
            onChange={(event) => setEndAt(event.target.value)}
            aria-invalid={fields.endAt ? true : undefined}
            required
          />
          {fields.endAt ? <span className="field-error">{fields.endAt}</span> : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="purpose">Purpose</label>
        <textarea
          id="purpose"
          className="textarea"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          placeholder="What will you use it for? e.g. Shoot a 3-minute documentary interview for the media club."
          maxLength={300}
          aria-invalid={fields.purpose ? true : undefined}
          required
        />
        <span className="hint">
          At least 3 characters. Visible to the resource owner.
        </span>
        {fields.purpose ? <span className="field-error">{fields.purpose}</span> : null}
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={joinWaitlist}
          onChange={(event) => setJoinWaitlist(event.target.checked)}
        />
        If this slot is taken, add me to the waitlist
      </label>

      {!eligible ? (
        <div className="alert alert-warning" role="status">
          <div>
            <strong style={{ display: "block" }}>You are not eligible yet</strong>
            {eligibilityReasons.map((reason) => (
              <div key={reason.code}>{reason.message}</div>
            ))}
            <span className="small">
              The request would be rejected by the server even if submitted.
            </span>
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={busy || !eligible}
      >
        {busy ? "Submitting…" : "Request this slot"}
      </button>
    </form>
  );
}
