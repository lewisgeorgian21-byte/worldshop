CREATE TYPE "VipPurchaseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'USER_CONFIRMED');
CREATE TYPE "PromotionKind" AS ENUM ('INTERNAL', 'PARTNER');
CREATE TYPE "PromotionPlacement" AS ENUM ('CAROUSEL', 'FEED', 'TICKER');

ALTER TABLE "User"
ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Listing"
ALTER COLUMN "imageUrls" TYPE JSONB USING to_jsonb("imageUrls"),
ADD COLUMN "isVip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "vipAssignedAt" TIMESTAMP(3),
ADD COLUMN "vipExpiresAt" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "Listing"
SET "expiresAt" = "createdAt" + INTERVAL '30 days'
WHERE "expiresAt" IS NULL;

ALTER TABLE "Order"
ADD COLUMN "buyerName" TEXT,
ADD COLUMN "buyerPhone" TEXT,
ADD COLUMN "deliveryMethod" TEXT,
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'CARD',
ADD COLUMN "note" TEXT,
ADD COLUMN "sellerRead" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "hiddenFromBuyer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hiddenFromSeller" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "VipPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "amountTetri" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GEL',
    "durationHours" INTEGER NOT NULL DEFAULT 24,
    "recipientIban" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "transferReference" TEXT NOT NULL DEFAULT '',
    "status" "VipPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    CONSTRAINT "VipPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "kind" "PromotionKind" NOT NULL DEFAULT 'INTERNAL',
    "placement" "PromotionPlacement" NOT NULL DEFAULT 'CAROUSEL',
    "titleKa" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleRu" TEXT NOT NULL,
    "descriptionKa" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    "descriptionRu" TEXT NOT NULL DEFAULT '',
    "ctaKa" TEXT NOT NULL DEFAULT '',
    "ctaEn" TEXT NOT NULL DEFAULT '',
    "ctaRu" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "targetUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT true,
    "hiddenFromSender" BOOLEAN NOT NULL DEFAULT false,
    "hiddenFromRecipient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Listing_status_isVip_vipAssignedAt_createdAt_idx"
ON "Listing"("status", "isVip", "vipAssignedAt", "createdAt");
CREATE INDEX "Listing_isVip_vipExpiresAt_idx" ON "Listing"("isVip", "vipExpiresAt");
CREATE INDEX "VipPurchase_userId_createdAt_idx" ON "VipPurchase"("userId", "createdAt");
CREATE INDEX "VipPurchase_listingId_createdAt_idx" ON "VipPurchase"("listingId", "createdAt");
CREATE INDEX "VipPurchase_status_createdAt_idx" ON "VipPurchase"("status", "createdAt");
CREATE INDEX "Promotion_placement_isActive_sortOrder_idx" ON "Promotion"("placement", "isActive", "sortOrder");
CREATE INDEX "Message_recipientId_createdAt_idx" ON "Message"("recipientId", "createdAt");
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");
CREATE INDEX "Message_listingId_createdAt_idx" ON "Message"("listingId", "createdAt");

ALTER TABLE "VipPurchase"
ADD CONSTRAINT "VipPurchase_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VipPurchase"
ADD CONSTRAINT "VipPurchase_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message"
ADD CONSTRAINT "Message_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message"
ADD CONSTRAINT "Message_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message"
ADD CONSTRAINT "Message_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
