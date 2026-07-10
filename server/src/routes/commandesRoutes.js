const express = require("express");

const {
  getCommandes,
  getCommandeById,
  createCommande,
  updateCommande,
  deleteCommande,
} = require("../controllers/commandesController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/", ...staffOnly, getCommandes);
router.get("/:id", ...staffOnly, getCommandeById);
router.post("/", ...staffOnly, createCommande);
router.put("/:id", ...staffOnly, updateCommande);
router.delete("/:id", ...staffOnly, deleteCommande);

module.exports = router;
