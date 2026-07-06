import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = path.join(__dirname, "../../../uploads/avatars");

// multer does NOT create the destination directory itself - it throws ENOENT otherwise.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Same allowlist and cap as appeal.upload.js - middleware/errorHandler.js's Multer size message
// ("max 4MB") is shared across every upload route, so a different cap here would make it wrong.
const ALLOWED_MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    // Never trust file.originalname for the on-disk path - a random uuid + our own
    // mime-derived extension avoids any path-traversal or collision risk entirely.
    cb(null, `${randomUUID()}${ALLOWED_MIME_TO_EXT[file.mimetype] || ""}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "avatar"));
    return;
  }
  cb(null, true);
}

export const uploadAvatarPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

export default uploadAvatarPhoto;
