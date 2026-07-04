const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const usersRoutes = require("./routes/usersRoutes");
const maisonsRoutes = require("./routes/maisonsRoutes");
const { uploadsDir } = require("./middleware/uploadMiddleware");
const { testConnection } = require("../database/db");

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

async function startServer() {
  try {
    await testConnection();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log("[SERVER] Logs actifs: chaque requete + register affiche role_id dans le terminal");
    });
  } catch (error) {
    console.error("Unable to connect to MySQL:", error.message);
    process.exit(1);
  }
}

startServer();