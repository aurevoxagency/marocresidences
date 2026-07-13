const express = require("express");

const {
  getAvis,
  getAvisById,
  getPublishedAvis,
  createPublicAvis,
  updateAvis,
  deleteAvis,
} = require("../controllers/avisClientsController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/", ...staffOnly, getAvis);
router.get("/public", getPublishedAvis);
router.post("/public", createPublicAvis);
router.get("/:id", ...staffOnly, getAvisById);
router.put("/:id", ...staffOnly, updateAvis);
router.delete("/:id", ...staffOnly, deleteAvis);

module.exports = router;
