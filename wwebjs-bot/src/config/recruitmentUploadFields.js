/**
 * Field names accepted by recruitment multipart upload (PDF vs image).
 * Shared by Cloudinary/multer config and unit tests.
 */

const PDF_FIELD_NAMES = new Set([
  "cv",
  "file",
  "resume",
  "cover_letter",
  "motivation_letter",
  "letter",
]);

const IMAGE_FIELD_NAMES = new Set(["photo", "profile_photo", "picture"]);

function isPdfField(fieldname) {
  return PDF_FIELD_NAMES.has(fieldname || "");
}

function isImageField(fieldname) {
  return IMAGE_FIELD_NAMES.has(fieldname || "");
}

module.exports = {
  PDF_FIELD_NAMES,
  IMAGE_FIELD_NAMES,
  isPdfField,
  isImageField,
};
