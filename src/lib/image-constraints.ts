export const MAX_LISTING_IMAGES = 8;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const uploadedImagePathPattern = /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;
const vercelBlobHostnameSuffix = ".public.blob.vercel-storage.com";

export function isUploadedImagePath(value: string) {
  return uploadedImagePathPattern.test(value);
}

export function isVercelBlobImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname.endsWith(vercelBlobHostnameSuffix) &&
      url.pathname.startsWith("/listing-images/") &&
      /\.(jpg|png|webp)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function isManagedUploadedImage(value: string) {
  return isUploadedImagePath(value) || isVercelBlobImageUrl(value);
}
