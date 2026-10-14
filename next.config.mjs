/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Catatan: kita sengaja TIDAK menambahkan konfigurasi `webpack` di sini.
  // Next.js 16 memakai Turbopack sebagai bundler default, dan Tesseract.js
  // sudah aman karena di-import secara dinamis di sisi client saja
  // (lihat components/UploadZone.tsx -> lib/ocr.ts).
};

export default nextConfig;
