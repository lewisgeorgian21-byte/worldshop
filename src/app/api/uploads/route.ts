import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, MAX_LISTING_IMAGES, type AllowedImageType } from "@/lib/image-constraints";

export const runtime = "nodejs";

const extensionByType: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
const MAX_REQUEST_SIZE_BYTES = MAX_LISTING_IMAGES * MAX_IMAGE_SIZE_BYTES + 1024 * 1024;

function detectImageType(buffer: Buffer): AllowedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) {
    return NextResponse.json({ error: "სურათების ასატვირთად სისტემაში შესვლა აუცილებელია." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE_BYTES) {
    return NextResponse.json({ error: "ატვირთვის საერთო ზომა დასაშვებ ზღვარს აჭარბებს." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "სურათების ასატვირთად ფორმის წაკითხვა ვერ მოხერხდა." }, { status: 400 });
  }

  const entries = formData.getAll("images");
  if (entries.length === 0) {
    return NextResponse.json({ error: "აირჩიე ასატვირთი სურათები." }, { status: 400 });
  }
  if (entries.length > MAX_LISTING_IMAGES) {
    return NextResponse.json({ error: `ერთ განცხადებაზე მაქსიმუმ ${MAX_LISTING_IMAGES} სურათის ატვირთვა შეგიძლია.` }, { status: 413 });
  }

  const files = entries.filter((entry): entry is File => entry instanceof File);
  if (files.length !== entries.length) {
    return NextResponse.json({ error: "ატვირთვის მოთხოვნა შეიცავს არასწორ ფაილს." }, { status: 400 });
  }

  const preparedFiles: { buffer: Buffer; extension: string }[] = [];
  for (const file of files) {
    if (file.size === 0) {
      return NextResponse.json({ error: "არჩეული სურათი ცარიელია." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: "თითოეული სურათის ზომა 5 მბ-ს არ უნდა აღემატებოდეს." }, { status: 413 });
    }
    const declaredType = ALLOWED_IMAGE_TYPES.find((type) => type === file.type);
    if (!declaredType) {
      return NextResponse.json({ error: "მხოლოდ JPEG, PNG ან WebP ფორმატის სურათების ატვირთვაა შესაძლებელი." }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedType = detectImageType(buffer);
    if (detectedType !== declaredType) {
      return NextResponse.json({ error: "ფაილის ფორმატი სურათის ტიპს არ ემთხვევა." }, { status: 415 });
    }
    preparedFiles.push({ buffer, extension: extensionByType[declaredType] });
  }

  const uploadDirectory = join(process.cwd(), "public", "uploads");
  const savedPaths: string[] = [];
  const imageUrls: string[] = [];
  try {
    await mkdir(uploadDirectory, { recursive: true });
    for (const file of preparedFiles) {
      const filename = `${randomUUID()}.${file.extension}`;
      const filepath = join(uploadDirectory, filename);
      await writeFile(filepath, file.buffer, { flag: "wx" });
      savedPaths.push(filepath);
      imageUrls.push(`/uploads/${filename}`);
    }
  } catch (error) {
    await Promise.all(savedPaths.map(async (filepath) => {
      try {
        await unlink(filepath);
      } catch (cleanupError) {
        console.error("Uploaded image cleanup failed", cleanupError);
      }
    }));
    console.error("Saving uploaded images failed", error);
    return NextResponse.json({ error: "სურათების შენახვა ვერ მოხერხდა. სცადე თავიდან." }, { status: 500 });
  }

  return NextResponse.json({ imageUrls }, { status: 201 });
}
