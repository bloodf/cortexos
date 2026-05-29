import { NextResponse } from "next/server";

const MESSAGE =
  "First-time setup is not used. Dashboard authentication is delegated to Linux PAM; log in with a host system account. Admin access is granted via membership in the cortexos-admin or sudo groups.";

// Under PAM auth there is no DB-seeded admin and no password to set, so setup
// is never required.
export async function GET() {
  return NextResponse.json({ required: false, message: MESSAGE });
}

export async function POST() {
  return NextResponse.json({ error: MESSAGE }, { status: 410 });
}

export const dynamic = "force-dynamic";
