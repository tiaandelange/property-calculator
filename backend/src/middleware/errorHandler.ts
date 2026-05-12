import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isProduction } from "../config/env.js";

/**
 * Structured, production-safe error handler.
 *
 * Goals:
 *   1. Never echo raw `err.message` (Prisma column names, internal IDs, etc) to
 *      anonymous callers in production. Those messages happily disclose schema.
 *   2. Always log the full stack server-side, with a short request-correlation
 *      id so a triage engineer can match the log line to the user's complaint.
 *   3. Map a small set of known error shapes (zod, JSON body parse failure,
 *      payload too large) to deterministic 4xx responses instead of 500.
 */

let errorIdCounter = 0;
function makeErrorId(): string {
  errorIdCounter = (errorIdCounter + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${errorIdCounter.toString(36)}`;
}

function isBodyParserError(err: any): boolean {
  if (!err || typeof err !== "object") return false;
  if (err.type === "entity.too.large") return true;
  if (err.type === "entity.parse.failed") return true;
  return typeof err.status === "number" && err.status === 400 && err.expose === true;
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: "Not found", path: req.path });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const errorId = makeErrorId();

  if (err instanceof ZodError) {
    if (isProduction) {
      console.warn(`[error:${errorId}] ZodError ${req.method} ${req.path}`);
      return res.status(400).json({ message: "Invalid request body.", errorId });
    }
    return res.status(400).json({
      message: "Invalid request body.",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      errorId
    });
  }

  if (isBodyParserError(err)) {
    if (err.type === "entity.too.large") {
      console.warn(`[error:${errorId}] Body too large ${req.method} ${req.path}`);
      return res.status(413).json({ message: "Request body too large.", errorId });
    }
    console.warn(`[error:${errorId}] Body parse failed ${req.method} ${req.path}`);
    return res.status(400).json({ message: "Malformed request body.", errorId });
  }

  console.error(`[error:${errorId}] ${req.method} ${req.path}`, err?.stack ?? err);

  if (isProduction) {
    return res.status(500).json({ message: "Internal server error.", errorId });
  }

  const devMessage = typeof err?.message === "string" ? err.message : "Internal server error";
  return res.status(500).json({ message: devMessage, errorId });
}
