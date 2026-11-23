import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VIP_DURATION_HOURS, VIP_PRICE_TETRI, VIP_RECIPIENT_IBAN } from "@/lib/vip";

type RouteContext = { params: Promise<{ id: string }> };
const confirmationSchema = z.object({
  confirmTransfer: z.literal(true),
  transferReference: z.string().trim().min(1).max(200)
}).strict();

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const confirmation = confirmationSchema.safeParse(body);
  if (!confirmation.success) {
    return NextResponse.json({ error: "გადარიცხვის დადასტურება და საბანკო მითითების შევსება აუცილებელია." }, { status: 400 });
  }

  const { id } = await params;
  try {
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return NextResponse.json({ error: "განცხადება ვერ მოიძებნა." }, { status: 404 });
    if (listing.sellerId !== auth.user!.id) {
      return NextResponse.json({ error: "ამ განცხადების VIP სტატუსის შეძენა მხოლოდ გამყიდველს შეუძლია." }, { status: 403 });
    }
    if (listing.status !== "ACTIVE" && listing.status !== "RESERVED") {
      return NextResponse.json({ error: "ამ განცხადებისთვის VIP სტატუსის შეძენა ახლა შეუძლებელია." }, { status: 409 });
    }
    const pendingRequest = await prisma.vipPurchase.findFirst({
      where: { userId: auth.user!.id, listingId: listing.id, status: "PENDING" },
      select: { id: true }
    });
    if (pendingRequest) {
      return NextResponse.json({ error: "ამ განცხადებისთვის უკვე არსებობს VIP მოთხოვნა, რომელიც გადამოწმების მოლოდინშია." }, { status: 409 });
    }

    const paymentReference = `${listing.title} (${listing.id})`;
    const purchase = await prisma.vipPurchase.create({
      data: {
        userId: auth.user!.id,
        listingId: listing.id,
        amountTetri: VIP_PRICE_TETRI,
        recipientIban: VIP_RECIPIENT_IBAN,
        paymentReference,
        transferReference: confirmation.data.transferReference,
        status: "PENDING",
        confirmedAt: null
      }
    });
    return NextResponse.json({ purchase }, { status: 201 });
  } catch (error) {
    console.error("VIP purchase confirmation failed", error);
    return NextResponse.json({ error: "VIP სტატუსის შეძენა ვერ მოხერხდა." }, { status: 500 });
  }
}
