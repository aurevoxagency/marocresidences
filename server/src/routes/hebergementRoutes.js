const express = require("express");

const {
  getReferences,
  getSaisons,
  createSaison,
  updateSaison,
  deleteSaison,
  getTranchesAge,
  createTrancheAge,
  updateTrancheAge,
  deleteTrancheAge,
  getChambres,
  getChambreById,
  createChambre,
  updateChambre,
  deleteChambre,
  getSupplementTarifs,
  updateSupplementTarifs,
} = require("../controllers/hebergementController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/meta/references", ...staffOnly, getReferences);

router.get("/saisons", ...staffOnly, getSaisons);
router.post("/saisons", ...staffOnly, createSaison);
router.put("/saisons/:id", ...staffOnly, updateSaison);
router.delete("/saisons/:id", ...staffOnly, deleteSaison);

router.get("/tranches-age", ...staffOnly, getTranchesAge);
router.post("/tranches-age", ...staffOnly, createTrancheAge);
router.put("/tranches-age/:id", ...staffOnly, updateTrancheAge);
router.delete("/tranches-age/:id", ...staffOnly, deleteTrancheAge);

router.get("/chambres", ...staffOnly, getChambres);
router.get("/chambres/:id", ...staffOnly, getChambreById);
router.post("/chambres", ...staffOnly, createChambre);
router.put("/chambres/:id", ...staffOnly, updateChambre);
router.delete("/chambres/:id", ...staffOnly, deleteChambre);

router.get("/supplements/tarifs", ...staffOnly, getSupplementTarifs);
router.put("/supplements/:supplementId/tarifs", ...staffOnly, updateSupplementTarifs);

module.exports = router;
