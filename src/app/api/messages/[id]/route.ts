import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const message = await prisma.message.findUnique({
    where: { id },
    select: { id: true, senderId: true, recipientId: true }
  });
  if (!message) return NextResponse.json({ error: "შეტყობინება ვერ მოიძებნა." }, { status: 404 });

  if (message.recipientId === auth.user!.id) {
    await prisma.message.update({
      where: { id: message.id },
      data: { hiddenFromRecipient: true, isRead: true }
    });
  } else if (message.senderId === auth.user!.id) {
    await prisma.message.update({
      where: { id: message.id },
      data: { hiddenFromSender: true }
    });
  } else {
    return NextResponse.json({ error: "შეტყობინება ვერ მოიძებნა." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
