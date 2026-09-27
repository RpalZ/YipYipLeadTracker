import "server-only";
export function readinessEnabled(): boolean { return process.env.CONVERSATION_READINESS_ENABLED === "true"; }
