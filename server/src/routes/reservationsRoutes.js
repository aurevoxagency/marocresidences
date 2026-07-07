const express = require("express");

const {
  getReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation,
} = require("../controllers/reservationsController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/", ...staffOnly, getReservations);
router.get("/:id", ...staffOnly, getReservationById);
router.post("/", ...staffOnly, createReservation);
router.put("/:id", ...staffOnly, updateReservation);
router.delete("/:id", ...staffOnly, deleteReservation);

module.exports = router;
