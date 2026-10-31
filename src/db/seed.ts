import { randomBytes } from "node:crypto";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const [{ seedDatabase, demoUserEmails }, { getDb, getDbPath }] = await Promise.all([
  import("./seed-data"),
  import("./client"),
]);

const password =
  process.env.DEMO_USER_PASSWORD || `demo-${randomBytes(4).toString("hex")}`;
const includeSecondInstitution = process.env.SEED_TEST_INSTITUTION === "1";

seedDatabase({ demoPassword: password, includeSecondInstitution });

const db = getDb();
const users = db.prepare("SELECT COUNT(*) AS count FROM users").get() as {
  count: number;
};
const resources = db.prepare("SELECT COUNT(*) AS count FROM resources").get() as {
  count: number;
};
const bookings = db.prepare("SELECT COUNT(*) AS count FROM bookings").get() as {
  count: number;
};

console.log(`Database: ${getDbPath()}`);
console.log(
  `Seeded accounts (all demo data is fictional). Counts: users=${users.count}, resources=${resources.count}, bookings=${bookings.count}`,
);
for (const account of demoUserEmails()) {
  console.log(`  ${account.role.padEnd(8)} ${account.email}  (${account.name})`);
}
if (!process.env.DEMO_USER_PASSWORD) {
  console.log("");
  console.log("Generated demo password (shown once; set DEMO_USER_PASSWORD to pin it):");
  console.log(`  ${password}`);
} else {
  console.log("Demo password: taken from DEMO_USER_PASSWORD (not printed).");
}
