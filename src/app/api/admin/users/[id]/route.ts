import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const roleSchema = z.enum(["USER", "SUPPORT", "MODERATOR", "ADMIN", "SUPER_ADMIN"]);
const updateSchema = z.union([
  z.object({ role: roleSchema }).strict(),
  z.object({ isBanned: z.boolean() }).strict()
]);

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, isBanned: true } });
  if (!target) return NextResponse.json({ error: "მომხმარებელი ვერ მოიძებნა." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "მოთხოვნის მონაცემები ვერ წავიკითხე." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "მომხმარებლის მონაცემები არასწორია." }, { status: 400 });

  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (configuredAdminEmail && target.email.toLowerCase() === configuredAdminEmail) {
    return NextResponse.json({ error: "ADMIN_EMAIL-ით განსაზღვრული ანგარიშის შეცვლა შეუძლებელია." }, { status: 409 });
  }
  if (target.role === "SUPER_ADMIN" && auth.user!.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "სუპერადმინისტრატორის ანგარიშის შეცვლის უფლება არ გაქვს." }, { status: 403 });
  }

  if ("role" in parsed.data) {
    if (target.id === auth.user!.id && !["ADMIN", "SUPER_ADMIN"].includes(parsed.data.role)) {
      return NextResponse.json({ error: "საკუთარი ადმინისტრატორის უფლებების გაუქმება შეუძლებელია." }, { status: 409 });
    }
    if (parsed.data.role === "SUPER_ADMIN" && auth.user!.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "სუპერადმინისტრატორის როლის მინიჭება მხოლოდ სუპერადმინისტრატორს შეუძლია." }, { status: 403 });
    }
    const user = await prisma.user.update({
      where: { id },
      data: { role: parsed.data.role },
      select: { id: true, name: true, email: true, role: true, isBanned: true, createdAt: true, _count: { select: { listings: true } } }
    });
    return NextResponse.json({ user });
  }

  if (target.id === auth.user!.id && parsed.data.isBanned) {
    return NextResponse.json({ error: "საკუთარი ანგარიშის დაბლოკვა შეუძლებელია." }, { status: 409 });
  }
  const user = await prisma.user.update({
    where: { id },
    data: { isBanned: parsed.data.isBanned },
    select: { id: true, name: true, email: true, role: true, isBanned: true, createdAt: true, _count: { select: { listings: true } } }
  });
  if (user.isBanned) await prisma.session.deleteMany({ where: { userId: id } });
  return NextResponse.json({ user });
}
