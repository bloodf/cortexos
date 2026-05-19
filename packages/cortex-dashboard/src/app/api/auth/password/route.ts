import { NextResponse } from "next/server";
import {
  getCurrentSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { getUserById, updateUserPassword } from "@/lib/db/admin";

export async function GET() {
  return new NextResponse(
    JSON.stringify({ error: "Method not allowed" }),
    {
      status: 405,
      headers: { Allow: "POST", "Content-Type": "application/json" },
    },
  );
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      !newPassword ||
      newPassword.length < 8
    ) {
      return NextResponse.json(
        { error: "Current password and new password (min 8 chars) required" },
        { status: 400 },
      );
    }

    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 },
      );
    }

    const newHash = await hashPassword(newPassword);
    await updateUserPassword(user.id, newHash);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
