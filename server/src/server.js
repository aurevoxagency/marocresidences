const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const usersRoutes = require("./routes/usersRoutes");
const maisonsRoutes = require("./routes/maisonsRoutes");
const prospectsRoutes = require("./routes/prospectsRoutes");
const clientsRoutes = require("./routes/clientsRoutes");
const hebergementRoutes = require("./routes/hebergementRoutes");
const promotionsRoutes = require("./routes/promotionsRoutes");
const reservationsRoutes = require("./routes/reservationsRoutes");
const devisRoutes = require("./routes/devisRoutes");
const commandesRoutes = require("./routes/commandesRoutes");
const facturesRoutes = require("./routes/facturesRoutes");
const checkinsRoutes = require("./routes/checkinsRoutes");
const journalTransactionsRoutes = require("./routes/journalTransactionsRoutes");
const avisClientsRoutes = require("./routes/avisClientsRoutes");
const publicBookingRoutes = require("./routes/publicBookingRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const { uploadsDir } = require("./middleware/uploadMiddleware");
const { testConnection } = require("../database/db");
const { ensurePasswordResetSchema } = require("../database/passwordResetSchema");
const { ensureHebergementCatalogues } = require("../database/hebergementCatalogSchema");
const { ensureJournalTransactionsSchema } = require("../database/journalTransactionsSchema");

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
app.use("/api/promotions", promotionsRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/devis", devisRoutes);
app.use("/api/commandes", commandesRoutes);
app.use("/api/factures", facturesRoutes);
app.use("/api/checkins", checkinsRoutes);
app.use("/api/journal-transactions", journalTransactionsRoutes);
app.use("/api/avis-clients", avisClientsRoutes);
app.use("/api/hebergement", hebergementRoutes);
app.use("/api/public", publicBookingRoutes);
app.use("/api/dashboard", dashboardRoutes);

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
  await ensureJournalTransactionsSchema();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log("[SERVER] Routes actives:");
    console.log("  - /api/users");
    console.log("  - /api/maisons");
    console.log("  - /api/prospects");
    console.log("  - /api/clients");
    console.log("  - /api/promotions");
    console.log("  - /api/reservations");
    console.log("  - /api/devis");
    console.log("  - /api/commandes");
    console.log("  - /api/factures");
    console.log("  - /api/checkins");
    console.log("  - /api/journal-transactions");
    console.log("  - /api/avis-clients");
    console.log("  - /api/hebergement");
    console.log("  - /api/public");
    console.log("  - /api/dashboard");
  });
}

startServer();