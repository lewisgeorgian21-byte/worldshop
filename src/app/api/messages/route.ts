import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { readVipRejectionNotification } from "@/lib/message-notifications";
import { prisma } from "@/lib/prisma";

const messageSchema = z.object({
  listingId: z.string().min(1),
  body: z.string().trim().min(1).max(2000)
}).strict();

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const [receivedMessages, sentMessages] = await Promise.all([
      prisma.message.findMany({
        where: { recipientId: auth.user!.id, hiddenFromRecipient: false },
        include: {
          sender: { select: { id: true, name: true, role: true } },
          listing: { select: { id: true, title: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.message.findMany({
        where: { senderId: auth.user!.id, recipientId: { not: auth.user!.id }, hiddenFromSender: false },
        include: {
          recipient: { select: { id: true, name: true } },
          listing: { select: { id: true, title: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    ]);
    const messages = [
      ...receivedMessages.map((message) => {
        const notification = readVipRejectionNotification(message.body, message.sender.role);
        return {
          id: message.id,
          body: message.body,
          notification,
          createdAt: message.createdAt,
          direction: "received" as const,
          isNew: !message.isRead,
          contact: { id: message.sender.id, name: message.sender.name },
          listing: message.listing
        };
      }),
      ...sentMessages.map((message) => ({
        id: message.id,
        body: message.body,
        notification: readVipRejectionNotification(message.body, auth.user!.role),
        createdAt: message.createdAt,
        direction: "sent" as const,
        isNew: false,
        contact: message.recipient,
        listing: message.listing
      }))
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 100);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Inbox load failed", error);
    return NextResponse.json({ error: "შეტყობინებების ჩატვირთვა ვერ მოხერხდა." }, { status: 500 });
  }
}

export async function PATCH() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    await prisma.message.updateMany({
      where: { recipientId: auth.user!.id, isRead: false, hiddenFromRecipient: false },
      data: { isRead: true }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Messages could not be marked as read", error);
    return NextResponse.json({ error: "შეტყობინებების წაკითხულად მონიშვნა ვერ მოხერხდა." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "შეტყობინების ტექსტი ცარიელია ან ზედმეტად გრძელია.", code: "INVALID_MESSAGE" }, { status: 400 });
    }

    const listing = await prisma.listing.findUnique({
      where: { id: parsed.data.listingId },
      select: { id: true, sellerId: true, status: true }
    });
    if (!listing) return NextResponse.json({ error: "განცხადება ვერ მოიძებნა.", code: "LISTING_MISSING" }, { status: 404 });
    if (listing.status !== "ACTIVE" && listing.status !== "RESERVED") {
      return NextResponse.json({ error: "განცხადება ხელმისაწვდომი აღარ არის.", code: "LISTING_UNAVAILABLE" }, { status: 409 });
    }
    if (listing.sellerId === auth.user!.id) {
      return NextResponse.json({ error: "საკუთარ განცხადებაზე შეტყობინებას ვერ გაგზავნი." }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        senderId: auth.user!.id,
        recipientId: listing.sellerId,
        listingId: listing.id,
        body: parsed.data.body,
        isRead: false
      },
      include: {
        sender: { select: { id: true, name: true } },
        listing: { select: { id: true, title: true } }
      }
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Message send failed", error);
    return NextResponse.json({ error: "შეტყობინების გაგზავნა ვერ მოხერხდა.", code: "MESSAGE_CREATE_FAILED" }, { status: 500 });
  }
}
