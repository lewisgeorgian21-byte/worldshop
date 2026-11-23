import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expireListings } from "@/lib/listing-expiration";
import { expireVipListings } from "@/lib/listing-vip";
import { Marketplace } from "@/components/marketplace";

export const dynamic = "force-dynamic";

type PromotionRow = {
  id: string;
  kind: "INTERNAL" | "PARTNER";
  placement: "CAROUSEL" | "FEED" | "TICKER";
  titleKa: string;
  titleEn: string;
  titleRu: string;
  descriptionKa: string;
  descriptionEn: string;
  descriptionRu: string;
  ctaKa: string;
  ctaEn: string;
  ctaRu: string;
  imageUrl: string | null;
  targetUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};

type PromotionDelegate = {
  findMany: (args: {
    where: { isActive: true };
    orderBy: Array<{ sortOrder: "asc" } | { createdAt: "desc" }>;
  }) => Promise<PromotionRow[]>;
};

function isPromotionDelegate(value: unknown): value is PromotionDelegate {
  return typeof value === "object"
    && value !== null
    && "findMany" in value
    && typeof value.findMany === "function";
}

function isPromotionTableMissing(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2021") return true;
  return error instanceof Error && /promotion.*(?:does not exist|no such table)|no such table.*promotion/i.test(error.message);
}

async function getPromotionsSafely() {
  const promotionModel: unknown = Reflect.get(prisma, "promotion");
  if (!isPromotionDelegate(promotionModel)) {
    console.error("Promotion model is unavailable in the generated Prisma Client; rendering without promotions.");
    return [] as PromotionRow[];
  }
  try {
    return await promotionModel.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
    });
  } catch (error) {
    if (!isPromotionTableMissing(error)) throw error;
    console.error("Promotion table is not initialized; rendering without promotions.", error);
    return [] as PromotionRow[];
  }
}

const categories = [
  { name: "ტექნიკა", slug: "electronics", icon: "laptop", tone: "mint" },
  { name: "ტელეფონები", slug: "phones-accessories", icon: "smartphone", tone: "peach" },
  { name: "ავტომობილები", slug: "cars-vehicles", icon: "car", tone: "blue" },
  { name: "უძრავი ქონება", slug: "real-estate", icon: "house", tone: "lavender" },
  { name: "მოდა", slug: "fashion", icon: "shirt", tone: "pink" }
] as const;

export default async function HomePage() {
  await expireListings();
  await expireVipListings();
  const [listings, categoryRows, promotions] = await Promise.all([
    prisma.listing.findMany({
      where: { status: { in: [ListingStatus.ACTIVE, ListingStatus.RESERVED, ListingStatus.SOLD] } },
      include: { seller: { select: { id: true, name: true } }, category: { select: { id: true, nameKa: true, nameEn: true } } },
      orderBy: [{ isVip: "desc" }, { vipAssignedAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.category.findMany({ orderBy: { nameKa: "asc" } }),
    getPromotionsSafely()
  ]);
  return (
    <Marketplace
      initialListings={JSON.parse(JSON.stringify(listings))}
      initialPromotions={JSON.parse(JSON.stringify(promotions))}
      categoryOptions={categoryRows.map((category) => ({ id: category.id, nameKa: category.nameKa, nameEn: category.nameEn, slug: category.slug }))}
      categoryTiles={categories}
    />
  );
}
