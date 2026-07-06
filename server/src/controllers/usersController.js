const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const { pool } = require("../../database/db");
const { sendPasswordResetEmail } = require("../services/emailService");

const CLIENT_ROLE_ID = 3;
const PASSWORD_RESET_EXPIRY_HOURS = 1;
const GENERIC_RESET_MESSAGE =
  "Si un compte existe avec cette adresse e-mail, un lien de réinitialisation vient d'être envoyé.";

const PUBLIC_USER_FIELDS = `
  id,
  first_name,
  last_name,
  email,
  phone,
  role_id,
  terms_accepted,
  email_verified_at,
  created_at,
  updated_at
`;

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    terms_accepted: Boolean(user.terms_accepted),
  };
}

async function getAllUsers(req, res) {
  try {
    const [users] = await pool.query(
      `SELECT ${PUBLIC_USER_FIELDS} FROM users ORDER BY created_at DESC`
    );

    res.status(200).json(users.map(normalizeUser));
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Unable to fetch users." });
  }
}

async function getUserById(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json(normalizeUser(rows[0]));
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ message: "Unable to fetch the user." });
  }
}

async function getCurrentUser(req, res) {
  try {
    const userId = req.auth?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const [rows] = await pool.query(
      `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({
      user: normalizeUser(rows[0]),
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    return res.status(500).json({ message: "Unable to fetch current user." });
  }
}

async function createUser(req, res, options = {}) {
  try {
    const { forceClientRole = false } = options;
    const {
      first_name,
      last_name,
      email,
      phone = null,
      password,
      role_id,
      terms_accepted,
    } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({
        message: "first_name, last_name, email and password are required.",
      });
    }

    if (!terms_accepted) {
      return res.status(400).json({
        message: "Terms must be accepted before registration.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [existingUsers] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: "This email is already in use." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const resolvedRoleId = forceClientRole
      ? CLIENT_ROLE_ID
      : role_id !== undefined && role_id !== null && role_id !== "" && Number(role_id) > 0
        ? Number(role_id)
        : CLIENT_ROLE_ID;

    console.log("createUser role debug:", {
      forceClientRole,
      incomingRoleId: role_id,
      resolvedRoleId,
      email: normalizedEmail,
    });

    const insertValues = [
      first_name,
      last_name,
      normalizedEmail,
      phone,
      passwordHash,
      resolvedRoleId,
      terms_accepted ? 1 : 0,
    ];

    console.log("createUser INSERT values:", {
      role_id_param: insertValues[5],
      allValues: insertValues,
    });

    const [result] = await pool.query(
      `
        INSERT INTO users
        (first_name, last_name, email, phone, password_hash, role_id, terms_accepted, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      insertValues
    );

    const [newUserRows] = await pool.query(
      `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    const createdUser = normalizeUser(newUserRows[0]);

    console.log("createUser saved in DB:", {
      userId: createdUser?.id,
      email: createdUser?.email,
      role_id: createdUser?.role_id,
      expectedRoleId: CLIENT_ROLE_ID,
    });

    return res.status(201).json({
      message: "User created successfully.",
      user: createdUser,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    return res.status(500).json({ message: "Unable to create the user." });
  }
}

async function registerUser(req, res) {
  return createUser(req, res);
}

async function registerClientUser(req, res) {
  console.log("=== REGISTER /api/users/register ===");
  console.log("registerClientUser incoming body:", {
    email: req.body?.email,
    incomingRoleId: req.body?.role_id,
    forcedRoleId: CLIENT_ROLE_ID,
  });

  req.body = {
    ...req.body,
    role_id: CLIENT_ROLE_ID,
  };

  console.log("registerClientUser after force role_id:", req.body.role_id);

  return createUser(req, res, { forceClientRole: true });
}

async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "email and password are required.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query(
      `SELECT ${PUBLIC_USER_FIELDS}, password_hash FROM users WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
      },
      process.env.JWT_SECRET || "change-this-secret-in-production",
      { expiresIn: "7d" }
    );

    delete user.password_hash;

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: normalizeUser(user),
    });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "Unable to log in." });
  }
}

async function updateCurrentUser(req, res) {
  const userId = req.auth?.id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  req.params = { ...req.params, id: String(userId) };
  req.body = {
    first_name: req.body?.first_name,
    last_name: req.body?.last_name,
    email: req.body?.email,
    phone: req.body?.phone,
    password: req.body?.password,
  };

  return updateUser(req, res);
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      role_id,
      terms_accepted,
      password,
      email_verified_at,
    } = req.body;

    const fields = [];
    const values = [];

    if (first_name !== undefined) {
      fields.push("first_name = ?");
      values.push(first_name);
    }

    if (last_name !== undefined) {
      fields.push("last_name = ?");
      values.push(last_name);
    }

    if (email !== undefined) {
      fields.push("email = ?");
      values.push(String(email).trim().toLowerCase());
    }

    if (phone !== undefined) {
      fields.push("phone = ?");
      values.push(phone);
    }

    if (role_id !== undefined) {
      fields.push("role_id = ?");
      values.push(role_id);
    }

    if (terms_accepted !== undefined) {
      fields.push("terms_accepted = ?");
      values.push(terms_accepted ? 1 : 0);
    }

    if (email_verified_at !== undefined) {
      fields.push("email_verified_at = ?");
      values.push(email_verified_at);
    }

    if (password !== undefined) {
      const passwordHash = await bcrypt.hash(password, 10);
      fields.push("password_hash = ?");
      values.push(passwordHash);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        message: "Provide at least one field to update.",
      });
    }

    fields.push("updated_at = NOW()");
    values.push(id);

    const [result] = await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const [updatedRows] = await pool.query(
      `SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
      [id]
    );

    return res.status(200).json({
      message: "User updated successfully.",
      user: normalizeUser(updatedRows[0]),
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ message: "Unable to update the user." });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ message: "Unable to delete the user." });
  }
}

function getClientAppUrl() {
  return (
    process.env.CLIENT_URL ||
    process.env.APP_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "L'adresse e-mail est requise.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [users] = await pool.query(
      "SELECT id, first_name, email FROM users WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if (users.length > 0) {
      const user = users[0];
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      await pool.query(
        "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
        [user.id]
      );

      await pool.query(
        `
          INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
          VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))
        `,
        [user.id, tokenHash, PASSWORD_RESET_EXPIRY_HOURS]
      );

      const resetUrl = `${getClientAppUrl()}/reset-password?token=${rawToken}`;

      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        firstName: user.first_name,
      });
    }

    return res.status(200).json({
      message: GENERIC_RESET_MESSAGE,
    });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    return res.status(500).json({
      message: "Impossible d'envoyer le lien de réinitialisation.",
    });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: "Le lien et le nouveau mot de passe sont requis.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        message: "Le mot de passe doit contenir au moins 8 caractères.",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");

    const [tokens] = await pool.query(
      `
        SELECT id, user_id
        FROM password_reset_tokens
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
        LIMIT 1
      `,
      [tokenHash]
    );

    const matchedToken = tokens[0];

    if (!matchedToken) {
      return res.status(400).json({
        message: "Ce lien de réinitialisation est invalide ou expiré.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?", [
      passwordHash,
      matchedToken.user_id,
    ]);

    await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [
      matchedToken.id,
    ]);

    await pool.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL",
      [matchedToken.user_id]
    );

    return res.status(200).json({
      message: "Votre mot de passe a été réinitialisé avec succès.",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({
      message: "Impossible de réinitialiser le mot de passe.",
    });
  }
}

module.exports = {
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
};
