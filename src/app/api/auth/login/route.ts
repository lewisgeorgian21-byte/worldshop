import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72)
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "შესვლის მონაცემები არასწორია." }, { status: 400 });
    const input = schema.parse(body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.isBanned || !(await compare(input.password, user.passwordHash))) {
      return NextResponse.json({
        error: "მონაცემები არასწორია ან რეგისტრაცია ჯერ არ გაგივლიათ. გადაამოწმე ელფოსტა და პაროლი, ან დარეგისტრირდი."
      }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "შესვლის მონაცემები არასწორია." }, { status: 400 });
    console.error("Login failed", error);
    return NextResponse.json({ error: "სისტემაში შესვლა ვერ მოხერხდა." }, { status: 500 });
  }
}
