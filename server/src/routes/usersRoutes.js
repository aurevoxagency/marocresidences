const express = require("express");

const {
  getAllUsers,
  getUserById,
  getCurrentUser,
  registerUser,
  registerClientUser,
  loginUser,
  updateCurrentUser,
  updateUser,
  deleteUser,
  requestPasswordReset,
  resetPassword,
} = require("../controllers/usersController");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();
const adminOnly = [requireAuth, requireAdmin];

router.post("/register", registerClientUser);
router.post("/login", loginUser);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.get("/me", requireAuth, getCurrentUser);
router.put("/me", requireAuth, updateCurrentUser);

router.get("/", ...adminOnly, getAllUsers);
router.get("/:id", ...adminOnly, getUserById);
router.post("/", ...adminOnly, registerUser);
router.put("/:id", ...adminOnly, updateUser);
router.delete("/:id", ...adminOnly, deleteUser);

module.exports = router;
