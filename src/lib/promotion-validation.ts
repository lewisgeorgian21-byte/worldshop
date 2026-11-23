import { z } from "zod";

function isSafeImageUrl(value: string) {
  if (value.startsWith("/uploads/") && !value.includes("..")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isSafeTargetUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  if (value.startsWith("#")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const optionalImageUrl = z.string().trim().max(2048).nullable().optional()
  .transform((value) => value || null)
  .refine((value) => value === null || isSafeImageUrl(value), "Use an HTTPS image URL or a local /uploads path.");

const optionalTargetUrl = z.string().trim().max(2048).nullable().optional()
  .transform((value) => value || null)
  .refine((value) => value === null || isSafeTargetUrl(value), "Use an HTTPS URL or a local site path.");

export const promotionSchema = z.object({
  kind: z.enum(["INTERNAL", "PARTNER"]),
  placement: z.enum(["CAROUSEL", "FEED", "TICKER"]),
  titleKa: z.string().trim().min(2).max(120),
  titleEn: z.string().trim().min(2).max(120),
  titleRu: z.string().trim().min(2).max(120),
  descriptionKa: z.string().trim().max(500).default(""),
  descriptionEn: z.string().trim().max(500).default(""),
  descriptionRu: z.string().trim().max(500).default(""),
  ctaKa: z.string().trim().max(60).default(""),
  ctaEn: z.string().trim().max(60).default(""),
  ctaRu: z.string().trim().max(60).default(""),
  imageUrl: optionalImageUrl,
  targetUrl: optionalTargetUrl,
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0)
}).strict();

export const promotionPatchSchema = promotionSchema.partial().strict();
