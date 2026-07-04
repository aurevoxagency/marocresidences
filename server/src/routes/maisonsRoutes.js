const express = require("express");

const {
  getMaisons,
  getMaisonById,
  createMaison,
  updateMaison,
  deleteMaison,
  getReferenceData,
} = require("../controllers/maisonsController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");
const { uploadPhoto } = require("../middleware/uploadMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/meta/references", ...staffOnly, getReferenceData);
router.post("/upload", ...staffOnly, (req, res) => {
  uploadPhoto(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: error.message || "Upload failed." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No photo file provided." });
    }

    const publicPath = `/uploads/${req.file.filename}`;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    return res.status(201).json({
      message: "Photo uploaded successfully.",
      url: `${baseUrl}${publicPath}`,
      path: publicPath,
    });
  });
});
router.get("/", ...staffOnly, getMaisons);
router.get("/:id", ...staffOnly, getMaisonById);
router.post("/", ...staffOnly, createMaison);
router.put("/:id", ...staffOnly, updateMaison);
router.delete("/:id", ...staffOnly, deleteMaison);

module.exports = router;
