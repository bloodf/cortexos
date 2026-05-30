import { NextResponse } from "next/server";
import {
  authenticateUser,
  createUserSession,
  setSessionCookie,
  getCurrentSession,
  logout,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 },
      );
    }

    const user = await authenticateUser(username.trim(), password);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const { token, expiresAt } = await createUserSession(user.id, user.is_admin);
    await setSessionCookie(token, expiresAt);

    return NextResponse.json({ success: true, username: user.username });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    await logout();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({
      authenticated: true,
      username: session.user.username,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
