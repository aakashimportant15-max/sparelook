import { errors } from "../lib/errors";
import type { BookingStatus } from "./types";

export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED", "WAITLISTED", "EXPIRED"],
  WAITLISTED: ["PENDING", "APPROVED", "CANCELLED", "EXPIRED"],
  APPROVED: ["CHECKED_OUT", "CANCELLED"],
  CHECKED_OUT: ["RETURNED"],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
  RETURNED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) throw errors.invalidTransition(from, to);
}

export function isTerminal(status: BookingStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export function isOpen(status: BookingStatus): boolean {
  return status === "PENDING" || status === "APPROVED" || status === "CHECKED_OUT";
}

export function isBlocking(status: BookingStatus): boolean {
  return status === "APPROVED" || status === "CHECKED_OUT";
}
