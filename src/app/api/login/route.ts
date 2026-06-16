import { NextResponse } from "next/server";

/**
 * Local login is disabled — authentication is delegated to WWFS-CRM via the
 * shared JWT cookie on `.wallacewang.ca`. Visit https://crm.wallacewang.ca/login
 * and you'll be auto-recognised when you return to management.wallacewang.ca.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "local login disabled",
      hint: "Please sign in at https://crm.wallacewang.ca/login — the session is shared.",
    },
    { status: 410 }
  );
}
