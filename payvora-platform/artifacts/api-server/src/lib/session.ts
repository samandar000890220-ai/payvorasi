import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

const sessionSecret = process.env["SESSION_SECRET"] ?? "development-only-voice-session-secret";

/**
 * Anonymous signed-cookie session owner, shared by every Payvora API domain.
 * Same cookie the voice routes have always used, so data stays consistent.
 */
export function sessionOwner(req: Request, res: Response): string {
  const raw = req.headers.cookie?.match(/(?:^|;\s*)payvora_voice_session=([^;]+)/)?.[1];
  if (raw) {
    const [id, signature] = raw.split(".");
    if (id && signature) {
      const expected = createHmac("sha256", sessionSecret).update(id).digest("hex");
      if (signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return id;
    }
  }
  const id = randomUUID();
  const signature = createHmac("sha256", sessionSecret).update(id).digest("hex");
  res.setHeader("Set-Cookie", `payvora_voice_session=${id}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`);
  return id;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
