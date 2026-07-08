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
  getCategoriesChambre,
  createCategorieChambre,
  updateCategorieChambre,
  deleteCategorieChambre,
  getChambres,
  getChambreById,
  createChambre,
  updateChambre,
  deleteChambre,
  getSupplements,
  createSupplement,
  updateSupplement,
  deleteSupplement,
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

router.get("/categories-chambre", ...staffOnly, getCategoriesChambre);
router.post("/categories-chambre", ...staffOnly, createCategorieChambre);
router.put("/categories-chambre/:id", ...staffOnly, updateCategorieChambre);
router.delete("/categories-chambre/:id", ...staffOnly, deleteCategorieChambre);

router.get("/chambres", ...staffOnly, getChambres);
router.get("/chambres/:id", ...staffOnly, getChambreById);
router.post("/chambres", ...staffOnly, createChambre);
router.put("/chambres/:id", ...staffOnly, updateChambre);
router.delete("/chambres/:id", ...staffOnly, deleteChambre);

router.get("/supplements/tarifs", ...staffOnly, getSupplementTarifs);
router.get("/supplements", ...staffOnly, getSupplements);
router.post("/supplements", ...staffOnly, createSupplement);
router.put("/supplements/:id", ...staffOnly, updateSupplement);
router.delete("/supplements/:id", ...staffOnly, deleteSupplement);
router.put("/supplements/:supplementId/tarifs", ...staffOnly, updateSupplementTarifs);

module.exports = router;
