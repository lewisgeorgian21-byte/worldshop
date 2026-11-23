import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "kartli_session";
const SESSION_DAYS = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const cookieStore = await cookies();
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt }
  });
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, isBanned: true } } }
  });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  if (session.user.isBanned) {
    await prisma.session.deleteMany({ where: { userId: session.user.id } });
    return null;
  }

  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (configuredAdminEmail && session.user.email.toLowerCase() === configuredAdminEmail && session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return prisma.user.update({
      where: { id: session.user.id },
      data: { role: "ADMIN" },
      select: { id: true, name: true, email: true, role: true, isBanned: true }
    });
  }
  return session.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "სისტემაში შესვლა აუცილებელია." }, { status: 401 }) };
  return { user, response: null };
}

export async function requireAdmin() {
  const result = await requireUser();
  if (result.response) return result;
  if (!["ADMIN", "SUPER_ADMIN"].includes(result.user!.role)) {
    return { user: null, response: NextResponse.json({ error: "ამ მოქმედებისთვის ადმინისტრატორის უფლებებია საჭირო." }, { status: 403 }) };
  }
  return result;
}
