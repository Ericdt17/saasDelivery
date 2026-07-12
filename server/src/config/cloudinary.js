/**
 * Cloudinary + multer storage for recruitment uploads:
 * - PDF (raw): CV, cover letter
 * - Images: profile photo
 */
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const {
  isPdfField,
  isImageField,
} = require("./recruitmentUploadFields");

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

const storage =
  cloudName && apiKey && apiSecret
    ? new CloudinaryStorage({
        cloudinary,
        params: (req, file) => {
          const fn = file.fieldname || "";
          if (isPdfField(fn)) {
            return {
              folder: "livsight/recruitment",
              resource_type: "raw",
              allowed_formats: ["pdf"],
            };
          }
          if (isImageField(fn)) {
            return {
              folder: "livsight/recruitment/photos",
              resource_type: "image",
            };
          }
          return {
            folder: "livsight/recruitment",
            resource_type: "raw",
          };
        },
      })
    : null;

const upload = storage
  ? multer({
      storage,
      // Keep this in sync with the reverse-proxy (e.g., Nginx client_max_body_size).
      // 10MB per file is a pragmatic default for CV/letters/photos in production.
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const fn = file.fieldname || "";
        if (isPdfField(fn)) {
          const mimeOk = file.mimetype === "application/pdf";
          const extOk = /\.pdf$/i.test(file.originalname || "");
          if (!mimeOk && !extOk) {
            const err = new Error(
              "Only PDF files are allowed for CV or cover letter"
            );
            err.statusCode = 400;
            return cb(err);
          }
          return cb(null, true);
        }
        if (isImageField(fn)) {
          const okMime = /^image\/(jpeg|jpg|png|webp)$/i.test(
            file.mimetype || ""
          );
          if (!okMime) {
            const err = new Error(
              "Only JPEG, PNG or WebP images are allowed for photo"
            );
            err.statusCode = 400;
            return cb(err);
          }
          return cb(null, true);
        }
        const err = new Error("Unexpected file field");
        err.statusCode = 400;
        return cb(err);
      },
    })
  : null;

function requireUploadMiddleware() {
  if (!upload) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET."
    );
  }
  return upload;
}

function publicIdFromCloudinaryUrl(url) {
  if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) {
    return null;
  }
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const uploadIdx = segments.indexOf("upload");
    if (uploadIdx === -1) return null;
    let rest = segments.slice(uploadIdx + 1);
    if (rest[0] && /^v\d+$/.test(rest[0])) {
      rest = rest.slice(1);
    }
    if (!rest.length) return null;
    const last = rest[rest.length - 1];
    rest[rest.length - 1] = last.replace(/\.[^/.]+$/, "");
    return rest.join("/");
  } catch {
    return null;
  }
}

function resourceTypeFromCloudinaryUrl(url) {
  if (url && url.includes("/image/upload/")) return "image";
  return "raw";
}

async function deleteCloudinaryAsset(url) {
  if (!cloudName || !apiKey || !apiSecret || !url) return;

  const publicId = publicIdFromCloudinaryUrl(url);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceTypeFromCloudinaryUrl(url),
    });
  } catch (err) {
    console.warn("[cloudinary] delete failed:", err.message);
  }
}

module.exports = {
  cloudinary,
  upload,
  requireUploadMiddleware,
  publicIdFromCloudinaryUrl,
  deleteCloudinaryAsset,
};
