const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const usersRoutes = require("./routes/usersRoutes");
const maisonsRoutes = require("./routes/maisonsRoutes");
const prospectsRoutes = require("./routes/prospectsRoutes");
const clientsRoutes = require("./routes/clientsRoutes");
const hebergementRoutes = require("./routes/hebergementRoutes");
const { uploadsDir } = require("./middleware/uploadMiddleware");
const { testConnection } = require("../database/db");
const { ensurePasswordResetSchema } = require("../database/passwordResetSchema");
const { ensureHebergementCatalogues } = require("../database/hebergementCatalogSchema");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`
    );
  });

  next();
});

app.get("/", (req, res) => {
  res.json({ message: "Maroc Residences API is running." });
});

app.use("/api/users", usersRoutes);
app.use("/api/maisons", maisonsRoutes);
app.use("/api/prospects", prospectsRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/hebergement", hebergementRoutes);

async function startServer() {
  try {
    await testConnection();
  } catch (error) {
    console.error("Unable to connect to MySQL:", error.message);
    process.exit(1);
    return;
  }

  await ensurePasswordResetSchema();
  await ensureHebergementCatalogues();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log("[SERVER] Routes actives:");
    console.log("  - /api/users");
    console.log("  - /api/maisons");
    console.log("  - /api/prospects");
    console.log("  - /api/clients");
    console.log("  - /api/hebergement");
  });
}

startServer();