# 🏗️ Multi-Tenant Feature-Toggled API Server

This is a Node.js and Express-based REST API server that supports **multi-tenancy** and **feature toggling**. Each tenant can have different access to features such as analytics, user management, and notifications. It is structured with modular controllers and models, and uses middleware to enforce tenant-based restrictions.

---

## 🚀 Features

- 🏢 **Multi-Tenancy Support** via `x-tenant-id` or `tenantId` query param
- 🔐 **Feature Toggles** per tenant (`analytics`, `userManagement`, `notifications`)
- 👥 **User Management** (list and create users)
- 📊 **Analytics Endpoint**
- 🔔 **Mock Notifications Endpoint**
- 🧱 Modular structure using Express routers, controllers, and models

---

## 🛠️ Tech Stack

- **Node.js**, **Express.js**
- **CORS** and **body-parser**
- **dotenv** for environment variables
- **Custom Middleware** for tenant logic and feature checks

1. Clone the Repository

```bash
1 git clone <your-repository-url>
2 cd backend

3 npm install
4 node server.js
```
# backend.js
