import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const [{ applySchema }, { getDb, getDbPath }] = await Promise.all([
  import("./schema"),
  import("./client"),
]);

applySchema();
const version = getDb().pragma("user_version", { simple: true });
console.log(`Schema applied to ${getDbPath()} (user_version=${version}).`);
