// IMPORTANTE: Ejecuta `npm install browser-image-compression heic2any` para usar esta utilidad.
// @ts-ignore
import imageCompression from "browser-image-compression";

function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif")
  );
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const blob = (await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  })) as Blob;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
    type: "image/jpeg",
  });
}

export async function optimizeImage(file: File): Promise<File> {
  let input = file;

  if (isHeicFile(file)) {
    input = await convertHeicToJpeg(file);
  }

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/jpeg",
  };

  try {
    const compressedFile = await imageCompression(input, options);
    return compressedFile;
  } catch (error) {
    console.error("Error optimizing image:", error);
    return input;
  }
}
