import { ZodError, z } from "zod";
import { isManagedUploadedImage, MAX_LISTING_IMAGES } from "@/lib/image-constraints";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(72)
});

const imageUrlSchema = z.string().max(2048).refine((value) => {
  if (isManagedUploadedImage(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "images.unsplash.com" || url.hostname === "res.cloudinary.com");
  } catch {
    return false;
  }
});

export const listingSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(10).max(5000),
  price: z.number().int().positive().max(999_999),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]),
  location: z.string().trim().min(2).max(100),
  imageUrls: z.array(imageUrlSchema).min(1).max(MAX_LISTING_IMAGES),
  categoryId: z.string().min(1)
});

export function getListingValidationMessage(error: ZodError) {
  const issue = error.issues[0];
  const field = issue?.path[0];

  if (field === "title") return "განცხადების სათაური 4-120 სიმბოლოს უნდა შეიცავდეს.";
  if (field === "description") return "განცხადების აღწერა 10-5000 სიმბოლოს უნდა შეიცავდეს.";
  if (field === "price") return "ფასი 1-999999 ლარის ფარგლებში მთელი რიცხვი უნდა იყოს.";
  if (field === "condition") return "აირჩიე ნივთის მდგომარეობა.";
  if (field === "location") return "მიუთითე ქალაქი ან მდებარეობა (2-100 სიმბოლო).";
  if (field === "categoryId") return "აირჩიე განცხადების კატეგორია.";
  if (field === "imageUrls") {
    if (issue.code === "too_small") return "განცხადებას მინიმუმ ერთი სურათი უნდა ჰქონდეს.";
    if (issue.code === "too_big") return `ერთ განცხადებაზე მაქსიმუმ ${MAX_LISTING_IMAGES} სურათია დაშვებული.`;
    return "სურათის მისამართი არასწორია. გამოიყენე ატვირთული სურათი ან მხარდაჭერილი HTTPS მისამართი.";
  }
  return "განცხადების მონაცემები არასწორია. შეამოწმე ყველა სავალდებულო ველი.";
}
