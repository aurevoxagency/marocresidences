const express = require("express");

const {
  getBookingContext,
  validatePromoCode,
} = require("../controllers/publicBookingController");
const { createPublicReservation } = require("../controllers/reservationsController");

const router = express.Router();

router.get("/booking/:maisonId", getBookingContext);
router.post("/promotions/validate", validatePromoCode);
router.post("/reservations", createPublicReservation);

module.exports = router;
