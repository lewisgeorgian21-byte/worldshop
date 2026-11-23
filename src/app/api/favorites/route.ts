import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: auth.user!.id, listing: { status: { in: ["ACTIVE", "RESERVED"] } } },
      include: {
        listing: {
          include: {
            seller: { select: { id: true, name: true } },
            category: { select: { id: true, nameKa: true, nameEn: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ favorites: favorites.map(({ listing }) => listing) });
  } catch (error) {
    console.error("Favorite list load failed", error);
    return NextResponse.json({ error: "რჩეულების ჩატვირთვა ვერ მოხერხდა." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.listingId !== "string") return NextResponse.json({ error: "განცხადების ნომერი აუცილებელია." }, { status: 400 });
    const listing = await prisma.listing.findFirst({ where: { id: body.listingId, status: { in: ["ACTIVE", "RESERVED"] } }, select: { id: true } });
    if (!listing) return NextResponse.json({ error: "განცხადება ხელმისაწვდომი აღარ არის." }, { status: 404 });
    const key = { userId_listingId: { userId: auth.user!.id, listingId: listing.id } };
    const existing = await prisma.favorite.findUnique({ where: key });
    if (existing) {
      await prisma.favorite.delete({ where: key });
      return NextResponse.json({ favorited: false });
    }
    await prisma.favorite.create({ data: { userId: auth.user!.id, listingId: listing.id } });
    return NextResponse.json({ favorited: true }, { status: 201 });
  } catch (error) {
    console.error("Favorite toggle failed", error);
    return NextResponse.json({ error: "რჩეულის განახლება ვერ მოხერხდა." }, { status: 500 });
  }
}
