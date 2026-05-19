import { NextResponse } from "next/server";
import { countAdminUsers, createUser } from "@/lib/db/admin";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const count = await countAdminUsers();
  return NextResponse.json({ required: count === 0 });
}

export async function POST(request: Request) {
  try {
    const count = await countAdminUsers();
    if (count > 0) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
    }

    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || username.length > 64) {
      return NextResponse.json({ error: "Username required (max 64 chars)" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    // H-1: first bootstrap user is admin. Subsequent users created via the
    // admin/users API default to non-admin and must be explicitly elevated.
    const user = await createUser(username, passwordHash, true);
    return NextResponse.json({ success: true, username: user.username }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Setup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
