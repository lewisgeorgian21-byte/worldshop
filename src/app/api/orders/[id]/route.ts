import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, buyerId: true, sellerId: true }
  });
  if (!order) return NextResponse.json({ error: "შეკვეთა ვერ მოიძებნა." }, { status: 404 });

  if (order.sellerId === auth.user!.id) {
    await prisma.order.update({
      where: { id: order.id },
      data: { hiddenFromSeller: true, sellerRead: true }
    });
  } else if (order.buyerId === auth.user!.id) {
    await prisma.order.update({
      where: { id: order.id },
      data: { hiddenFromBuyer: true }
    });
  } else {
    return NextResponse.json({ error: "შეკვეთა ვერ მოიძებნა." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
