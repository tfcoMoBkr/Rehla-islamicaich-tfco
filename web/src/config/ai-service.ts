const DEFAULT_AI_SERVICE_URL = "http://localhost:8000";

export const aiServiceUrl = (
  process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL
).replace(/\/+$/, "");
