export type ApiFieldError = { field: string; code: string; message: string };

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    fields?: ApiFieldError[];
    details?: Record<string, unknown>;
    requestId?: string;
  };
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: ApiFieldError[];
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error.message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.error.code;
    this.fields = payload.error.fields ?? [];
    this.details = payload.error.details;
    this.requestId = payload.error.requestId;
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const fallback: ApiErrorPayload = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    };
    throw new ApiError(response.status, (payload as ApiErrorPayload) ?? fallback);
  }
  return payload as T;
}

export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const map: Record<string, string> = {};
  for (const field of error.fields) {
    map[field.field] = field.message;
  }
  return map;
}
