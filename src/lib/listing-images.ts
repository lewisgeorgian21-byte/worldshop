import { Prisma } from "@prisma/client";
import { del } from "@vercel/blob";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { isManagedUploadedImage, isUploadedImagePath } from "@/lib/image-constraints";

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isStringArray(value: Prisma.JsonValue): value is string[] {
  return Array.isArray(value) && value.every((url) => typeof url === "string");
}

export function getListingImageUrls(value: Prisma.JsonValue) {
  if (!isStringArray(value)) {
    throw new Error("Listing image URLs are not stored as a string array");
  }
  return value;
}

export async function removeUnusedUploadedImages(imageUrls: string[]) {
  const candidates = [...new Set(imageUrls.filter(isManagedUploadedImage))];
  if (candidates.length === 0) return [];

  const listings = await prisma.listing.findMany({ select: { imageUrls: true } });
  const referencedImages = new Set(listings.flatMap(({ imageUrls: urls }) => getListingImageUrls(urls).filter(isManagedUploadedImage)));
  const unusedImages = candidates.filter((url) => !referencedImages.has(url));
  const failedDeletions: string[] = [];

  for (const url of unusedImages) {
    try {
      if (isUploadedImagePath(url)) {
        await unlink(join(process.cwd(), "public", url.slice(1)));
      } else {
        await del(url);
      }
    } catch (error) {
      if (isMissingFileError(error)) continue;
      console.error("Unused listing image cleanup failed", error);
      failedDeletions.push(url);
    }
  }

  return failedDeletions;
}
