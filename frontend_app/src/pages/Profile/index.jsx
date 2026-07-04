import { useState } from "react";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import LanguageSwitch from "../../components/i18n/LanguageSwitch.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Modal from "../../components/overlay/Modal.jsx";
import Toast from "../../components/ui/Toast.jsx";
import Icon from "../../components/ui/Icon.jsx";

function Row({ icon, label, value, onClick }) {
  return (
    <button className="flex w-full items-center justify-between p-4 text-left transition hover:bg-surface-container/60 active:scale-[0.99]" type="button" onClick={onClick}>
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed/40 text-on-primary-fixed">
          <Icon name={icon} />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-on-surface-variant">{label}</span>
          <span className="block truncate font-medium text-on-surface">{value}</span>
        </span>
      </span>
      <Icon name="chevron_right" className="text-outline" />
    </button>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [editField, setEditField] = useState(null);
  const [toast, setToast] = useState("");
  const [profile, setProfile] = useState({
    name: "Alexander Shevchenko",
    shortName: "Alexander",
    phone: "+380 50 123 4567",
    email: "alex.shevchenko@email.com",
    street: "Teatralna St",
    building: "15, Apt 42",
    district: "Bohunskyi District",
    city: "Zhytomyr, 10014",
  });
  const [preferences, setPreferences] = useState({
    utilityAlerts: true,
    cityNews: false,
  });

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  };

  const profileRows = [
    { key: "name", icon: "person", label: t("profile.fullName"), value: profile.name },
    { key: "phone", icon: "call", label: t("profile.phone"), value: profile.phone },
    { key: "email", icon: "mail", label: t("profile.email"), value: profile.email },
  ];

  const preferenceRows = [
    { key: "utilityAlerts", icon: "notifications_active", label: t("profile.utilityAlerts"), hint: t("profile.utilityAlertsHint") },
    { key: "cityNews", icon: "campaign", label: t("profile.cityNews"), hint: t("profile.cityNewsHint") },
  ];

  const saveField = () => {
    if (editField?.key === "name") {
      setProfile((current) => ({ ...current, shortName: editField.value.split(" ")[0] || current.shortName, name: editField.value }));
    } else if (editField) {
      setProfile((current) => ({ ...current, [editField.key]: editField.value }));
    }
    setEditField(null);
    showToast(t("common.saved"));
  };

  const saveAddress = () => {
    setAddressOpen(false);
    showToast(t("common.saved"));
  };

  return (
    <Shell className="bg-background pb-28">
      <AppHeader
        eyebrow={t("app.name")}
        profile={{
          name: profile.shortName,
          location: `${profile.city.split(",")[0]}, ${profile.street} st.`,
          avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCUzqSCqzBRVzqmbpih8uYJWw3Thu0y9jSHVSOpJ1TwdY9cjQk3c__6eYFGlaQR38j2-vw2nn41nn75JeYGzLC3Sr7u3oN8fj0BgTmoUqp3kLAfX6SAHTmtci2Lk_f75QwcXvRjPxRPPYP0CUhmZwntjLQ6qFBC11KyEHm55G0PUAX0Lt-gvfZa1_Y0PZz0rY2R5nGiBuiV9ki5i9Wq0rQKGbuXLoQvppkV1JeGMDU48kTTfXU5S7YvKFEiy35swDj6Y4aq-UTnmdI",
          onEdit: () => setEditField({ key: "name", label: t("profile.fullName"), value: profile.name }),
        }}
      />
      <main className="relative z-20 mx-auto -mt-4 w-full max-w-5xl rounded-t-3xl bg-surface-container-low px-container-padding pb-36 pt-6 sm:px-6 md:px-8">
        <div className="grid gap-section-margin lg:grid-cols-2">
          <section>
            <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t("profile.personalInformation")}</h3>
            <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-soft">
              {profileRows.map((row) => (
                <Row key={row.key} icon={row.icon} label={row.label} value={row.value} onClick={() => setEditField({ key: row.key, label: row.label, value: row.value })} />
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t("profile.locationDetails")}</h3>
            <button className="flex w-full items-start justify-between rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-left shadow-soft active:scale-[0.99]" type="button" onClick={() => setAddressOpen(true)}>
              <span className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed/40 text-on-primary-fixed"><Icon name="home" /></span>
                <span>
                  <span className="block font-medium">{profile.street}, {profile.building}</span>
                  <span className="mt-1 block text-sm text-on-surface-variant">{profile.district}</span>
                  <span className="mt-1 block text-xs text-on-surface-variant">{profile.city}</span>
                </span>
              </span>
              <Icon name="edit_location_alt" className="text-on-tertiary-fixed-variant" />
            </button>
          </section>
          <section className="lg:col-span-2">
            <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t("profile.preferences")}</h3>
            <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-soft">
              <div className="border-b border-outline-variant/30 p-4">
                <LanguageSwitch />
              </div>
              {preferenceRows.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-fixed/60 text-on-secondary-container"><Icon name={item.icon} /></span>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-on-surface-variant">{item.hint}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input className="peer sr-only" checked={preferences[item.key]} type="checkbox" onChange={(event) => setPreferences((current) => ({ ...current, [item.key]: event.target.checked }))} />
                    <span className="h-6 w-11 rounded-full bg-surface-variant transition peer-checked:bg-on-tertiary-fixed-variant" />
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                  </label>
                </div>
              ))}
              <Row icon="lock" label={t("profile.security")} value={t("profile.changePassword")} onClick={() => setPasswordOpen(true)} />
            </div>
          </section>
        </div>
        <button className="mt-20 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-error-container bg-error-container/30 font-bold text-error" type="button" onClick={() => showToast(t("common.updated"))}>
          <Icon name="logout" /> {t("profile.logout")}
        </button>
      </main>
      <BottomNav active="profile" dark />
      <Modal
        open={passwordOpen}
        title={t("profile.changePassword")}
        onClose={() => setPasswordOpen(false)}
        footer={<div className="flex gap-3"><button className="h-12 flex-1 rounded-full border border-outline text-sm font-bold" type="button" onClick={() => setPasswordOpen(false)}>{t("common.cancel")}</button><button className="h-12 flex-1 rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container" type="button" onClick={() => { setPasswordOpen(false); showToast(t("common.saved")); }}>{t("common.save")}</button></div>}
      >
        <p className="mb-5 text-sm leading-6 text-on-surface-variant">{t("profile.changePassword")}</p>
        <div className="space-y-4">
          {["Current Password", "New Password", "Confirm New Password"].map((label) => (
            <label key={label} className="block">
              <span className="mb-1 ml-1 block text-xs text-on-surface-variant">{label}</span>
              <input className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 outline-none focus:border-on-tertiary-fixed-variant" placeholder="••••••••" type="password" />
            </label>
          ))}
        </div>
      </Modal>
      <Modal
        open={addressOpen}
        title={t("profile.editAddress")}
        onClose={() => setAddressOpen(false)}
        footer={<button className="h-12 w-full rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container" type="button" onClick={saveAddress}>{t("profile.saveAddress")}</button>}
      >
        <div className="space-y-4">
          {[
            ["street", t("profile.street")],
            ["building", t("profile.building")],
            ["district", t("profile.district")],
          ].map(([key, label]) => (
            <label key={label} className="block">
              <span className="mb-1 ml-1 block text-xs text-on-surface-variant">{label}</span>
              <input className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 outline-none focus:border-on-tertiary-fixed-variant" value={profile[key]} onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))} />
            </label>
          ))}
        </div>
      </Modal>
      <Modal
        open={Boolean(editField)}
        title={editField?.label || t("profile.editField")}
        onClose={() => setEditField(null)}
        footer={<button className="h-12 w-full rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container" type="button" onClick={saveField}>{t("common.save")}</button>}
      >
        <label className="block">
          <span className="mb-1 ml-1 block text-xs text-on-surface-variant">{editField?.label}</span>
          <input className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 outline-none focus:border-on-tertiary-fixed-variant" value={editField?.value || ""} onChange={(event) => setEditField((current) => ({ ...current, value: event.target.value }))} />
        </label>
      </Modal>
      <Toast message={toast} />
    </Shell>
  );
}
