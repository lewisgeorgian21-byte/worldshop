import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const [messages, orders] = await Promise.all([
      prisma.message.count({
        where: { recipientId: auth.user!.id, isRead: false, hiddenFromRecipient: false }
      }),
      prisma.order.count({
        where: { sellerId: auth.user!.id, sellerRead: false, hiddenFromSeller: false }
      })
    ]);
    return NextResponse.json({ messages, orders });
  } catch (error) {
    console.error("Unread account activity could not be loaded", error);
    return NextResponse.json({ error: "ახალი აქტივობის ჩატვირთვა ვერ მოხერხდა." }, { status: 500 });
  }
}
