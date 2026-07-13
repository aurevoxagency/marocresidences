const express = require("express");

const {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/journalTransactionsController");
const { requireAuth, requireStaff } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOnly = [requireAuth, requireStaff];

router.get("/", ...staffOnly, getTransactions);
router.get("/:id", ...staffOnly, getTransactionById);
router.post("/", ...staffOnly, createTransaction);
router.put("/:id", ...staffOnly, updateTransaction);
router.delete("/:id", ...staffOnly, deleteTransaction);

module.exports = router;
