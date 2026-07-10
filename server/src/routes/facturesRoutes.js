const express = require("express");

const {
  getFactures,
  getFactureById,
  createFacture,
  updateFacture,
  deleteFacture,
} = require("../controllers/facturesController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/", ...staffOnly, getFactures);
router.get("/:id", ...staffOnly, getFactureById);
router.post("/", ...staffOnly, createFacture);
router.put("/:id", ...staffOnly, updateFacture);
router.delete("/:id", ...staffOnly, deleteFacture);

module.exports = router;
