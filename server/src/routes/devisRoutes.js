const express = require("express");

const {
  getDevis,
  getDevisById,
  createDevis,
  updateDevis,
  deleteDevis,
} = require("../controllers/devisController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/", ...staffOnly, getDevis);
router.get("/:id", ...staffOnly, getDevisById);
router.post("/", ...staffOnly, createDevis);
router.put("/:id", ...staffOnly, updateDevis);
router.delete("/:id", ...staffOnly, deleteDevis);

module.exports = router;
