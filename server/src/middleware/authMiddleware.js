const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization token is required." });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "change-this-secret-in-production"
    );

    req.auth = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

const ADMIN_ROLE_IDS = new Set([1, 2]);
const STAFF_ROLE_IDS = new Set([1, 2, 4]); // super_admin, admin, receptionniste (pas client)

function requireAdmin(req, res, next) {
  const roleId = Number(req.auth?.role_id);

  if (!ADMIN_ROLE_IDS.has(roleId)) {
    return res.status(403).json({ message: "Admin access required." });
  }

  return next();
}

function requireStaff(req, res, next) {
  const roleId = Number(req.auth?.role_id);

  if (!STAFF_ROLE_IDS.has(roleId)) {
    return res.status(403).json({ message: "Staff access required." });
  }

  return next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireStaff,
};
