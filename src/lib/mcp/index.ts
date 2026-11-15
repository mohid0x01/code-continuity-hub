import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCasesTool from "./tools/list-cases";
import getCaseTool from "./tools/get-case";
import getReconstructionTool from "./tools/get-reconstruction";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "code-continuity-hub",
  title: "Code Continuity Hub",
  version: "0.1.0",
  instructions: "Read the signed-in officer's permitted SCENEIQ FIR cases and reconstruction timelines. Use list_cases first, then get_case or get_reconstruction with a returned job_id.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [listCasesTool, getCaseTool, getReconstructionTool],
});
