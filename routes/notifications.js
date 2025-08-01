// routes/notifications.js
// Notification route expects both app and io
module.exports = (app, io) => {
  // Example route to emit a notification
  app.post("/api/notifications/send", (req, res) => {
    const { tenantId, message } = req.body;
    if (!tenantId || !message) {
      return res
        .status(400)
        .json({ error: "Tenant ID and message are required" });
    }
    // Emit notification to the tenant's room
    io.to(tenantId).emit("notification", message);
    res.status(200).send("Notification sent");
  });
};
