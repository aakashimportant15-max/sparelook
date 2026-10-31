import bcrypt from "bcryptjs";
import { getDb } from "./client";
import { zonedParts, zonedTimeToUtc } from "../lib/time";
import type { BookingStatus, Condition, Role } from "../domain/types";

export const DEMO_INSTITUTION_ID = "inst-riverbend";
export const TEST_INSTITUTION_ID = "inst-lakeside";

export type SeedOptions = {
  demoPassword: string;
  includeSecondInstitution?: boolean;
  /** Fixed "now" for deterministic tests; defaults to the real clock. */
  now?: Date;
  /** bcrypt cost factor; tests lower it to keep seeds fast. */
  hashRounds?: number;
};

export type SeedResult = { seeded: boolean; institutionId: string };

type SeedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  tags: { kind: "GROUP" | "TRAINING"; tag: string }[];
  status?: "ACTIVE" | "SUSPENDED";
};

const USERS: SeedUser[] = [
  {
    id: "u-meera",
    name: "Meera Iyer",
    email: "meera@riverbend-demo.example",
    role: "ADMIN",
    tags: [],
  },
  {
    id: "u-kabir",
    name: "Dr. Kabir Rao",
    email: "kabir@riverbend-demo.example",
    role: "OWNER",
    tags: [
      { kind: "GROUP", tag: "media-club" },
      { kind: "TRAINING", tag: "camera-safety" },
    ],
  },
  {
    id: "u-nikhil",
    name: "Nikhil Shah",
    email: "nikhil@riverbend-demo.example",
    role: "OWNER",
    tags: [
      { kind: "GROUP", tag: "ece-dept" },
      { kind: "TRAINING", tag: "lab-safety" },
    ],
  },
  {
    id: "u-ananya",
    name: "Ananya Das",
    email: "ananya@riverbend-demo.example",
    role: "BORROWER",
    tags: [
      { kind: "GROUP", tag: "media-club" },
      { kind: "TRAINING", tag: "camera-safety" },
    ],
  },
  {
    id: "u-rohan",
    name: "Rohan Mehta",
    email: "rohan@riverbend-demo.example",
    role: "BORROWER",
    tags: [
      { kind: "GROUP", tag: "media-club" },
      { kind: "TRAINING", tag: "camera-safety" },
    ],
  },
  {
    id: "u-isha",
    name: "Isha Kulkarni",
    email: "isha@riverbend-demo.example",
    role: "BORROWER",
    tags: [
      { kind: "GROUP", tag: "film-dept" },
      { kind: "TRAINING", tag: "camera-safety" },
      { kind: "TRAINING", tag: "drone-safety" },
    ],
  },
  {
    id: "u-dev",
    name: "Dev Malhotra",
    email: "dev@riverbend-demo.example",
    role: "BORROWER",
    tags: [],
  },
  {
    id: "u-sana",
    name: "Sana Qureshi",
    email: "sana@riverbend-demo.example",
    role: "BORROWER",
    tags: [
      { kind: "GROUP", tag: "media-club" },
      { kind: "TRAINING", tag: "camera-safety" },
    ],
  },
];

const CAMERA_KIT_ACCESSORIES = [
  "Camera body",
  "2 batteries",
  "Charger",
  "Lens cap",
  "Memory card",
  "Strap",
];

type SeedResource = {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  assetTag: string;
  location: string;
  description: string;
  accessories: string[];
  status: "ACTIVE" | "MAINTENANCE" | "DISABLED" | "ARCHIVED";
  approvalRequired: boolean;
  maxDurationHours: number;
  openTime: string | null;
  closeTime: string | null;
  allowedGroups: string[];
  requiredTrainings: string[];
};

const RESOURCES: SeedResource[] = [
  {
    id: "r01",
    ownerId: "u-kabir",
    name: "Mirrorless Camera Kit A",
    type: "CAMERA",
    assetTag: "RB-CAM-001",
    location: "Media Lab, Room 204",
    description:
      "Mirrorless camera kit for club shoots and coursework. Includes body, two batteries, charger, lens cap, memory card and strap.",
    accessories: CAMERA_KIT_ACCESSORIES,
    status: "ACTIVE",
    approvalRequired: true,
    maxDurationHours: 48,
    openTime: "08:00",
    closeTime: "20:00",
    allowedGroups: ["media-club", "film-dept"],
    requiredTrainings: ["camera-safety"],
  },
  {
    id: "r02",
    ownerId: "u-kabir",
    name: "Mirrorless Camera Kit B",
    type: "CAMERA",
    assetTag: "RB-CAM-002",
    location: "Media Lab, Room 204",
    description:
      "Second mirrorless camera kit with the same rules as Kit A. Used for overlapping club shoots.",
    accessories: CAMERA_KIT_ACCESSORIES,
    status: "ACTIVE",
    approvalRequired: true,
    maxDurationHours: 48,
    openTime: "08:00",
    closeTime: "20:00",
    allowedGroups: ["media-club", "film-dept"],
    requiredTrainings: ["camera-safety"],
  },
  {
    id: "r03",
    ownerId: "u-kabir",
    name: "Cinema Camcorder",
    type: "CAMERA",
    assetTag: "RB-CAM-003",
    location: "Media Lab, Room 204",
    description: "Cinema camcorder for film department productions.",
    accessories: ["Camcorder body", "Battery", "Charger", "Carry case"],
    status: "ACTIVE",
    approvalRequired: true,
    maxDurationHours: 72,
    openTime: "08:00",
    closeTime: "20:00",
    allowedGroups: ["film-dept"],
    requiredTrainings: ["camera-safety"],
  },
  {
    id: "r04",
    ownerId: "u-kabir",
    name: "Camera Drone with Controller",
    type: "CAMERA",
    assetTag: "RB-CAM-004",
    location: "Equipment Store, Block B",
    description: "Camera drone kit for outdoor shoots. Drone safety training required.",
    accessories: ["Drone", "Controller", "2 batteries", "Propeller guards", "Carry case"],
    status: "ACTIVE",
    approvalRequired: true,
    maxDurationHours: 24,
    openTime: "07:00",
    closeTime: "18:00",
    allowedGroups: ["media-club", "film-dept"],
    requiredTrainings: ["drone-safety"],
  },
  {
    id: "r05",
    ownerId: "u-kabir",
    name: "Tripod and Gimbal Set",
    type: "ACCESSORY",
    assetTag: "RB-ACC-005",
    location: "Equipment Store, Block B",
    description:
      "Tripod and gimbal set, open to all members. Low-risk item with automatic approval.",
    accessories: ["Tripod", "Gimbal", "Quick-release plate"],
    status: "ACTIVE",
    approvalRequired: false,
    maxDurationHours: 72,
    openTime: null,
    closeTime: null,
    allowedGroups: [],
    requiredTrainings: [],
  },
  {
    id: "r06",
    ownerId: "u-kabir",
    name: "Portable LED Lighting Kit",
    type: "LIGHTING",
    assetTag: "RB-LGT-006",
    location: "Media Lab, Room 204",
    description: "Two-panel portable LED lighting kit with stands and diffusers.",
    accessories: ["2 LED panels", "Stands", "Power cables", "Diffusers"],
    status: "ACTIVE",
    approvalRequired: true,
    maxDurationHours: 48,
    openTime: "08:00",
    closeTime: "20:00",
    allowedGroups: ["media-club", "film-dept"],
    requiredTrainings: [],
  },
  {
    id: "r07",
    ownerId: "u-kabir",
    name: "Field Audio Recorder Kit",
    type: "AUDIO",
    assetTag: "RB-AUD-007",
    location: "Media Lab, Room 204",
    description: "Field audio recorder with two microphones and monitoring headphones.",
    accessories: ["Recorder", "2 microphones", "Cables", "Headphones"],
    status: "ACTIVE",
    approvalRequired: true,
    maxDurationHours: 48,
    openTime: "08:00",
    closeTime: "20:00",
    allowedGroups: ["media-club", "film-dept"],
    requiredTrainings: [],
  },
  {
    id: "r08",
    ownerId: "u-nikhil",
    name: "Digital Oscilloscope",
    type: "TEST_EQUIPMENT",
    assetTag: "RB-TST-008",
    location: "Electronics Lab, Room 110",
    description:
      "Digital oscilloscope for electronics coursework. Restricted to the ECE department with lab safety training.",
    accessories: ["Oscilloscope", "2 probes", "Power cable"],
    status: "ACTIVE",
    approvalRequired: true,
    maxDurationHours: 24,
    openTime: "09:00",
    closeTime: "17:00",
    allowedGroups: ["ece-dept"],
    requiredTrainings: ["lab-safety"],
  },
  {
    id: "r09",
    ownerId: "u-nikhil",
    name: "Thermal Imaging Camera",
    type: "TEST_EQUIPMENT",
    assetTag: "RB-TST-009",
    location: "Electronics Lab, Room 110",
    description: "Thermal imaging camera currently under maintenance.",
    accessories: ["Thermal camera", "Battery", "Charger"],
    status: "MAINTENANCE",
    approvalRequired: true,
    maxDurationHours: 24,
    openTime: "09:00",
    closeTime: "17:00",
    allowedGroups: ["ece-dept"],
    requiredTrainings: ["lab-safety"],
  },
  {
    id: "r10",
    ownerId: "u-nikhil",
    name: "Legacy DSLR Kit",
    type: "CAMERA",
    assetTag: "RB-CAM-010",
    location: "Equipment Store, Block B",
    description: "Older DSLR kit retained for history only. Archived and not bookable.",
    accessories: ["DSLR body", "Lens", "Battery", "Strap"],
    status: "ARCHIVED",
    approvalRequired: true,
    maxDurationHours: 48,
    openTime: null,
    closeTime: null,
    allowedGroups: [],
    requiredTrainings: [],
  },
];

type SeedReport = {
  condition: Condition;
  checklist: Record<string, "PRESENT" | "MISSING">;
  notes: string;
  at: Date;
};

type SeedBooking = {
  id: string;
  resourceId: string;
  requesterId: string;
  start: Date;
  end: Date;
  purpose: string;
  status: BookingStatus;
  createdAt: Date;
  decidedAt?: Date;
  decidedBy?: string;
  decisionReason?: string;
  discrepancy?: boolean;
  late?: boolean;
  checkout?: SeedReport;
  ret?: SeedReport;
};

function checklistFor(items: string[], missing: string[] = []) {
  const checklist: Record<string, "PRESENT" | "MISSING"> = {};
  for (const item of items)
    checklist[item] = missing.includes(item) ? "MISSING" : "PRESENT";
  return checklist;
}

export function seedDatabase(options: SeedOptions): SeedResult {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM institutions WHERE id = ?")
    .get(DEMO_INSTITUTION_ID) as { id: string } | undefined;
  if (existing) {
    return { seeded: false, institutionId: DEMO_INSTITUTION_ID };
  }

  const passwordHash = bcrypt.hashSync(options.demoPassword, options.hashRounds ?? 10);
  const now = options.now ?? new Date();
  const institutionTimeZone = process.env.INSTITUTION_TIMEZONE || "Asia/Kolkata";

  const localDay = (offsetDays: number, hour: number, minute: number): Date => {
    const p = zonedParts(now, institutionTimeZone);
    const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + offsetDays));
    return zonedTimeToUtc(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      shifted.getUTCDate(),
      hour,
      minute,
      institutionTimeZone,
    );
  };

  const nextQuarter = (from: Date): Date => {
    const p = zonedParts(from, institutionTimeZone);
    const offsetMinutes = Math.ceil((p.minute + p.second / 60 + 10) / 15) * 15;
    const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, 0));
    shifted.setUTCMinutes(shifted.getUTCMinutes() + offsetMinutes);
    return zonedTimeToUtc(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      shifted.getUTCDate(),
      shifted.getUTCHours(),
      shifted.getUTCMinutes(),
      institutionTimeZone,
    );
  };

  let approvedStart = nextQuarter(now);
  {
    const startParts = zonedParts(approvedStart, institutionTimeZone);
    const startMinutes = startParts.hour * 60 + startParts.minute;
    // R01 opens 08:00-20:00; a four-hour block must finish before closing.
    if (startMinutes < 8 * 60 || startMinutes + 4 * 60 > 20 * 60) {
      approvedStart = localDay(1, 10, 0);
    }
  }
  const approvedEnd = new Date(approvedStart.getTime() + 4 * 3_600_000);

  const returnedBookings: SeedBooking[] = [
    {
      id: "b-hist-1",
      resourceId: "r01",
      requesterId: "u-isha",
      start: localDay(-20, 10, 0),
      end: localDay(-20, 14, 0),
      purpose: "Film department club shoot",
      status: "RETURNED",
      createdAt: localDay(-23, 9, 0),
      decidedAt: localDay(-22, 9, 0),
      decidedBy: "u-kabir",
      checkout: {
        condition: "GOOD",
        checklist: checklistFor(CAMERA_KIT_ACCESSORIES),
        notes: "All accessories present at handover.",
        at: localDay(-20, 9, 45),
      },
      ret: {
        condition: "GOOD",
        checklist: checklistFor(CAMERA_KIT_ACCESSORIES),
        notes: "Returned in the same condition.",
        at: localDay(-20, 14, 5),
      },
    },
    {
      id: "b-hist-2",
      resourceId: "r01",
      requesterId: "u-rohan",
      start: localDay(-13, 10, 0),
      end: localDay(-13, 16, 0),
      purpose: "Media club documentary interviews",
      status: "RETURNED",
      createdAt: localDay(-16, 11, 0),
      decidedAt: localDay(-15, 10, 0),
      decidedBy: "u-kabir",
      discrepancy: true,
      checkout: {
        condition: "GOOD",
        checklist: checklistFor(CAMERA_KIT_ACCESSORIES),
        notes: "Checked out with both batteries.",
        at: localDay(-13, 9, 50),
      },
      ret: {
        condition: "MINOR_WEAR",
        checklist: checklistFor(CAMERA_KIT_ACCESSORIES, ["2 batteries"]),
        notes: "One battery could not be found at return.",
        at: localDay(-13, 16, 10),
      },
    },
    {
      id: "b-hist-3",
      resourceId: "r01",
      requesterId: "u-isha",
      start: localDay(-6, 12, 0),
      end: localDay(-6, 15, 0),
      purpose: "Short film pickup shots",
      status: "RETURNED",
      createdAt: localDay(-9, 14, 0),
      decidedAt: localDay(-8, 9, 0),
      decidedBy: "u-kabir",
      checkout: {
        condition: "GOOD",
        checklist: checklistFor(CAMERA_KIT_ACCESSORIES),
        notes: "Accessories verified at handover.",
        at: localDay(-6, 11, 45),
      },
      ret: {
        condition: "GOOD",
        checklist: checklistFor(CAMERA_KIT_ACCESSORIES),
        notes: "Returned complete.",
        at: localDay(-6, 15, 10),
      },
    },
  ];

  const usageBookings: SeedBooking[] = [
    {
      id: "b-sana-usage-1",
      resourceId: "r07",
      requesterId: "u-sana",
      start: localDay(-25, 9, 0),
      end: localDay(-25, 19, 0),
      purpose: "Campus podcast recording day 1",
      status: "RETURNED",
      createdAt: localDay(-28, 10, 0),
      decidedAt: localDay(-27, 10, 0),
      decidedBy: "u-kabir",
      checkout: {
        condition: "GOOD",
        checklist: checklistFor(RESOURCES[6].accessories),
        notes: "Recorder and microphones verified.",
        at: localDay(-25, 8, 50),
      },
      ret: {
        condition: "GOOD",
        checklist: checklistFor(RESOURCES[6].accessories),
        notes: "Returned complete.",
        at: localDay(-25, 19, 5),
      },
    },
    {
      id: "b-sana-usage-2",
      resourceId: "r07",
      requesterId: "u-sana",
      start: localDay(-18, 9, 0),
      end: localDay(-18, 19, 0),
      purpose: "Campus podcast recording day 2",
      status: "RETURNED",
      createdAt: localDay(-21, 10, 0),
      decidedAt: localDay(-20, 10, 0),
      decidedBy: "u-kabir",
      checkout: {
        condition: "GOOD",
        checklist: checklistFor(RESOURCES[6].accessories),
        notes: "Recorder and microphones verified.",
        at: localDay(-18, 8, 50),
      },
      ret: {
        condition: "GOOD",
        checklist: checklistFor(RESOURCES[6].accessories),
        notes: "Returned complete.",
        at: localDay(-18, 19, 5),
      },
    },
    {
      id: "b-sana-usage-3",
      resourceId: "r07",
      requesterId: "u-sana",
      start: localDay(-11, 9, 0),
      end: localDay(-11, 19, 0),
      purpose: "Campus podcast recording day 3",
      status: "RETURNED",
      createdAt: localDay(-14, 10, 0),
      decidedAt: localDay(-13, 10, 0),
      decidedBy: "u-kabir",
      checkout: {
        condition: "GOOD",
        checklist: checklistFor(RESOURCES[6].accessories),
        notes: "Recorder and microphones verified.",
        at: localDay(-11, 8, 50),
      },
      ret: {
        condition: "GOOD",
        checklist: checklistFor(RESOURCES[6].accessories),
        notes: "Returned complete.",
        at: localDay(-11, 19, 5),
      },
    },
  ];

  const activeBookings: SeedBooking[] = [
    {
      id: "b-approved-r01",
      resourceId: "r01",
      requesterId: "u-rohan",
      start: approvedStart,
      end: approvedEnd,
      purpose: "Media club interview setup",
      status: "APPROVED",
      createdAt: new Date(now.getTime() - 5 * 3_600_000),
      decidedAt: new Date(now.getTime() - 4 * 3_600_000),
      decidedBy: "u-kabir",
    },
    {
      id: "b-wait-isha-r01",
      resourceId: "r01",
      requesterId: "u-isha",
      start: approvedStart,
      end: approvedEnd,
      purpose: "Same shoot window, waiting for a release",
      status: "WAITLISTED",
      createdAt: new Date(now.getTime() - 3 * 3_600_000),
    },
    {
      id: "b-wait-sana-r01",
      resourceId: "r01",
      requesterId: "u-sana",
      start: approvedStart,
      end: approvedEnd,
      purpose: "Backup body for the same shoot window",
      status: "WAITLISTED",
      createdAt: new Date(now.getTime() - 2 * 3_600_000),
    },
    {
      id: "b-active-r06",
      resourceId: "r06",
      requesterId: "u-ananya",
      start: new Date(now.getTime() - 2 * 3_600_000),
      end: new Date(now.getTime() + 4 * 3_600_000),
      purpose: "Lighting for the club recruitment video",
      status: "CHECKED_OUT",
      createdAt: new Date(now.getTime() - 30 * 3_600_000),
      decidedAt: new Date(now.getTime() - 26 * 3_600_000),
      decidedBy: "u-kabir",
      checkout: {
        condition: "GOOD",
        checklist: checklistFor(RESOURCES[5].accessories),
        notes: "All four LED panels and stands verified at handover.",
        at: new Date(now.getTime() - 130 * 60_000),
      },
    },
    {
      id: "b-pending-sana-r02",
      resourceId: "r02",
      requesterId: "u-sana",
      start: localDay(2, 10, 0),
      end: localDay(2, 14, 0),
      purpose: "Podcast video recording",
      status: "PENDING",
      createdAt: new Date(now.getTime() - 2 * 3_600_000),
    },
    {
      id: "b-pending-ananya-r02",
      resourceId: "r02",
      requesterId: "u-ananya",
      start: localDay(2, 10, 0),
      end: localDay(2, 14, 0),
      purpose: "Club recruitment video",
      status: "PENDING",
      createdAt: new Date(now.getTime() - 1 * 3_600_000),
    },
  ];

  const allBookings = [...returnedBookings, ...usageBookings, ...activeBookings];

  const insertInstitution = db.prepare(
    "INSERT INTO institutions (id, name, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  );
  const insertUser = db.prepare(
    `INSERT INTO users (id, institution_id, email, display_name, role, status, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertTag = db.prepare(
    "INSERT INTO user_tags (id, institution_id, user_id, kind, tag, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertResource = db.prepare(
    `INSERT INTO resources (id, institution_id, owner_id, name, type, category, asset_tag, location, description,
      accessories, status, approval_required, max_duration_hours, open_time, close_time, allowed_groups,
      required_trainings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'cameras_technical', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertBooking = db.prepare(
    `INSERT INTO bookings (id, institution_id, resource_id, requester_id, start_at, end_at, purpose, status,
      decision_reason, decided_by, idempotency_key, late, discrepancy, fairness_snapshot, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  );
  const insertHistory = db.prepare(
    `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id, reason_code, reason_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertReport = db.prepare(
    `INSERT INTO condition_reports (id, institution_id, booking_id, type, overall_condition, checklist, notes,
      recorded_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertIncident = db.prepare(
    `INSERT INTO incidents (id, institution_id, resource_id, booking_id, reporter_id, type, severity, description,
      status, resolution_note, resolved_by, resolved_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAudit = db.prepare(
    `INSERT INTO audit_events (id, institution_id, actor_id, action, entity_type, entity_id, outcome, metadata, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS', ?, NULL, ?)`,
  );

  const run = db.transaction(() => {
    const createdAt = now.toISOString();
    insertInstitution.run(
      DEMO_INSTITUTION_ID,
      "Riverbend Institute of Technology (FICTIONAL DEMO)",
      institutionTimeZone,
      createdAt,
      createdAt,
    );

    for (const user of USERS) {
      insertUser.run(
        user.id,
        DEMO_INSTITUTION_ID,
        user.email,
        user.name,
        user.role,
        user.status ?? "ACTIVE",
        passwordHash,
        createdAt,
        createdAt,
      );
      for (const tag of user.tags) {
        insertTag.run(
          `tag_${user.id}_${tag.kind}_${tag.tag}`,
          DEMO_INSTITUTION_ID,
          user.id,
          tag.kind,
          tag.tag,
          createdAt,
        );
      }
    }

    for (const resource of RESOURCES) {
      insertResource.run(
        resource.id,
        DEMO_INSTITUTION_ID,
        resource.ownerId,
        resource.name,
        resource.type,
        resource.assetTag,
        resource.location,
        resource.description,
        JSON.stringify(resource.accessories),
        resource.status,
        resource.approvalRequired ? 1 : 0,
        resource.maxDurationHours,
        resource.openTime,
        resource.closeTime,
        JSON.stringify(resource.allowedGroups),
        JSON.stringify(resource.requiredTrainings),
        createdAt,
        createdAt,
      );
    }

    for (const booking of allBookings) {
      const updatedAt =
        booking.ret?.at.toISOString() ??
        booking.checkout?.at.toISOString() ??
        booking.decidedAt?.toISOString() ??
        booking.createdAt.toISOString();
      insertBooking.run(
        booking.id,
        DEMO_INSTITUTION_ID,
        booking.resourceId,
        booking.requesterId,
        booking.start.toISOString(),
        booking.end.toISOString(),
        booking.purpose,
        booking.status,
        booking.decisionReason ?? null,
        booking.decidedBy ?? null,
        `seed-${booking.id}`,
        booking.late ? 1 : 0,
        booking.discrepancy ? 1 : 0,
        booking.createdAt.toISOString(),
        updatedAt,
      );

      insertHistory.run(
        `hist_${booking.id}_created`,
        booking.id,
        null,
        "PENDING",
        booking.requesterId,
        null,
        null,
        booking.createdAt.toISOString(),
      );
      insertAudit.run(
        `audit_${booking.id}_created`,
        DEMO_INSTITUTION_ID,
        booking.requesterId,
        "booking.created",
        "booking",
        booking.id,
        JSON.stringify({ status: "PENDING" }),
        booking.createdAt.toISOString(),
      );

      if (booking.status === "WAITLISTED") {
        const waitlistedAt = new Date(booking.createdAt.getTime() + 1000);
        insertHistory.run(
          `hist_${booking.id}_waitlisted`,
          booking.id,
          "PENDING",
          "WAITLISTED",
          booking.requesterId,
          "JOINED_WAITLIST",
          null,
          waitlistedAt.toISOString(),
        );
        insertAudit.run(
          `audit_${booking.id}_waitlisted`,
          DEMO_INSTITUTION_ID,
          booking.requesterId,
          "booking.waitlisted",
          "booking",
          booking.id,
          JSON.stringify({ status: "WAITLISTED" }),
          waitlistedAt.toISOString(),
        );
      }

      if (booking.decidedAt && booking.decidedBy) {
        insertHistory.run(
          `hist_${booking.id}_approved`,
          booking.id,
          "PENDING",
          "APPROVED",
          booking.decidedBy,
          null,
          null,
          booking.decidedAt.toISOString(),
        );
        insertAudit.run(
          `audit_${booking.id}_approved`,
          DEMO_INSTITUTION_ID,
          booking.decidedBy,
          "booking.approved",
          "booking",
          booking.id,
          JSON.stringify({ status: "APPROVED" }),
          booking.decidedAt.toISOString(),
        );
      }

      if (booking.checkout) {
        insertReport.run(
          `rep_${booking.id}_checkout`,
          DEMO_INSTITUTION_ID,
          booking.id,
          "CHECKOUT",
          booking.checkout.condition,
          JSON.stringify(booking.checkout.checklist),
          booking.checkout.notes,
          booking.decidedBy ?? "u-kabir",
          booking.checkout.at.toISOString(),
          booking.checkout.at.toISOString(),
        );
        insertHistory.run(
          `hist_${booking.id}_checkout`,
          booking.id,
          "APPROVED",
          "CHECKED_OUT",
          booking.decidedBy ?? "u-kabir",
          null,
          null,
          booking.checkout.at.toISOString(),
        );
        insertAudit.run(
          `audit_${booking.id}_checkout`,
          DEMO_INSTITUTION_ID,
          booking.decidedBy ?? "u-kabir",
          "booking.checked_out",
          "booking",
          booking.id,
          JSON.stringify({ condition: booking.checkout.condition }),
          booking.checkout.at.toISOString(),
        );
      }

      if (booking.ret) {
        insertReport.run(
          `rep_${booking.id}_return`,
          DEMO_INSTITUTION_ID,
          booking.id,
          "RETURN",
          booking.ret.condition,
          JSON.stringify(booking.ret.checklist),
          booking.ret.notes,
          booking.decidedBy ?? "u-kabir",
          booking.ret.at.toISOString(),
          booking.ret.at.toISOString(),
        );
        insertHistory.run(
          `hist_${booking.id}_return`,
          booking.id,
          "CHECKED_OUT",
          "RETURNED",
          booking.decidedBy ?? "u-kabir",
          null,
          null,
          booking.ret.at.toISOString(),
        );
        insertAudit.run(
          `audit_${booking.id}_return`,
          DEMO_INSTITUTION_ID,
          booking.decidedBy ?? "u-kabir",
          "booking.returned",
          "booking",
          booking.id,
          JSON.stringify({
            condition: booking.ret.condition,
            discrepancy: Boolean(booking.discrepancy),
          }),
          booking.ret.at.toISOString(),
        );
      }
    }

    const incidentAt = localDay(-12, 9, 0);
    insertIncident.run(
      "inc-hist-1",
      DEMO_INSTITUTION_ID,
      "r01",
      "b-hist-2",
      "u-kabir",
      "MISSING_ITEM",
      "MEDIUM",
      "One battery was missing when the kit was returned.",
      "RESOLVED",
      "Battery was located in the media lab and returned to the kit.",
      "u-meera",
      localDay(-10, 11, 0).toISOString(),
      incidentAt.toISOString(),
      localDay(-10, 11, 0).toISOString(),
    );
    insertAudit.run(
      "audit_inc_created",
      DEMO_INSTITUTION_ID,
      "u-kabir",
      "incident.created",
      "incident",
      "inc-hist-1",
      JSON.stringify({ type: "MISSING_ITEM", severity: "MEDIUM" }),
      incidentAt.toISOString(),
    );
    insertAudit.run(
      "audit_inc_resolved",
      DEMO_INSTITUTION_ID,
      "u-meera",
      "incident.resolved",
      "incident",
      "inc-hist-1",
      JSON.stringify({ status: "RESOLVED" }),
      localDay(-10, 11, 0).toISOString(),
    );

    if (options.includeSecondInstitution) {
      insertInstitution.run(
        TEST_INSTITUTION_ID,
        "Lakeside Demo College (FICTIONAL TEST FIXTURE)",
        institutionTimeZone,
        createdAt,
        createdAt,
      );
      insertUser.run(
        "u-lake-admin",
        TEST_INSTITUTION_ID,
        "admin@lakeside-demo.example",
        "Lakeside Admin",
        "ADMIN",
        "ACTIVE",
        passwordHash,
        createdAt,
        createdAt,
      );
      insertResource.run(
        "r-lake-1",
        TEST_INSTITUTION_ID,
        "u-lake-admin",
        "Lakeside Camera Kit",
        "CAMERA",
        "RB-LAKE-001",
        "Lakeside Store",
        "Resource that must never appear in Riverbend lists.",
        JSON.stringify(["Camera body"]),
        "ACTIVE",
        1,
        48,
        "08:00",
        "20:00",
        JSON.stringify([]),
        JSON.stringify([]),
        createdAt,
        createdAt,
      );
    }
  });

  run();
  return { seeded: true, institutionId: DEMO_INSTITUTION_ID };
}

export function demoUserEmails(): { email: string; role: Role; name: string }[] {
  return USERS.map((u) => ({ email: u.email, role: u.role, name: u.name }));
}

export function demoResourceNames(): { id: string; name: string }[] {
  return RESOURCES.map((r) => ({ id: r.id, name: r.name }));
}
