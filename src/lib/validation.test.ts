import assert from "node:assert/strict";
import test from "node:test";
import { compareListings } from "@/lib/listing-sort";
import { getListingValidationMessage, listingSchema, registerSchema } from "@/lib/validation";

test("registration normalizes email and enforces a strong password minimum", () => {
  const parsed = registerSchema.safeParse({ name: "Nino", email: "NINO@example.com", password: "a-secure-pass" });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.email, "nino@example.com");
  assert.equal(registerSchema.safeParse({ name: "Nino", email: "nino@example.com", password: "short" }).success, false);
});

test("listings accept a bounded gallery from approved image hosts", () => {
  const listing = {
    title: "Used camera",
    description: "In working condition and carefully maintained.",
    price: 25000,
    condition: "GOOD",
    location: "Tbilisi",
    imageUrls: ["https://images.unsplash.com/photo-1"],
    categoryId: "electronics"
  };
  assert.equal(listingSchema.safeParse(listing).success, true);
  assert.equal(listingSchema.safeParse({ ...listing, imageUrls: ["https://example.com/image.jpg"] }).success, false);
  assert.equal(listingSchema.safeParse({ ...listing, imageUrls: Array(9).fill("https://images.unsplash.com/photo-1") }).success, false);
});

test("listings accept locally uploaded image paths but reject unsafe paths", () => {
  const listing = {
    title: "Used camera",
    description: "In working condition and carefully maintained.",
    price: 25000,
    condition: "GOOD",
    location: "Tbilisi",
    imageUrls: ["/uploads/123e4567-e89b-12d3-a456-426614174000.jpg"],
    categoryId: "electronics"
  };
  assert.equal(listingSchema.safeParse(listing).success, true);
  assert.equal(listingSchema.safeParse({ ...listing, imageUrls: ["/uploads/../../secret.jpg"] }).success, false);
});

test("listings accept owned Vercel Blob images but reject unrelated Blob paths", () => {
  const listing = {
    title: "Used camera",
    description: "In working condition and carefully maintained.",
    price: 25000,
    condition: "GOOD",
    location: "Tbilisi",
    imageUrls: ["https://store.public.blob.vercel-storage.com/listing-images/photo-1.webp"],
    categoryId: "electronics"
  };
  assert.equal(listingSchema.safeParse(listing).success, true);
  assert.equal(
    listingSchema.safeParse({ ...listing, imageUrls: ["https://store.public.blob.vercel-storage.com/other/photo.webp"] }).success,
    false
  );
});

test("listing validation reports the invalid field clearly", () => {
  const validListing = {
    title: "Used camera",
    description: "In working condition and carefully maintained.",
    price: 25000,
    condition: "GOOD",
    location: "Tbilisi",
    imageUrls: ["https://images.unsplash.com/photo-1"],
    categoryId: "electronics"
  };
  const invalidTitle = listingSchema.safeParse({ ...validListing, title: "TV" });
  const invalidImages = listingSchema.safeParse({ ...validListing, imageUrls: ["https://example.com/image.jpg"] });

  assert.equal(invalidTitle.success, false);
  if (!invalidTitle.success) {
    assert.equal(getListingValidationMessage(invalidTitle.error), "განცხადების სათაური 4-120 სიმბოლოს უნდა შეიცავდეს.");
  }
  assert.equal(invalidImages.success, false);
  if (!invalidImages.success) {
    assert.equal(getListingValidationMessage(invalidImages.error), "სურათის მისამართი არასწორია. გამოიყენე ატვირთული სურათი ან მხარდაჭერილი HTTPS მისამართი.");
  }
});

test("VIP listings sort by latest assignment before non-VIP listings", () => {
  const listings = [
    { id: "older-vip", isVip: true, vipAssignedAt: "2025-01-01T00:00:00.000Z", createdAt: "2025-03-01T00:00:00.000Z", price: 10 },
    { id: "newer-vip", isVip: true, vipAssignedAt: "2025-02-01T00:00:00.000Z", createdAt: "2025-02-01T00:00:00.000Z", price: 20 },
    { id: "same-assignment-newer-created", isVip: true, vipAssignedAt: "2025-02-01T00:00:00.000Z", createdAt: "2025-03-02T00:00:00.000Z", price: 30 },
    { id: "newest-regular", isVip: false, vipAssignedAt: null, createdAt: "2025-04-01T00:00:00.000Z", price: 5 },
    { id: "cheapest-regular", isVip: false, vipAssignedAt: null, createdAt: "2025-01-01T00:00:00.000Z", price: 1 }
  ];

  assert.deepEqual(
    [...listings].sort((left, right) => compareListings(left, right, "price-asc")).map(({ id }) => id),
    ["same-assignment-newer-created", "newer-vip", "older-vip", "cheapest-regular", "newest-regular"]
  );
});
