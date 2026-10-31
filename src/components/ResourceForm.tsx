"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch, fieldErrorsFrom } from "@/lib/client-api";

export type ResourceFormValues = {
  id?: string;
  name: string;
  type: string;
  assetTag: string;
  location: string;
  description: string;
  accessories: string[];
  maxDurationHours: number;
  approvalRequired: boolean;
  openTime: string | null;
  closeTime: string | null;
  allowedGroups: string[];
  requiredTrainings: string[];
  ownerId: string;
};

function listToText(values: string[]): string {
  return values.join(", ");
}

function textToList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function ResourceForm({
  initial,
  owners,
  mode,
}: {
  initial: ResourceFormValues;
  owners: { id: string; name: string }[];
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [accessories, setAccessories] = useState(listToText(initial.accessories));
  const [groups, setGroups] = useState(listToText(initial.allowedGroups));
  const [trainings, setTrainings] = useState(listToText(initial.requiredTrainings));
  const [openTime, setOpenTime] = useState(initial.openTime ?? "");
  const [closeTime, setCloseTime] = useState(initial.closeTime ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof ResourceFormValues>(key: K, value: ResourceFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setFields({});
    const payload = {
      name: values.name,
      type: values.type,
      assetTag: values.assetTag,
      location: values.location,
      description: values.description,
      accessories: textToList(accessories),
      maxDurationHours: Number(values.maxDurationHours),
      approvalRequired: values.approvalRequired,
      openTime: openTime || null,
      closeTime: closeTime || null,
      allowedGroups: textToList(groups),
      requiredTrainings: textToList(trainings),
      ownerId: values.ownerId,
    };
    try {
      if (mode === "create") {
        const result = await apiFetch<{ resource: { id: string } }>("/api/resources", {
          method: "POST",
          json: payload,
        });
        router.push(`/resources/${result.resource.id}`);
        router.refresh();
        return;
      }
      await apiFetch(`/api/resources/${initial.id}`, { method: "PATCH", json: payload });
      setMessage("Resource updated.");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFields(fieldErrorsFrom(caught));
        setError(caught.message);
      } else {
        setError("Could not save the resource.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="alert alert-success" role="status">
          {message}
        </div>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            className="input"
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            aria-invalid={fields.name ? true : undefined}
            required
          />
          {fields.name ? <span className="field-error">{fields.name}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="assetTag">Asset tag</label>
          <input
            id="assetTag"
            className="input"
            value={values.assetTag}
            onChange={(event) => set("assetTag", event.target.value)}
            placeholder="RB-CAM-011"
            aria-invalid={fields.assetTag ? true : undefined}
            required
          />
          {fields.assetTag ? (
            <span className="field-error">{fields.assetTag}</span>
          ) : null}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="type">Category</label>
          <select
            id="type"
            className="select"
            value={values.type}
            onChange={(event) => set("type", event.target.value)}
          >
            <option value="CAMERA">Camera</option>
            <option value="AUDIO">Audio</option>
            <option value="LIGHTING">Lighting</option>
            <option value="TEST_EQUIPMENT">Test equipment</option>
            <option value="ACCESSORY">Accessory</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ownerId">Owner</label>
          <select
            id="ownerId"
            className="select"
            value={values.ownerId}
            onChange={(event) => set("ownerId", event.target.value)}
            aria-invalid={fields.ownerId ? true : undefined}
          >
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="location">Location</label>
        <input
          id="location"
          className="input"
          value={values.location}
          onChange={(event) => set("location", event.target.value)}
          aria-invalid={fields.location ? true : undefined}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          className="textarea"
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
          aria-invalid={fields.description ? true : undefined}
          required
        />
        {fields.description ? (
          <span className="field-error">{fields.description}</span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="accessories">Accessories tracked at handover</label>
        <input
          id="accessories"
          className="input"
          value={accessories}
          onChange={(event) => setAccessories(event.target.value)}
          placeholder="body, battery, charger, memory card"
        />
        <span className="hint">
          Comma-separated. Each item appears on the checkout checklist.
        </span>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="maxDurationHours">Max booking length (hours)</label>
          <input
            id="maxDurationHours"
            type="number"
            min={1}
            max={720}
            className="input"
            value={values.maxDurationHours}
            onChange={(event) => set("maxDurationHours", Number(event.target.value))}
            aria-invalid={fields.maxDurationHours ? true : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="approval">Approval</label>
          <label className="checkbox" style={{ minHeight: 42 }}>
            <input
              type="checkbox"
              checked={values.approvalRequired}
              onChange={(event) => set("approvalRequired", event.target.checked)}
            />
            Owner approval required before checkout
          </label>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="openTime">Opens (optional)</label>
          <input
            id="openTime"
            type="time"
            className="input"
            value={openTime}
            onChange={(event) => setOpenTime(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="closeTime">Closes (optional)</label>
          <input
            id="closeTime"
            type="time"
            className="input"
            value={closeTime}
            onChange={(event) => setCloseTime(event.target.value)}
            aria-invalid={fields.closeTime ? true : undefined}
          />
          {fields.closeTime ? (
            <span className="field-error">{fields.closeTime}</span>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="groups">Allowed groups (optional)</label>
        <input
          id="groups"
          className="input"
          value={groups}
          onChange={(event) => setGroups(event.target.value)}
          placeholder="media-club, film-dept"
        />
        <span className="hint">Leave empty to allow any member. Comma-separated.</span>
      </div>

      <div className="field">
        <label htmlFor="trainings">Required training (optional)</label>
        <input
          id="trainings"
          className="input"
          value={trainings}
          onChange={(event) => setTrainings(event.target.value)}
          placeholder="camera-safety"
        />
        <span className="hint">Comma-separated tags. Members must hold every tag.</span>
      </div>

      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Create resource" : "Save changes"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ResourceStatusForm({
  resourceId,
  status,
}: {
  resourceId: string;
  status: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(status);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await apiFetch<{
        resource: { status: string };
        affectedBookings: { id: string; startAt: string; endAt: string }[];
      }>(`/api/resources/${resourceId}/status`, {
        method: "POST",
        json: { status: target, reason: reason || undefined },
      });
      setResult(
        response.affectedBookings.length > 0
          ? `Status updated. ${response.affectedBookings.length} future approved booking(s) are affected — review them.`
          : "Status updated.",
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not change the status.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      {result ? (
        <div className="alert alert-success" role="status">
          {result}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="resource-status">Status</label>
        <select
          id="resource-status"
          className="select"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          <option value="ACTIVE">Available</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="DISABLED">Disabled</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="status-reason">Reason (optional)</label>
        <input
          id="status-reason"
          className="input"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
        />
      </div>
      <button
        type="submit"
        className="btn btn-secondary"
        disabled={busy || target === status}
      >
        {busy ? "Updating…" : "Change status"}
      </button>
    </form>
  );
}
