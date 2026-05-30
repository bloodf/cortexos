import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";

const MESSAGE = "Dashboard passwords are managed by Linux PAM. Change the system account password on the host with passwd, Cockpit, Webmin, or SSH.";

export async function GET() {
  return NextResponse.json({ message: MESSAGE });
}

export async function POST() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { error: MESSAGE },
    { status: 409 },
  );
}
