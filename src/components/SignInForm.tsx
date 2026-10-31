"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/client-api";

export function SignInForm({
  defaultNext,
  initialEmail = "",
}: {
  defaultNext: string;
  initialEmail?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function validate(): boolean {
    const next: { email?: string; password?: string } = {};
    const trimmed = email.trim();
    if (!trimmed) {
      next.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      next.email = "Enter a valid email address, for example name@example.com.";
    }
    if (!password) {
      next.password = "Enter your password.";
    }
    setFieldErrors(next);
    if (next.email) {
      document.getElementById("email")?.focus();
    } else if (next.password) {
      document.getElementById("password")?.focus();
    }
    return !next.email && !next.password;
  }

  function describedBy(field: "email" | "password"): string | undefined {
    const ids = [
      fieldErrors[field] ? `${field}-error` : null,
      error ? "signin-error" : null,
    ].filter(Boolean);
    return ids.length > 0 ? ids.join(" ") : undefined;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      await apiFetch("/api/auth/sign-in", {
        method: "POST",
        json: { email, password },
      });
      router.push(defaultNext.startsWith("/") ? defaultNext : "/catalogue");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not sign in. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {error ? (
        <div
          className="alert alert-error"
          id="signin-error"
          role="alert"
          tabIndex={-1}
          ref={errorRef}
        >
          {error}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          className="input"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldErrors.email) {
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }
          }}
          required
          aria-invalid={fieldErrors.email || error ? true : undefined}
          aria-describedby={describedBy("email")}
        />
        {fieldErrors.email ? (
          <span className="field-error" id="email-error" role="alert">
            {fieldErrors.email}
          </span>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (fieldErrors.password) {
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }
          }}
          required
          aria-invalid={fieldErrors.password || error ? true : undefined}
          aria-describedby={describedBy("password")}
        />
        {fieldErrors.password ? (
          <span className="field-error" id="password-error" role="alert">
            {fieldErrors.password}
          </span>
        ) : null}
      </div>
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
