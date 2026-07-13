const express = require("express");

const {
  getCheckins,
  getCheckinById,
  getCheckinByReservation,
  createCheckin,
  updateCheckin,
  deleteCheckin,
} = require("../controllers/checkinsController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/", ...staffOnly, getCheckins);
router.get("/reservation/:reservationId", ...staffOnly, getCheckinByReservation);
router.get("/:id", ...staffOnly, getCheckinById);
router.post("/", ...staffOnly, createCheckin);
router.put("/:id", ...staffOnly, updateCheckin);
router.delete("/:id", ...staffOnly, deleteCheckin);

module.exports = router;
