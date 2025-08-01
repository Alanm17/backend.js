const express = require("express");
const cors = require("cors");
const http = require("http");
const bodyParser = require("body-parser");
require("dotenv").config();

const { Users } = require("./models/Users"); // assumed hardcoded data
const { fetchTenantData } = require("./models/Tenant"); // assumed hardcoded logic
const { analyticsController } = require("./controllers/analyticsController");

const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "https://dashbro.netlify.app",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;

// ===== Cache Settings =====
const CACHE_TTL = 5 * 60 * 1000;
const tenantCache = {};
const analyticsCache = {};
const usersCache = {};

// ===== Middleware =====
app.use(
  cors({
    origin: (origin, callback) => {
      console.log("CORS Origin request:", origin);
      if (origin === "https://dashbro.netlify.app") {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-tenant-id"],
    credentials: true,
  })
);

app.use(bodyParser.json());

// ===== Performance Logging =====
app.use((req, res, next) => {
  req.startTime = Date.now();
  const originalJson = res.json;
  res.json = function (body) {
    const duration = Date.now() - req.startTime;
    console.log(`[${req.method}] ${req.path} - ${duration}ms`);
    return originalJson.call(this, body);
  };
  next();
});

// ===== Tenant Middleware (with Cache) =====
const tenantMiddleware = async (req, res, next) => {
  const tenantId = req.headers["x-tenant-id"];
  if (!tenantId || typeof tenantId !== "string") {
    return res.status(400).json({ error: "Tenant ID is required" });
  }

  const cacheKey = `tenant_${tenantId}`;
  const cached = tenantCache[cacheKey];

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    req.tenant = cached.data;
    return next();
  }

  try {
    const tenant = await fetchTenantData(tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    tenantCache[cacheKey] = { data: tenant, timestamp: Date.now() };
    req.tenant = tenant;
    next();
  } catch (err) {
    console.error("Tenant error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ===== Feature Toggle Middleware =====
const checkFeature = (feature) => (req, res, next) => {
  if (!req.tenant?.config?.features?.[feature]) {
    return res
      .status(403)
      .json({ error: `${feature} not enabled for this tenant` });
  }
  next();
};

// ===== Routes =====

app.get("/healthz", (req, res) => {
  res.send("OK");
});

app.get("/api/tenant", tenantMiddleware, (req, res) => {
  res.json(req.tenant);
});

app.get(
  "/api/analytics",
  tenantMiddleware,
  checkFeature("analytics"),
  async (req, res) => {
    try {
      const tenantId = req.headers["x-tenant-id"];
      const cacheKey = `analytics_${tenantId}`;

      const cached = analyticsCache[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json(cached.data);
      }

      const data =
        typeof analyticsController === "function"
          ? await analyticsController(req.tenant)
          : analyticsController;

      analyticsCache[cacheKey] = { data, timestamp: Date.now() };
      res.json(data);
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to retrieve analytics data" });
    }
  }
);

app.get(
  "/api/users",
  tenantMiddleware,
  checkFeature("userManagement"),
  async (req, res) => {
    try {
      const tenantId = req.headers["x-tenant-id"];
      const cacheKey = `users_${tenantId}`;

      const cached = usersCache[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json(cached.data);
      }

      const data = Array.isArray(Users)
        ? Users
        : typeof Users === "function"
        ? await Users(req.tenant)
        : [];

      usersCache[cacheKey] = { data, timestamp: Date.now() };
      res.json(data);
    } catch (error) {
      console.error("Users error:", error);
      res.status(500).json({ error: "Failed to retrieve users data" });
    }
  }
);

// ===== Notifications Route (Socket.IO) =====
const notificationsRoute = require("./routes/notifications");
notificationsRoute(app, io);

// ===== Global Error Handler =====
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(500)
    .json({ error: "An unexpected error occurred", message: err.message });
});

// ===== Start Server =====
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 API available at: https://backend-js-tzs3.onrender.com/api`);
});

// ===== Cache Cleanup Interval =====
setInterval(() => {
  const now = Date.now();
  const cleanCache = (cache) => {
    Object.keys(cache).forEach((key) => {
      if (now - cache[key].timestamp > CACHE_TTL) {
        delete cache[key];
      }
    });
  };
  cleanCache(tenantCache);
  cleanCache(analyticsCache);
  cleanCache(usersCache);
  console.log("♻️ Cache cleanup performed");
}, CACHE_TTL);
