"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/client-api";

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      {message}
    </div>
  );
}

export function BookingDecisionActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [overrideReason, setOverrideReason] = useState("");
  const [reason, setReason] = useState("");
  const [needsOverride, setNeedsOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function approve() {
    setBusy("approve");
    setError(null);
    try {
      await apiFetch(`/api/bookings/${bookingId}/approve`, {
        method: "POST",
        json: { overrideReason: overrideReason || undefined },
      });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "OVERRIDE_REQUIRED") {
        setNeedsOverride(true);
        setError(caught.message);
      } else if (caught instanceof ApiError) {
        setError(caught.message);
      } else {
        setError("Could not approve this request.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setError(null);
    try {
      await apiFetch(`/api/bookings/${bookingId}/reject`, {
        method: "POST",
        json: { reason },
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not reject this request.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <ErrorBox message={error} />
      {needsOverride ? (
        <div className="field">
          <label htmlFor="overrideReason">Override reason (required)</label>
          <textarea
            id="overrideReason"
            className="textarea"
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            placeholder="Explain why this request should be approved ahead of the top-ranked request."
            maxLength={300}
          />
          <span className="hint">10–300 characters. Recorded in the audit trail.</span>
        </div>
      ) : null}
      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={approve}
          disabled={busy !== null || (needsOverride && overrideReason.trim().length < 10)}
        >
          {busy === "approve" ? "Approving…" : "Approve request"}
        </button>
        <button
          type="button"
          className="btn btn-danger-ghost"
          onClick={() => setMode(mode === "reject" ? "idle" : "reject")}
          disabled={busy !== null}
        >
          {mode === "reject" ? "Cancel rejection" : "Reject…"}
        </button>
      </div>
      {mode === "reject" ? (
        <div className="stack-sm">
          <div className="field">
            <label htmlFor="rejectReason">Reason for rejection</label>
            <textarea
              id="rejectReason"
              className="textarea"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="The borrower will see this reason."
              maxLength={300}
            />
            <span className="hint">5–300 characters.</span>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={reject}
            disabled={busy !== null || reason.trim().length < 5}
          >
            {busy === "reject" ? "Rejecting…" : "Confirm rejection"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CancelBookingForm({
  bookingId,
  requireReason,
}: {
  bookingId: string;
  requireReason: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        json: { reason: reason || undefined },
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not cancel this booking.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Cancel booking
      </button>
    );
  }

  return (
    <div className="stack-sm">
      <ErrorBox message={error} />
      <div className="field">
        <label htmlFor="cancelReason">
          {requireReason ? "Reason for cancellation" : "Reason (optional)"}
        </label>
        <textarea
          id="cancelReason"
          className="textarea"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          placeholder={
            requireReason
              ? "The borrower will see this reason."
              : "Add a note for the owner if helpful."
          }
        />
      </div>
      <div className="row">
        <button
          type="button"
          className="btn btn-danger"
          onClick={submit}
          disabled={busy || (requireReason && reason.trim().length < 5)}
        >
          {busy ? "Cancelling…" : "Confirm cancellation"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Keep booking
        </button>
      </div>
    </div>
  );
}

export function ConditionForm({
  bookingId,
  mode,
  accessories,
  initialChecklist,
  checkoutCondition,
}: {
  bookingId: string;
  mode: "checkout" | "return";
  accessories: string[];
  initialChecklist?: Record<string, "PRESENT" | "MISSING">;
  checkoutCondition?: string;
}) {
  const router = useRouter();
  const [overall, setOverall] = useState("GOOD");
  const [checklist, setChecklist] = useState<Record<string, "PRESENT" | "MISSING">>(
    () => {
      const base: Record<string, "PRESENT" | "MISSING"> = {};
      for (const item of accessories) base[item] = initialChecklist?.[item] ?? "PRESENT";
      return base;
    },
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/bookings/${bookingId}/${mode}`, {
        method: "POST",
        json: { overallCondition: overall, checklist, notes },
      });
      setDone(true);
      router.replace(`/bookings/${bookingId}?recorded=${mode}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not record the condition.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="alert alert-success" role="status">
        {mode === "checkout"
          ? "Checkout recorded. The booking is now checked out."
          : "Return recorded. Any discrepancy has opened an incident automatically."}
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <ErrorBox message={error} />
      {mode === "return" && checkoutCondition ? (
        <p className="small muted" style={{ margin: 0 }}>
          Checkout condition was{" "}
          <strong>{checkoutCondition.replace("_", " ").toLowerCase()}</strong>. Any
          accessory marked missing now opens an incident.
        </p>
      ) : null}
      <div className="field">
        <label htmlFor={`${mode}-condition`}>Overall condition</label>
        <select
          id={`${mode}-condition`}
          className="select"
          value={overall}
          onChange={(event) => setOverall(event.target.value)}
        >
          <option value="GOOD">Good</option>
          <option value="MINOR_WEAR">Minor wear</option>
          <option value="DAMAGED">Damaged</option>
          <option value="NOT_WORKING">Not working</option>
        </select>
      </div>
      <fieldset>
        <legend>Accessories</legend>
        <div className="stack-sm">
          {accessories.map((item) => (
            <div className="checklist-item" key={item}>
              <span className="small">{item}</span>
              <div
                className="radio-group"
                role="radiogroup"
                aria-label={`${item} status`}
              >
                <label>
                  <input
                    type="radio"
                    name={`item-${item}`}
                    checked={checklist[item] === "PRESENT"}
                    onChange={() =>
                      setChecklist((prev) => ({ ...prev, [item]: "PRESENT" }))
                    }
                  />
                  Present
                </label>
                <label>
                  <input
                    type="radio"
                    name={`item-${item}`}
                    checked={checklist[item] === "MISSING"}
                    onChange={() =>
                      setChecklist((prev) => ({ ...prev, [item]: "MISSING" }))
                    }
                  />
                  Missing
                </label>
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${mode}-notes`}>Notes</label>
        <textarea
          id={`${mode}-notes`}
          className="textarea"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={1000}
          placeholder="Optional notes about the state of the equipment."
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Recording…" : mode === "checkout" ? "Record checkout" : "Record return"}
      </button>
    </form>
  );
}
