import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { getListingExpiration } from "../src/lib/listing-expiration";

const prisma = new PrismaClient();
const categories = [
  ["ელექტრონიკა", "Electronics", "electronics"],
  ["ტელეფონები და აქსესუარები", "Phones & accessories", "phones-accessories"],
  ["კომპიუტერები და ლეპტოპები", "Computers & laptops", "computers-laptops"],
  ["ავტომობილები და ტრანსპორტი", "Cars & vehicles", "cars-vehicles"],
  ["უძრავი ქონება", "Real estate", "real-estate"],
  ["ტანსაცმელი და მოდა", "Fashion & clothing", "fashion"],
  ["ფეხსაცმელი და აქსესუარები", "Shoes & accessories", "shoes-accessories"],
  ["სახლი და ავეჯი", "Home & furniture", "home-furniture"],
  ["საყოფაცხოვრებო ტექნიკა", "Home appliances", "home-appliances"],
  ["სპორტი და ფიტნესი", "Sports & fitness", "sports-fitness"],
  ["გეიმინგი", "Gaming", "gaming"],
  ["ბავშვის ნივთები", "Children's products", "children"],
  ["სილამაზე და ჯანმრთელობა", "Beauty & health", "beauty-health"],
  ["ხელსაწყოები და აღჭურვილობა", "Tools & equipment", "tools-equipment"],
  ["ცხოველები და მათი აქსესუარები", "Pets & supplies", "pets"],
  ["მომსახურება", "Services", "services"],
  ["სხვა", "Other", "other"]
];

const sampleListings = [
  {
    id: "demo-listing-iphone-14",
    title: "iPhone 14 Pro — იდეალურ მდგომარეობაში",
    description: "კარგად მოვლილი iPhone 14 Pro, მუშაობს გამართულად. მოყვება დამტენი და ქეისი. ნახვა შესაძლებელია თბილისში.",
    price: 1850,
    condition: "LIKE_NEW" as const,
    location: "თბილისი",
    imageUrls: ["https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=1000&q=85"],
    categorySlug: "phones-accessories"
  },
  {
    id: "demo-listing-bicycle",
    title: "ქალაქის ველოსიპედი — მსუბუქი და კომფორტული",
    description: "საიმედო ქალაქის ველოსიპედი კარგ მდგომარეობაში. სიჩქარეები და მუხრუჭები გამართულად მუშაობს. შესაძლებელია ნახვა ბათუმში.",
    price: 620,
    condition: "GOOD" as const,
    location: "ბათუმი",
    imageUrls: ["https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1000&q=85"],
    categorySlug: "sports-fitness"
  },
  {
    id: "demo-listing-sofa",
    title: "სკანდინავიური დივანი — ნაცრისფერი",
    description: "კომფორტული სამადგილიანი დივანი, ქსოვილი სუფთა და მოვლილია. მცირე ზომის ნაკაწრი აქვს გვერდზე, ფასში გათვალისწინებულია.",
    price: 950,
    condition: "GOOD" as const,
    location: "თბილისი",
    imageUrls: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1000&q=85"],
    categorySlug: "home-furniture"
  },
  {
    id: "demo-listing-camera",
    title: "Canon mirrorless camera with lens",
    description: "A lightly used mirrorless camera with a sharp 35 mm lens. Includes the original box, battery, and strap. Pickup in Tbilisi.",
    price: 1450,
    condition: "LIKE_NEW" as const,
    location: "Tbilisi",
    imageUrls: ["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=85"],
    categorySlug: "electronics"
  },
  {
    id: "demo-listing-laptop",
    title: "MacBook Air для учёбы и работы",
    description: "Ноутбук в отличном состоянии, батарея держит хорошо. В комплекте зарядное устройство. Можно посмотреть в Батуми.",
    price: 2100,
    condition: "GOOD" as const,
    location: "Батуми",
    imageUrls: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=85"],
    categorySlug: "computers-laptops"
  },
  {
    id: "demo-listing-coat",
    title: "ქალის ქურთუკი — ახალი, ზომა M",
    description: "თბილი და მსუბუქი ქურთუკი, ერთხელ არის ჩაცმული. ზომა M. სურვილის შემთხვევაში გამოგიგზავნით დამატებით ფოტოებს.",
    price: 180,
    condition: "NEW" as const,
    location: "ქუთაისი",
    imageUrls: ["https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=1000&q=85"],
    categorySlug: "fashion"
  },
  {
    id: "demo-listing-headphones",
    title: "Wireless headphones — clear sound, great condition",
    description: "Comfortable wireless headphones with noise cancellation and a long-lasting battery. Clean, tested, and ready to use.",
    price: 350,
    condition: "LIKE_NEW" as const,
    location: "Kutaisi",
    imageUrls: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=85"],
    categorySlug: "electronics"
  },
  {
    id: "demo-listing-desk",
    title: "Письменный стол из натурального дерева",
    description: "Прочный письменный стол в хорошем состоянии. Просторная столешница, аккуратный внешний вид. Самовывоз из Тбилиси.",
    price: 480,
    condition: "GOOD" as const,
    location: "Тбилиси",
    imageUrls: ["https://images.unsplash.com/photo-1499933374294-4584851497cc?auto=format&fit=crop&w=1000&q=85"],
    categorySlug: "home-furniture"
  }
];

async function main() {
  for (const [nameKa, nameEn, slug] of categories) {
    await prisma.category.upsert({ where: { slug }, update: { nameKa, nameEn }, create: { nameKa, nameEn, slug } });
  }
  const demoListingIds = sampleListings.map(({ id }) => id);
  const nonDemoListingCount = await prisma.listing.count({ where: { id: { notIn: demoListingIds } } });
  const seedDemoListings = process.env.SEED_DEMO_LISTINGS?.toLowerCase() !== "false";
  if (seedDemoListings && nonDemoListingCount === 0) {
    const sampleSellerEmail = "sample-seller@example.test";
    let sampleSeller = await prisma.user.findUnique({ where: { email: sampleSellerEmail } });
    if (!sampleSeller) {
      sampleSeller = await prisma.user.create({
        data: {
          name: "Nino Beridze",
          email: sampleSellerEmail,
          passwordHash: await hash(randomBytes(32).toString("hex"), 12)
        }
      });
    }
    for (const listing of sampleListings) {
      const category = await prisma.category.findUniqueOrThrow({ where: { slug: listing.categorySlug }, select: { id: true } });
      const { categorySlug, ...data } = listing;
      await prisma.listing.upsert({
        where: { id: listing.id },
        update: {},
        create: {
          ...data,
          isVip: false,
          vipAssignedAt: null,
          vipExpiresAt: null,
          expiresAt: getListingExpiration(),
          sellerId: sampleSeller.id,
          categoryId: category.id
        }
      });
    }
  }
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      await prisma.user.create({
        data: {
          name: "Platform owner",
          email: adminEmail,
          passwordHash: await hash(adminPassword, 12),
          role: "SUPER_ADMIN"
        }
      });
    } else if (existing.role !== "SUPER_ADMIN") {
      throw new Error("Bootstrap email already belongs to a non-super-admin user");
    }
  }
}

main().then(() => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
