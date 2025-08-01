const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { Users } = require("./models/Users");
const { fetchTenantData } = require("./models/Tenant");
const { analyticsController } = require("./controllers/analyticsController");

const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "https://dashbro.netlify.app/",
    methods: ["GET", "POST"],
    allowedHeaders: ["x-tenant-id"],
  },
});
const bodyParser = require("body-parser");
const PORT = 3001;

// Cache settings
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const tenantCache = {};
const analyticsCache = {};
const usersCache = {};

// CORS configuration
app.use(
  cors({
    origin: "https://dashbro.netlify.app/", // Frontend URL
    methods: ["GET"], // Adjust methods if needed
    allowedHeaders: ["x-tenant-id"],
  })
);

app.use(bodyParser.json());

// Performance monitoring middleware
const performanceMiddleware = (req, res, next) => {
  req.startTime = Date.now();

  // Override res.json to add timing information
  const originalJson = res.json;
  res.json = function (body) {
    const duration = Date.now() - req.startTime;
    console.log(`[${req.method}] ${req.path} - Response time: ${duration}ms`);
    return originalJson.call(this, body);
  };

  next();
};

app.use(performanceMiddleware);

// Tenant Middleware with caching
const tenantMiddleware = async (req, res, next) => {
  const tenantId = req.headers["x-tenant-id"];
  console.log("Received tenant ID:", tenantId);

  if (!tenantId || typeof tenantId !== "string") {
    return res.status(400).json({ error: "Tenant ID is required" });
  }

  try {
    // Check cache first
    const cacheKey = `tenant_${tenantId}`;
    const cachedData = tenantCache[cacheKey];

    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log(`Using cached tenant data for ${tenantId}`);
      req.tenant = cachedData.data;
      return next();
    }

    // Fetch if not in cache or expired
    const tenant = await fetchTenantData(tenantId);

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Update cache
    tenantCache[cacheKey] = {
      data: tenant,
      timestamp: Date.now(),
    };

    req.tenant = tenant;
    next();
  } catch (err) {
    console.error("Tenant middleware error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Feature Toggle Middleware
const checkFeature = (feature) => (req, res, next) => {
  if (!req.tenant?.config?.features?.[feature]) {
    return res
      .status(403)
      .json({ error: `${feature} not enabled for this tenant` });
  }
  next();
};

// API Routes
app.get("/api/tenant", tenantMiddleware, (req, res) => {
  try {
    res.json(req.tenant);
  } catch (error) {
    console.error("Error in tenant route:", error);
    res.status(500).json({ error: "Failed to retrieve tenant data" });
  }
});

app.get(
  "/api/analytics",
  tenantMiddleware,
  checkFeature("analytics"),
  async (req, res) => {
    try {
      const tenantId = req.headers["x-tenant-id"];
      const cacheKey = `analytics_${tenantId}`;

      // Check cache
      const cachedData = analyticsCache[cacheKey];
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
        console.log(`Using cached analytics data for ${tenantId}`);
        return res.json(cachedData.data);
      }

      // Simulate async operation if analyticsController is an async function
      const data =
        typeof analyticsController === "function"
          ? await analyticsController(req.tenant)
          : analyticsController;

      // Update cache
      analyticsCache[cacheKey] = {
        data,
        timestamp: Date.now(),
      };

      res.json(data);
    } catch (error) {
      console.error("Error in analytics route:", error);
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

      // Check cache
      const cachedData = usersCache[cacheKey];
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
        console.log(`Using cached users data for ${tenantId}`);
        return res.json(cachedData.data);
      }

      // Get users data (using await in case Users is or becomes async)
      const data = Array.isArray(Users)
        ? Users
        : typeof Users === "function"
        ? await Users(req.tenant)
        : [];

      // Update cache
      usersCache[cacheKey] = {
        data,
        timestamp: Date.now(),
      };

      res.json(data);
    } catch (error) {
      console.error("Error in users route:", error);
      res.status(500).json({ error: "Failed to retrieve users data" });
    }
  }
);

// Register notifications route
const notificationsRoute = require("./routes/notifications");
notificationsRoute(app, io);

// Error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "An unexpected error occurred",
    message: err.message, // Include error message by default for debugging
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

// Cache cleanup interval (optional)
setInterval(() => {
  const now = Date.now();
  // Clean tenant cache
  Object.keys(tenantCache).forEach((key) => {
    if (now - tenantCache[key].timestamp > CACHE_TTL) {
      delete tenantCache[key];
    }
  });

  // Clean analytics cache
  Object.keys(analyticsCache).forEach((key) => {
    if (now - analyticsCache[key].timestamp > CACHE_TTL) {
      delete analyticsCache[key];
    }
  });

  // Clean users cache
  Object.keys(usersCache).forEach((key) => {
    if (now - usersCache[key].timestamp > CACHE_TTL) {
      delete usersCache[key];
    }
  });

  console.log("Cache cleanup performed");
}, CACHE_TTL); // Run cleanup at the same interval as the TTL
