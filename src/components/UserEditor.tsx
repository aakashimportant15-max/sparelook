"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/client-api";
import { Badge, RoleBadge } from "@/components/Badges";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  groups: string[];
  trainings: string[];
};

export function UserEditor({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState(user.groups.join(", "));
  const [trainings, setTrainings] = useState(user.trainings.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingSuspend, setConfirmingSuspend] = useState(false);

  const suspended = user.status === "SUSPENDED";

  function toList(value: string): string[] {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  async function saveTags(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("tags");
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/admin/users/${user.id}/tags`, {
        method: "PATCH",
        json: { groups: toList(groups), trainings: toList(trainings) },
      });
      setMessage("Access tags saved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save tags.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus() {
    setBusy("status");
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        json: { status: suspended ? "ACTIVE" : "SUSPENDED" },
      });
      setMessage(
        suspended
          ? "Member reactivated. They can sign in again."
          : "Member suspended. Their active sessions were signed out.",
      );
      setConfirmingSuspend(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not change status.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card card-pad">
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="row" style={{ gap: 8 }}>
            <strong>{user.name}</strong>
            <RoleBadge role={user.role} />
            {suspended ? <Badge tone="red">Suspended</Badge> : null}
            {isSelf ? <Badge tone="teal">You</Badge> : null}
          </div>
          <div className="tiny mono muted">{user.email}</div>
          <div className="pill-list" style={{ marginTop: 8 }}>
            {user.groups.length === 0 && user.trainings.length === 0 ? (
              <span className="tiny muted">No group or training tags</span>
            ) : null}
            {user.groups.map((tag) => (
              <span className="pill" key={`g-${tag}`}>
                group: {tag}
              </span>
            ))}
            {user.trainings.map((tag) => (
              <span className="pill warn" key={`t-${tag}`}>
                training: {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setOpen(!open)}
          >
            {open ? "Close" : "Manage access"}
          </button>
          <button
            type="button"
            className={
              suspended ? "btn btn-secondary btn-sm" : "btn btn-danger-ghost btn-sm"
            }
            onClick={() => (suspended ? toggleStatus() : setConfirmingSuspend(true))}
            disabled={busy !== null || isSelf}
            title={isSelf ? "You cannot change your own account status" : undefined}
          >
            {busy === "status"
              ? "Updating…"
              : suspended
                ? "Reactivate"
                : "Suspend"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="alert alert-success" role="status" style={{ marginTop: 12 }}>
          {message}
        </div>
      ) : null}

      {confirmingSuspend ? (
        <div className="alert alert-warning" role="alert" style={{ marginTop: 12 }}>
          <p className="small" style={{ marginTop: 0 }}>
            Suspend <strong>{user.name}</strong>? They will be signed out immediately and
            will not be able to sign in again until the account is reactivated. Their
            bookings and history are kept.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={toggleStatus}
              disabled={busy !== null}
            >
              {busy === "status" ? "Suspending…" : "Confirm suspension"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConfirmingSuspend(false)}
              disabled={busy !== null}
            >
              Keep active
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <form className="form" onSubmit={saveTags} style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor={`groups-${user.id}`}>Group tags</label>
            <input
              id={`groups-${user.id}`}
              className="input"
              value={groups}
              onChange={(event) => setGroups(event.target.value)}
              placeholder="media-club, film-dept"
            />
            <span className="hint">
              Comma-separated. Group tags gate restricted resources.
            </span>
          </div>
          <div className="field">
            <label htmlFor={`trainings-${user.id}`}>Training tags</label>
            <input
              id={`trainings-${user.id}`}
              className="input"
              value={trainings}
              onChange={(event) => setTrainings(event.target.value)}
              placeholder="camera-safety, drone-safety"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={busy !== null}
          >
            {busy === "tags" ? "Saving…" : "Save access tags"}
          </button>
        </form>
      ) : null}
    </article>
  );
}
