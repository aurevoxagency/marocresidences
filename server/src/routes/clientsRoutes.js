const express = require("express");

const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} = require("../controllers/clientsController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/", ...staffOnly, getClients);
router.get("/:id", ...staffOnly, getClientById);
router.post("/", ...staffOnly, createClient);
router.put("/:id", ...staffOnly, updateClient);
router.delete("/:id", ...staffOnly, deleteClient);

module.exports = router;
