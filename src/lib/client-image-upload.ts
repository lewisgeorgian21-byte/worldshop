"use client";

import { upload } from "@vercel/blob/client";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, type AllowedImageType } from "@/lib/image-constraints";

const extensionByType: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function getAllowedImageType(file: File): AllowedImageType | null {
  return ALLOWED_IMAGE_TYPES.find((type) => type === file.type) ?? null;
}

export async function uploadListingImages(files: File[]) {
  if (process.env.NODE_ENV === "production") {
    return Promise.all(files.map(async (file) => {
      const type = getAllowedImageType(file);
      if (!type || file.size === 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
        throw new Error("არჩეული სურათის ფორმატი ან ზომა დაუშვებელია.");
      }

      const blob = await upload(`listing-images/${crypto.randomUUID()}.${extensionByType[type]}`, file, {
        access: "public",
        handleUploadUrl: "/api/uploads"
      });
      return blob.url;
    }));
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));
  const response = await fetch("/api/uploads", { method: "POST", body: formData });
  const data = await response.json().catch(() => null) as { error?: unknown; imageUrls?: unknown } | null;
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "სურათების ატვირთვა ვერ მოხერხდა.");
  }
  if (!Array.isArray(data?.imageUrls) || data.imageUrls.some((url) => typeof url !== "string")) {
    throw new Error("სურათების ატვირთვის პასუხი არასწორია.");
  }
  return data.imageUrls;
}
