const express = require("express");

const { getBookingContext } = require("../controllers/publicBookingController");
const { createPublicReservation } = require("../controllers/reservationsController");

const router = express.Router();

router.get("/booking/:maisonId", getBookingContext);
router.post("/reservations", createPublicReservation);

module.exports = router;
