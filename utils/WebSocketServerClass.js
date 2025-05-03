const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

/**
 * WebSocketServer class for handling multiple WebSocket connections
 */
class WebSocketServerClass {
  constructor(options = {}) {
    // Default configuration
    this.port = options.port || 8080;
    this.path = options.path || "/";
    this.server = null;
    this.clients = new Map(); // Map to store active connections
    this.eventListeners = {
      connection: [],
      close: [],
      error: [],
      message: [],
      listening: [],
    };

    // Authentication handler (optional)
    this.authHandler = options.authHandler || null;

    // Allow CORS by default
    this.allowCORS = options.allowCORS !== false;
  }

  /**
   * Start the WebSocket server
   * @returns {Promise} Resolves when server is started
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocket.Server({
          port: this.port,
          path: this.path,
        });

        // Handle new connections
        this.server.on("connection", (socket, request) => {
          this._handleNewConnection(socket, request);
        });

        // Handle server errors
        this.server.on("error", (error) => {
          this._triggerEvent("error", error);
          reject(error);
        });

        // Server started successfully
        console.log(
          `WebSocket server running on port ${this.port}${this.path}`
        );
        this._triggerEvent("listening", { port: this.port, path: this.path });
        resolve();
      } catch (error) {
        console.error("Failed to start WebSocket server:", error);
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   * @returns {Promise} Resolves when server is stopped
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      // Close all client connections
      for (const [clientId, client] of this.clients) {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.close(1000, "Server shutting down");
        }
      }

      // Clear client map
      this.clients.clear();

      // Close the server
      this.server.close((error) => {
        if (error) {
          console.error("Error closing WebSocket server:", error);
          reject(error);
          return;
        }

        console.log("WebSocket server stopped");
        this._triggerEvent("close", { message: "Server stopped" });
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Register event listener
   * @param {string} event - Event name (connection, close, error, message)
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(
        (cb) => cb !== callback
      );
    }
  }

  /**
   * Send message to a specific client
   * @param {string} clientId - Client identifier
   * @param {Object|string} data - Data to send
   * @returns {boolean} Whether the send was successful
   */
  sendTo(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const payload = typeof data === "object" ? JSON.stringify(data) : data;
      client.socket.send(payload);
      return true;
    } catch (error) {
      console.error(`Error sending to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object|string} data - Data to broadcast
   * @param {string|null} excludeClientId - Client to exclude from broadcast (optional)
   * @returns {number} Number of clients message was sent to
   */
  broadcast(data, excludeClientId = null) {
    let sentCount = 0;
    const payload = typeof data === "object" ? JSON.stringify(data) : data;

    for (const [clientId, client] of this.clients) {
      // Skip excluded client if specified
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }

      // Send only to connected clients
      if (client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(payload);
          sentCount++;
        } catch (error) {
          console.error(`Error broadcasting to client ${clientId}:`, error);
        }
      }
    }

    return sentCount;
  }

  /**
   * Get the number of connected clients
   * @returns {number} Client count
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Get all connected client IDs
   * @returns {Array} Array of client IDs
   */
  getClientIds() {
    return Array.from(this.clients.keys());
  }

  /**
   * Get client connection info
   * @param {string} clientId - Client identifier
   * @returns {Object|null} Client info or null if not found
   */
  getClientInfo(clientId) {
    const client = this.clients.get(clientId);
    if (!client) {
      return null;
    }

    return {
      id: clientId,
      ip: client.ip,
      connectTime: client.connectTime,
      metadata: client.metadata,
    };
  }

  /**
   * Set metadata for a client
   * @param {string} clientId - Client identifier
   * @param {Object} metadata - Metadata to set
   * @returns {boolean} Whether the update was successful
   */
  setClientMetadata(clientId, metadata) {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.metadata = { ...client.metadata, ...metadata };
    return true;
  }

  /**
   * Disconnect a specific client
   * @param {string} clientId - Client identifier
   * @param {number} code - Close code (defaults to 1000 - normal closure)
   * @param {string} reason - Close reason
   * @returns {boolean} Whether the disconnect was successful
   */
  disconnectClient(clientId, code = 1000, reason = "Disconnected by server") {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.close(code, reason);
      }
      return true;
    } catch (error) {
      console.error(`Error disconnecting client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Handle a new WebSocket connection
   * @private
   */
  _handleNewConnection(socket, request) {
    // Generate a unique ID for this client
    const clientId = uuidv4();

    // Get client IP address
    const ip =
      request.socket.remoteAddress ||
      request.headers["x-forwarded-for"]?.split(",")[0].trim();

    // Handle authentication if configured
    if (this.authHandler) {
      try {
        const authResult = this.authHandler(request);
        if (!authResult) {
          socket.close(4401, "Unauthorized");
          return;
        }
      } catch (error) {
        console.error("Authentication error:", error);
        socket.close(4500, "Authentication error");
        return;
      }
    }

    // Store client information
    const clientInfo = {
      socket,
      ip,
      connectTime: Date.now(),
      metadata: {},
    };

    this.clients.set(clientId, clientInfo);

    // Setup socket event handlers
    socket.on("message", (message) => {
      let parsedMessage;

      // Try to parse JSON messages
      if (typeof message === "string" || message instanceof Buffer) {
        try {
          parsedMessage = JSON.parse(message.toString());
        } catch (e) {
          // If not valid JSON, use raw message
          parsedMessage = message.toString();
        }
      } else {
        parsedMessage = message;
      }

      // Trigger message event with context
      this._triggerEvent("message", {
        clientId,
        message: parsedMessage,
        raw: message,
      });
    });

    socket.on("close", (code, reason) => {
      // Remove client from the map
      this.clients.delete(clientId);

      // Trigger close event with context
      this._triggerEvent("close", {
        clientId,
        code,
        reason: reason?.toString() || "",
      });
    });

    socket.on("error", (error) => {
      // Trigger error event with context
      this._triggerEvent("error", {
        clientId,
        error,
      });
    });

    // Trigger connection event with context
    this._triggerEvent("connection", {
      clientId,
      ip,
      request,
    });
  }

  /**
   * Trigger event callbacks
   * @private
   */
  _triggerEvent(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach((callback) => callback(data));
    }
  }
}

module.exports = WebSocketServerClass;
