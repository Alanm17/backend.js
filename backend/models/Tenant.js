const Tenant = {
  acme: {
    id: 1,
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
    id: 2,
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
    id: 3,
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

// Fetch tenant data by numeric ID
const fetchTenantData = async (id) => {
  const tenant = Object.values(Tenant).find((t) => t.id === parseInt(id));
  return tenant || null;
};

module.exports = { fetchTenantData, Tenant };
