// routes/notifications.js
const express = require("express");
const app = express();
// Notification routes expect both Express app and Socket.IO io instance
module.exports = (app, io) => {
  // Middleware to parse JSON body (if not already used globally)
  app.use(express.json());

  // Endpoint to send a notification to a tenant room
  app.post("/api/notifications/send", (req, res) => {
    const { tenantId, message } = req.body;

    if (!tenantId || !message) {
      return res
        .status(400)
        .json({ error: "Tenant ID and message are required" });
    }

    // Emit the notification event to the tenant's socket room
    io.to(tenantId).emit("notification", message);

    res.status(200).json({ message: "Notification sent" });
  });

  // Handle socket connections and join rooms by tenantId
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("joinTenantRoom", (tenantId) => {
      if (typeof tenantId === "string") {
        socket.join(tenantId);
        console.log(`Socket ${socket.id} joined tenant room: ${tenantId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
