const express = require("express");

const { getDashboardStats } = require("../controllers/dashboardController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/stats", requireAuth, requireStaff, getDashboardStats);

module.exports = router;
