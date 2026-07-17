import { createContext, useContext, useMemo } from "react";
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
import { useAdminPlaces, useDeletePlace, useUpdatePlace } from "../../hooks/useAdminPlaces.js";
import { useAdminUsers, useUpdateAdminUser } from "../../hooks/useAdminUsers.js";
import { useAdminNews, useDeleteAdminNews, useUpdateAdminNews } from "../../hooks/useAdminNews.js";
import { useAdminSettings, useUpdateAdminSettings } from "../../hooks/useAdminSettings.js";

const AdminDataContext = createContext(null);

const LIVE_ENTITIES = new Set([
  "users",
  "surveys",
  "announcements",
  "news",
  "appeals",
  "contacts",
  "places",
  "settings",
]);

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
    user: appeal.user?.name || appeal.userId || "—",
  };
}

function mapUserFromApi(user) {
  return {
    ...user,
    status: user.isActive === false ? "blocked" : "active",
  };
}

function mapContactFromApi(contact) {
  return {
    ...contact,
    order: contact.order ?? 0,
    status: contact.isActive === false ? "inactive" : "active",
  };
}

function mapNewsFromApi(news) {
  return {
    ...news,
    importance: Number(news.importance ?? 3),
    importanceLabel: news.importanceLabel || "",
    tags: Array.isArray(news.tags) ? news.tags : [],
  };
}

function mapSettingsFromApi(settings) {
  if (!settings || typeof settings !== "object") return [];
  return [
    {
      id: "public-settings",
      title: "Публічні налаштування",
      cityHotline: settings?.cityHotline || "",
    },
  ];
}

function userToApi(form) {
  return {
    username: form.username,
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone || "",
    role: form.role,
    isActive: form.isActive ?? form.status !== "blocked",
  };
}

function contactToApi(form) {
  return {
    name: form.name,
    phone: form.phone,
    icon: form.icon || "call",
    group: form.group || "",
    kind: form.kind || "utility",
    order: Number(form.order || 0),
    isActive: form.isActive ?? form.status !== "inactive",
  };
}

function newsToApi(form, { isAnnouncement }) {
  const preserveDate = (value, original) => {
    if (!value) return null;
    return original && String(original).slice(0, 10) === String(value).slice(0, 10) ? original : value;
  };
  return {
    title: form.title,
    summary: form.summary || "",
    body: form.body || "",
    category: form.category || "",
    importance: Number(form.importance || 3),
    isAnnouncement,
    publishedAt: preserveDate(form.publishedAt, form._originalPublishedAt),
    expiresAt: preserveDate(form.expiresAt, form._originalExpiresAt),
    tags: Array.isArray(form.tags) ? form.tags : [],
  };
}

export function AdminDataProvider({ children }) {
  const usersQuery = useAdminUsers();
  const surveysQuery = useAdminSurveys();
  const announcementsQuery = useAdminNews({ isAnnouncement: true });
  const newsQuery = useAdminNews({ isAnnouncement: false });
  const appealsQuery = useAdminAppeals();
  const contactsQuery = useAdminContacts();
  const placesQuery = useAdminPlaces();
  const settingsQuery = useAdminSettings();

  const updateAdminUser = useUpdateAdminUser();
  const createSurvey = useCreateSurvey();
  const updateSurvey = useUpdateSurvey();
  const deleteSurvey = useDeleteSurvey();
  const updateAdminNews = useUpdateAdminNews();
  const deleteAdminNews = useDeleteAdminNews();
  const respondAppeal = useRespondAppeal();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const updatePlace = useUpdatePlace();
  const deletePlace = useDeletePlace();
  const updateAdminSettings = useUpdateAdminSettings();

  const data = useMemo(
    () => ({
      users: (Array.isArray(usersQuery.data) ? usersQuery.data : []).filter(Boolean).map(mapUserFromApi),
      surveys: (Array.isArray(surveysQuery.data) ? surveysQuery.data : []).filter(Boolean).map(mapSurveyFromApi),
      announcements: (Array.isArray(announcementsQuery.data) ? announcementsQuery.data : []).filter(Boolean).map(mapNewsFromApi),
      news: (Array.isArray(newsQuery.data) ? newsQuery.data : []).filter(Boolean).map(mapNewsFromApi),
      appeals: (Array.isArray(appealsQuery.data) ? appealsQuery.data : []).filter(Boolean).map(mapAppealFromApi),
      contacts: (Array.isArray(contactsQuery.data) ? contactsQuery.data : []).filter(Boolean).map(mapContactFromApi),
      places: Array.isArray(placesQuery.data) ? placesQuery.data : [],
      settings: mapSettingsFromApi(settingsQuery.data),
    }),
    [
      announcementsQuery.data,
      appealsQuery.data,
      contactsQuery.data,
      newsQuery.data,
      placesQuery.data,
      settingsQuery.data,
      surveysQuery.data,
      usersQuery.data,
    ],
  );

  const meta = useMemo(
    () => ({
      users: { isLoading: usersQuery.isLoading, error: usersQuery.error ?? null },
      surveys: { isLoading: surveysQuery.isLoading, error: surveysQuery.error ?? null },
      announcements: {
        isLoading: announcementsQuery.isLoading,
        error: announcementsQuery.error ?? null,
      },
      news: { isLoading: newsQuery.isLoading, error: newsQuery.error ?? null },
      appeals: { isLoading: appealsQuery.isLoading, error: appealsQuery.error ?? null },
      contacts: { isLoading: contactsQuery.isLoading, error: contactsQuery.error ?? null },
      places: { isLoading: placesQuery.isLoading, error: placesQuery.error ?? null },
      settings: { isLoading: settingsQuery.isLoading, error: settingsQuery.error ?? null },
    }),
    [
      announcementsQuery.error,
      announcementsQuery.isLoading,
      appealsQuery.error,
      appealsQuery.isLoading,
      contactsQuery.error,
      contactsQuery.isLoading,
      newsQuery.error,
      newsQuery.isLoading,
      placesQuery.error,
      placesQuery.isLoading,
      settingsQuery.error,
      settingsQuery.isLoading,
      surveysQuery.error,
      surveysQuery.isLoading,
      usersQuery.error,
      usersQuery.isLoading,
    ],
  );

  async function createItem(entity, item) {
    if (entity === "surveys") {
      return createSurvey.mutateAsync(surveyToApi(item, { allowOptions: true }));
    }
    if (entity === "contacts") {
      return createContact.mutateAsync(contactToApi(item));
    }
    throw new Error("Створення для цього розділу недоступне.");
  }

  async function updateItem(entity, id, updates) {
    if (entity === "users") {
      return updateAdminUser.mutateAsync({ id, updates: userToApi(updates) });
    }
    if (entity === "surveys") {
      const allowOptions = Number(updates.totalVotes || 0) === 0;
      return updateSurvey.mutateAsync({ id, updates: surveyToApi(updates, { allowOptions }) });
    }
    if (entity === "announcements") {
      return updateAdminNews.mutateAsync({
        id,
        updates: newsToApi(updates, { isAnnouncement: true }),
      });
    }
    if (entity === "news") {
      return updateAdminNews.mutateAsync({
        id,
        updates: newsToApi(updates, { isAnnouncement: false }),
      });
    }
    if (entity === "appeals") {
      return respondAppeal.mutateAsync({
        id,
        updates: { status: updates.status, response: updates.response ?? "" },
      });
    }
    if (entity === "contacts") {
      return updateContact.mutateAsync({ id, updates: contactToApi(updates) });
    }
    if (entity === "places") {
      return updatePlace.mutateAsync({
        id,
        updates: {
          name: updates.name,
          address: updates.address,
          phone: updates.phone,
          openingHours: updates.openingHours,
          category: updates.category,
        },
      });
    }
    if (entity === "settings") {
      return updateAdminSettings.mutateAsync({ cityHotline: updates.cityHotline || "" });
    }
    throw new Error("Редагування для цього розділу недоступне.");
  }

  async function removeItem(entity, id) {
    if (entity === "surveys") {
      return deleteSurvey.mutateAsync(id);
    }
    if (entity === "announcements" || entity === "news") {
      return deleteAdminNews.mutateAsync(id);
    }
    if (entity === "contacts") {
      return deleteContact.mutateAsync(id);
    }
    if (entity === "places") {
      return deletePlace.mutateAsync(id);
    }
    throw new Error("Видалення для цього розділу недоступне.");
  }

  const value = useMemo(
    () => ({ data, meta, createItem, updateItem, removeItem, liveEntities: LIVE_ENTITIES }),
    [data, meta],
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) throw new Error("useAdminData must be used within AdminDataProvider");
  return context;
}
