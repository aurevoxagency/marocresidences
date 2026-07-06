const express = require("express");

const {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
} = require("../controllers/promotionsController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/", ...staffOnly, getPromotions);
router.get("/:id", ...staffOnly, getPromotionById);
router.post("/", ...staffOnly, createPromotion);
router.put("/:id", ...staffOnly, updatePromotion);
router.delete("/:id", ...staffOnly, deletePromotion);

module.exports = router;
