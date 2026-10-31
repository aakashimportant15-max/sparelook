import { json, withApi } from "@/lib/api";
import { visibleResource } from "@/server/services/resources";
import { evaluateEligibility } from "@/server/services/eligibility";

export const GET = withApi({}, async ({ user, params }) => {
  const resource = visibleResource(user, params.id);
  const eligibility = evaluateEligibility(user, resource);
  return json({
    eligible: eligibility.eligible,
    reasons: eligibility.reasons,
    rule: "Eligibility checks: account status, resource status, group, trainings, booking limits.",
  });
});
