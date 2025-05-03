const Tenant = {
  acme: {
    id: "acme",
    name: "ACME Corporation",
    domain: "acme.example.com",
    logo: "🏢",
    config: {
      theme: "light",
      features: {
        analytics: true,
        userManagement: true,
        chat: true,
        notifications: true,
      },
      primaryColor: "#3b82f6",
    },
  },
  startx: {
    id: "startx",
    name: "StartX Ventures",
    domain: "startx.example.com",
    logo: "🚀",
    config: {
      theme: "dark",
      features: {
        analytics: true,
        userManagement: true,
        chat: false,
        notifications: false,
      },
      primaryColor: "#10b981",
    },
  },
  quantum: {
    id: "quantum",
    name: "Quantum Industries",
    domain: "quantum.example.com",
    logo: "⚛️",
    config: {
      theme: "dark",
      features: {
        analytics: false,
        userManagement: true,
        chat: true,
        notifications: true,
      },
      primaryColor: "#8b5cf6",
    },
  },
};

// Fetch tenant data
const fetchTenantData = async (tenantId) => {
  return Tenant[tenantId] || Tenant["acme"];
};

module.exports = { fetchTenantData, Tenant };
