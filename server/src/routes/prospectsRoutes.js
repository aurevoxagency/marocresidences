const express = require("express");

const {
  getProspects,
  getProspectById,
  createProspect,
  updateProspect,
  deleteProspect,
  convertProspectToClient,
} = require("../controllers/prospectsController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/", ...staffOnly, getProspects);
router.get("/:id", ...staffOnly, getProspectById);
router.post("/", ...staffOnly, createProspect);
router.post("/:id/convert", ...staffOnly, convertProspectToClient);
router.put("/:id", ...staffOnly, updateProspect);
router.delete("/:id", ...staffOnly, deleteProspect);

module.exports = router;
