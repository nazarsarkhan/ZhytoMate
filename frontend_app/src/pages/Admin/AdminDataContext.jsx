import { createContext, useContext, useMemo, useState } from "react";
import { adminSeedData } from "../../consts/adminData.js";
import {
  useAdminSurveys,
  useCreateSurvey,
  useDeleteSurvey,
  useUpdateSurvey,
} from "../../hooks/useAdminSurveys.js";
import { useAdminAppeals, useRespondAppeal } from "../../hooks/useAdminAppeals.js";
import {
  useAdminContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
} from "../../hooks/useContacts.js";

const AdminDataContext = createContext(null);

// Entities backed by real endpoints (create/update/remove route through mutations, list comes from
// react-query). The rest (users, announcements, news) stay on the in-memory seed prototype until
// they get their own backend.
const LIVE_ENTITIES = new Set(["surveys", "appeals", "contacts"]);

function cloneSeedData() {
  return structuredClone(adminSeedData);
}

function makeId(entity) {
  return `${entity.slice(0, 3)}-${Date.now().toString(36)}`;
}

// --- API <-> admin-form mappers -------------------------------------------------------------

// Backend surveys carry `isActive`; the admin UI models it as a status enum.
function mapSurveyFromApi(survey) {
  return {
    ...survey,
    status: survey.isActive ? "active" : "draft",
    startsAt: survey.startsAt || "",
    endsAt: survey.endsAt || "",
    totalVotes: survey.totalVotes ?? 0,
    options: survey.options ?? [],
  };
}

function surveyToApi(form, { allowOptions }) {
  const payload = {
    title: form.title,
    description: form.description || "",
    category: form.category || "",
    startsAt: form.startsAt ? form.startsAt : null,
    endsAt: form.endsAt ? form.endsAt : null,
    isActive: form.status !== "draft",
  };
  if (allowOptions) {
    payload.options = (form.options || [])
      .map((option) => (option.label || "").trim())
      .filter(Boolean);
  }
  return payload;
}

function mapAppealFromApi(appeal) {
  return {
    ...appeal,
    // Flatten the populated reporter to a display string for the generic list/detail views.
    user: appeal.user?.name || appeal.userId || "—",
  };
}

// --- Provider --------------------------------------------------------------------------------

export function AdminDataProvider({ children }) {
  const [seedData, setSeedData] = useState(cloneSeedData);

  const surveysQuery = useAdminSurveys();
  const appealsQuery = useAdminAppeals();
  const contactsQuery = useAdminContacts();

  const createSurvey = useCreateSurvey();
  const updateSurvey = useUpdateSurvey();
  const deleteSurvey = useDeleteSurvey();
  const respondAppeal = useRespondAppeal();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const data = useMemo(
    () => ({
      ...seedData,
      surveys: (surveysQuery.data ?? []).map(mapSurveyFromApi),
      appeals: (appealsQuery.data ?? []).map(mapAppealFromApi),
      contacts: contactsQuery.data ?? [],
    }),
    [seedData, surveysQuery.data, appealsQuery.data, contactsQuery.data],
  );

  const createItem = (entity, item) => {
    if (entity === "surveys") {
      createSurvey.mutate(surveyToApi(item, { allowOptions: true }));
      return item;
    }
    if (entity === "contacts") {
      createContact.mutate({
        name: item.name,
        phone: item.phone,
        icon: item.icon || "call",
        group: item.group || "",
        kind: item.kind || "utility",
      });
      return item;
    }
    // Appeals cannot be created from the admin panel; only citizens file them.
    if (entity === "appeals") return item;

    const nextItem = { ...item, id: makeId(entity) };
    setSeedData((current) => ({ ...current, [entity]: [nextItem, ...current[entity]] }));
    return nextItem;
  };

  const updateItem = (entity, id, updates) => {
    if (entity === "surveys") {
      // Omit options once votes exist - the backend rejects option changes on voted surveys.
      const allowOptions = Number(updates.totalVotes || 0) === 0;
      updateSurvey.mutate({ id, updates: surveyToApi(updates, { allowOptions }) });
      return;
    }
    if (entity === "appeals") {
      respondAppeal.mutate({
        id,
        updates: { status: updates.status, response: updates.response ?? "" },
      });
      return;
    }
    if (entity === "contacts") {
      updateContact.mutate({
        id,
        updates: {
          name: updates.name,
          phone: updates.phone,
          icon: updates.icon || "call",
          group: updates.group || "",
          kind: updates.kind || "utility",
        },
      });
      return;
    }

    setSeedData((current) => ({
      ...current,
      [entity]: current[entity].map((entry) =>
        entry.id === id ? { ...entry, ...updates, id } : entry,
      ),
    }));
  };

  const removeItem = (entity, id) => {
    if (entity === "surveys") {
      deleteSurvey.mutate(id);
      return;
    }
    if (entity === "contacts") {
      deleteContact.mutate(id);
      return;
    }
    // Appeals aren't deletable from the admin panel.
    if (entity === "appeals") return;

    setSeedData((current) => ({
      ...current,
      [entity]: current[entity].filter((entry) => entry.id !== id),
    }));
  };

  const value = useMemo(
    () => ({ data, createItem, updateItem, removeItem, liveEntities: LIVE_ENTITIES }),
    // createItem/updateItem/removeItem close over stable mutation handles; data drives re-renders.
    [data],
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) throw new Error("useAdminData must be used within AdminDataProvider");
  return context;
}
