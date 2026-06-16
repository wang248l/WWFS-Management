import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

/**
 * Cross-app SSO with WWFS-CRM (sole identity provider for *.wallacewang.ca).
 *
 * CRM signs a JWT with its `JWT_SECRET` and sets it as the `crm_session` cookie
 * on `Domain=.wallacewang.ca`. This app shares the same secret (as `AUTH_SECRET`)
 * and the same cookie domain, so it trusts that cookie, decodes the JWT, and
 * lazily mirrors the CRM user into its own `User` table on first sight.
 *
 * There is no local login — authentication is delegated to CRM entirely.
 */

const CRM_COOKIE = "crm_session";
const MGMT_COOKIE = "wwfs_management_session"; // reserved; not currently issued

export type SessionPayload = {
  id: string;
  username: string;
  displayName: string;
  role: string;
};

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error("AUTH_SECRET env var is required and must be at least 16 chars.");
  }
  return new TextEncoder().encode(raw);
}

/**
 * Decode a token using the shared secret. Accepts the CRM JWT shape
 * `{id, email, name, role}`; also tolerates a legacy `{sub, username, role}`.
 */
async function decodeAnyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.id && payload.email) {
      return {
        id: String(payload.id),
        username: String(payload.email),
        displayName: String(payload.name || payload.email),
        role: String(payload.role || "member"),
      };
    }
    if (payload.sub && payload.username) {
      return {
        id: String(payload.sub),
        username: String(payload.username),
        displayName: String(payload.username),
        role: String(payload.role || "member"),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  return await decodeAnyToken(token);
}

export async function clearSessionCookie() {
  const baseOpts: Parameters<ReturnType<typeof cookies>["set"]>[2] = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
  const store = cookies();
  if (process.env.COOKIE_DOMAIN) {
    store.set(CRM_COOKIE, "", { ...baseOpts, domain: process.env.COOKIE_DOMAIN });
    store.set(MGMT_COOKIE, "", { ...baseOpts, domain: process.env.COOKIE_DOMAIN });
  } else {
    store.set(CRM_COOKIE, "", baseOpts);
    store.set(MGMT_COOKIE, "", baseOpts);
  }
}

/**
 * Roles permitted into the management console. Configured via ALLOWED_ROLES
 * (comma-separated). Defaults to admin-only. Extend to "admin,hr,manager" once
 * CRM starts issuing those roles.
 */
export function allowedRoles(): string[] {
  return (process.env.ALLOWED_ROLES || "admin")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the currently authenticated user, lazily mirroring the CRM user into
 * this app's `User` table. Does NOT enforce role — call `canAccess` for that.
 */
export async function getCurrentUser() {
  const store = cookies();
  const token = store.get(CRM_COOKIE)?.value || store.get(MGMT_COOKIE)?.value;
  if (!token) return null;
  const session = await decodeAnyToken(token);
  if (!session) return null;

  const role = session.role.toLowerCase();
  const user = await db.user.upsert({
    where: { id: session.id },
    update: { username: session.username, displayName: session.displayName, role },
    create: {
      id: session.id,
      username: session.username,
      passwordHash: "__sso__", // never validated; auth happens in CRM
      displayName: session.displayName,
      role,
    },
  });
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

export function canAccess(role: string | undefined | null): boolean {
  if (!role) return false;
  return allowedRoles().includes(role.toLowerCase());
}

export const SESSION_COOKIE = CRM_COOKIE;
