const DEFAULT_AI_SERVICE_URL = "http://localhost:8000";

/** Where the AI service runs, read when a request is made (AI_SERVICE_URL; locally, port 8000). */
export const aiServiceUrl = () => (process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL).replace(/\/+$/, "");
