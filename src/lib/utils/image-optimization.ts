// IMPORTANTE: Ejecuta `npm install browser-image-compression` para usar esta utilidad.
// @ts-ignore
import imageCompression from 'browser-image-compression'

export async function optimizeImage(file: File): Promise<File> {
    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg',
    }

    try {
        const compressedFile = await imageCompression(file, options)
        return compressedFile
    } catch (error) {
        console.error('Error optimizing image:', error)
        return file // Return original if compression fails
    }
}
