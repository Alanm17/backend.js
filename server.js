const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const notificationRoutes = require("./routes/notifications");
const { User } = require("./models/User");
const { fetchTenantData } = require("./models/Tenant");
const { analyticsController } = require("./controllers/analyticsController");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(
  cors({
    origin: "https://your-frontend.vercel.app", // or '*' for development
  })
);

// Tenant Middleware
const tenantMiddleware = async (req, res, next) => {
  const tenantId = req.headers["x-tenant-id"] || req.query.tenantId;
  if (!tenantId || typeof tenantId !== "string") {
    return res.status(400).json({ error: "Tenant ID is required" });
  }
  app.use("/api", tenantMiddleware); // or apply per-route

  try {
    const tenant = await fetchTenantData(tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    req.tenant = tenant;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Feature Toggle Middleware
const checkFeature = (feature) => (req, res, next) => {
  if (!req.tenant?.config?.features?.[feature]) {
    return res.status(403).json({ error: `${feature} not enabled` });
  }
  next();
};

app.get("/api/tenant", tenantMiddleware, (req, res) => res.json(req.tenant));

app.get(
  "/api/analytics",
  tenantMiddleware,
  checkFeature("analytics"),
  (req, res) => res.json(analyticsController)
);

app
  .route("/api/users")
  .get(tenantMiddleware, checkFeature("userManagement"), (req, res) => {
    try {
      const safeUsers = User.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  })
  .post(tenantMiddleware, checkFeature("userManagement"), (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const password = Math.random().toString(36).slice(-8);
    const newUser = { name, email, status: "Pending", password };
    User.push(newUser);

    const { password: _, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  });

app.get(
  "/api/notifications",
  tenantMiddleware,
  checkFeature("notifications"),
  (req, res) => {
    const notifications = [
      {
        id: 1,
        message: "System update available",
        timestamp: new Date().toISOString(),
        read: false,
      },
      {
        id: 2,
        message: "New user joined the system",
        timestamp: new Date().toISOString(),
        read: false,
      },
    ];
    res.json(notifications);
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app };
