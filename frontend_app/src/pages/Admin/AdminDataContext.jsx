import { createContext, useContext, useMemo, useState } from "react";
import { adminSeedData } from "../../consts/adminData.js";

const AdminDataContext = createContext(null);

function cloneSeedData() {
  return structuredClone(adminSeedData);
}

function makeId(entity) {
  return `${entity.slice(0, 3)}-${Date.now().toString(36)}`;
}

export function AdminDataProvider({ children }) {
  const [data, setData] = useState(cloneSeedData);

  const createItem = (entity, item) => {
    const nextItem = { ...item, id: makeId(entity) };
    setData((current) => ({ ...current, [entity]: [nextItem, ...current[entity]] }));
    return nextItem;
  };

  const updateItem = (entity, id, updates) => {
    setData((current) => ({
      ...current,
      [entity]: current[entity].map((item) => (item.id === id ? { ...item, ...updates, id } : item)),
    }));
  };

  const removeItem = (entity, id) => {
    setData((current) => ({
      ...current,
      [entity]: current[entity].filter((item) => item.id !== id),
    }));
  };

  const value = useMemo(
    () => ({ data, createItem, updateItem, removeItem }),
    [data],
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) throw new Error("useAdminData must be used within AdminDataProvider");
  return context;
}
