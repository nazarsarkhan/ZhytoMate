import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Shell from "../../components/layout/Shell.jsx";
import AppHeader from "../../components/layout/AppHeader.jsx";
import LanguageSwitch from "../../components/i18n/LanguageSwitch.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Modal from "../../components/overlay/Modal.jsx";
import Toast from "../../components/ui/Toast.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { useAuth } from "../../hooks/useAuth.jsx";
import { useCurrentUser } from "../../hooks/useCurrentUser.js";
import {
  useChangePassword,
  useUpdateProfileAddress,
  useUpdateProfileName,
  useUploadAvatar,
} from "../../hooks/useProfile.js";

function Row({ icon, label, value, onClick }) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed/40 text-on-primary-fixed">
          <Icon name={icon} />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-on-surface-variant">{label}</span>
          <span className="block truncate font-medium text-on-surface">{value}</span>
        </span>
      </span>
      {onClick ? <Icon name="chevron_right" className="text-outline" /> : null}
    </>
  );

  if (!onClick) {
    return <div className="flex w-full items-center justify-between p-4 text-left">{content}</div>;
  }

  return (
    <button className="flex w-full items-center justify-between p-4 text-left transition hover:bg-surface-container/60 active:scale-[0.99]" type="button" onClick={onClick}>
      {content}
    </button>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const currentUser = useCurrentUser();
  const updateName = useUpdateProfileName();
  const updateAddress = useUpdateProfileAddress();
  const uploadAvatar = useUploadAvatar();
  const changePassword = useChangePassword();
  const avatarInputRef = useRef(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [editField, setEditField] = useState(null);
  const [toast, setToast] = useState("");

  const [nameForm, setNameForm] = useState({ firstName: "", lastName: "" });
  const [addressForm, setAddressForm] = useState({ street: "", building: "", district: "", city: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [passwordError, setPasswordError] = useState("");

  const user = currentUser.data;

  useEffect(() => {
    if (user) setAddressForm(user.address);
  }, [user]);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1600);
  };

  if (!user) return null;

  const profileRows = [
    { key: "name", icon: "person", label: t("profile.fullName"), value: `${user.firstName} ${user.lastName}` },
    { key: "phone", icon: "call", label: t("profile.phone"), value: user.phone || "—" },
    { key: "email", icon: "mail", label: t("profile.email"), value: user.email },
  ];

  const openNameModal = () => {
    setNameForm({ firstName: user.firstName, lastName: user.lastName });
    setNameOpen(true);
  };

  const openPhoneModal = () => setEditField({ key: "phone", label: t("profile.phone"), value: user.phone || "" });

  const openAvatarPicker = () => avatarInputRef.current?.click();

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await uploadAvatar.mutateAsync(file);
      showToast(t("common.saved"));
    } catch (err) {
      showToast(err.message);
    }
  };

  const saveName = async () => {
    try {
      await updateName.mutateAsync({ firstName: nameForm.firstName.trim(), lastName: nameForm.lastName.trim(), phone: user.phone });
      setNameOpen(false);
      showToast(t("common.saved"));
    } catch (err) {
      showToast(err.message);
    }
  };

  const savePhone = async () => {
    try {
      await updateName.mutateAsync({ firstName: user.firstName, lastName: user.lastName, phone: editField.value.trim() });
      setEditField(null);
      showToast(t("common.saved"));
    } catch (err) {
      showToast(err.message);
    }
  };

  const saveAddress = async () => {
    try {
      // The backend verifies/normalizes the address via Nominatim and returns the updated user;
      // reflect whether it resolved to a real place in the toast.
      const result = await updateAddress.mutateAsync(addressForm);
      setAddressOpen(false);
      showToast(
        result?.user?.address?.verified
          ? "Адресу підтверджено ✓"
          : "Збережено. Не вдалося підтвердити адресу",
      );
    } catch (err) {
      showToast(err.message);
    }
  };

  const savePassword = async () => {
    setPasswordError("");
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError(t("profile.passwordMismatch"));
      return;
    }
    try {
      await changePassword.mutateAsync({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setPasswordOpen(false);
      showToast(t("common.saved"));
    } catch (err) {
      setPasswordError(err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const preferenceRows = [
    { key: "utilityAlerts", icon: "notifications_active", label: t("profile.utilityAlerts"), hint: t("profile.utilityAlertsHint") },
    { key: "cityNews", icon: "campaign", label: t("profile.cityNews"), hint: t("profile.cityNewsHint") },
  ];

  return (
    <Shell className="bg-background pb-28">
      <AppHeader
        eyebrow={t("app.name")}
        profile={{
          name: user.firstName,
          location: [user.address.city, user.address.street].filter(Boolean).join(", ") || t("app.city"),
          avatarUrl: user.avatarUrl,
          onEdit: openNameModal,
          onEditAvatar: openAvatarPicker,
        }}
      />
      <input
        ref={avatarInputRef}
        className="hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleAvatarChange}
      />
      <main className="relative z-20 mx-auto -mt-4 w-full max-w-5xl rounded-t-3xl bg-surface-container-low px-container-padding pb-36 pt-6 sm:px-6 md:px-8">
        <div className="grid gap-section-margin lg:grid-cols-2">
          <section>
            <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t("profile.personalInformation")}</h3>
            <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-soft">
              <Row icon="person" label={t("profile.fullName")} value={profileRows[0].value} onClick={openNameModal} />
              <Row icon="call" label={t("profile.phone")} value={profileRows[1].value} onClick={openPhoneModal} />
              <Row icon="mail" label={t("profile.email")} value={profileRows[2].value} />
            </div>
          </section>
          <section>
            <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t("profile.locationDetails")}</h3>
            <button className="flex w-full items-start justify-between rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-left shadow-soft active:scale-[0.99]" type="button" onClick={() => setAddressOpen(true)}>
              <span className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed/40 text-on-primary-fixed"><Icon name="home" /></span>
                <span>
                  <span className="block font-medium">{[user.address.street, user.address.building].filter(Boolean).join(", ") || t("profile.addAddress")}</span>
                  <span className="mt-1 block text-sm text-on-surface-variant">{user.address.district}</span>
                  <span className="mt-1 block text-xs text-on-surface-variant">{user.address.city}</span>
                  {user.address.street || user.address.city ? (
                    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${user.address.verified ? "bg-green-100 text-green-700" : "bg-surface-container-high text-on-surface-variant"}`}>
                      <Icon name={user.address.verified ? "verified" : "help"} className="text-sm" />
                      {user.address.verified ? "Адресу підтверджено" : "Не підтверджено"}
                    </span>
                  ) : null}
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
                <PreferenceToggle key={item.key} item={item} />
              ))}
              <Row icon="lock" label={t("profile.security")} value={t("profile.changePassword")} onClick={() => setPasswordOpen(true)} />
            </div>
          </section>
        </div>
        <button className="mt-20 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-error-container bg-error-container/30 font-bold text-error" type="button" onClick={handleLogout}>
          <Icon name="logout" /> {t("profile.logout")}
        </button>
      </main>
      <BottomNav active="profile" dark />

      <Modal
        open={passwordOpen}
        title={t("profile.changePassword")}
        onClose={() => setPasswordOpen(false)}
        footer={
          <div className="flex gap-3">
            <button className="h-12 flex-1 rounded-full border border-outline text-sm font-bold" type="button" onClick={() => setPasswordOpen(false)}>{t("common.cancel")}</button>
            <button className="h-12 flex-1 rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container disabled:opacity-50" disabled={changePassword.isPending} type="button" onClick={savePassword}>{t("common.save")}</button>
          </div>
        }
      >
        <div className="space-y-4">
          {passwordError ? <p className="rounded-xl border border-error-container bg-error-container/30 p-3 text-sm text-error">{passwordError}</p> : null}
          <label className="block">
            <span className="mb-1 ml-1 block text-xs text-on-surface-variant">{t("profile.currentPassword")}</span>
            <input className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 outline-none focus:border-on-tertiary-fixed-variant" placeholder="••••••••" type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 ml-1 block text-xs text-on-surface-variant">{t("profile.newPassword")}</span>
            <input className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 outline-none focus:border-on-tertiary-fixed-variant" placeholder="••••••••" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 ml-1 block text-xs text-on-surface-variant">{t("profile.confirmNewPassword")}</span>
            <input className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 outline-none focus:border-on-tertiary-fixed-variant" placeholder="••••••••" type="password" value={passwordForm.confirmNewPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmNewPassword: event.target.value }))} />
          </label>
        </div>
      </Modal>

      <Modal
        open={addressOpen}
        title={t("profile.editAddress")}
        onClose={() => setAddressOpen(false)}
        footer={<button className="h-12 w-full rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container disabled:opacity-50" disabled={updateAddress.isPending} type="button" onClick={saveAddress}>{t("profile.saveAddress")}</button>}
      >
        <div className="space-y-4">
          {[
            ["street", t("profile.street")],
            ["building", t("profile.building")],
            ["district", t("profile.district")],
            ["city", t("profile.city")],
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1 ml-1 block text-xs text-on-surface-variant">{label}</span>
              <input className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 outline-none focus:border-on-tertiary-fixed-variant" value={addressForm[key]} onChange={(event) => setAddressForm((current) => ({ ...current, [key]: event.target.value }))} />
            </label>
          ))}
        </div>
      </Modal>

      <Modal
        open={nameOpen}
        title={t("profile.fullName")}
        onClose={() => setNameOpen(false)}
        footer={<button className="h-12 w-full rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container disabled:opacity-50" disabled={updateName.isPending} type="button" onClick={saveName}>{t("common.save")}</button>}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 ml-1 block text-xs text-on-surface-variant">{t("auth.firstName")}</span>
            <input className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 outline-none focus:border-on-tertiary-fixed-variant" value={nameForm.firstName} onChange={(event) => setNameForm((current) => ({ ...current, firstName: event.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 ml-1 block text-xs text-on-surface-variant">{t("auth.lastName")}</span>
            <input className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 outline-none focus:border-on-tertiary-fixed-variant" value={nameForm.lastName} onChange={(event) => setNameForm((current) => ({ ...current, lastName: event.target.value }))} />
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(editField)}
        title={editField?.label || t("profile.editField")}
        onClose={() => setEditField(null)}
        footer={<button className="h-12 w-full rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container disabled:opacity-50" disabled={updateName.isPending} type="button" onClick={savePhone}>{t("common.save")}</button>}
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

function PreferenceToggle({ item }) {
  const [checked, setChecked] = useState(item.key === "utilityAlerts");
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-fixed/60 text-on-secondary-container"><Icon name={item.icon} /></span>
        <div>
          <p className="font-medium">{item.label}</p>
          <p className="text-xs text-on-surface-variant">{item.hint}</p>
        </div>
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input className="peer sr-only" checked={checked} type="checkbox" onChange={(event) => setChecked(event.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-surface-variant transition peer-checked:bg-on-tertiary-fixed-variant" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </label>
    </div>
  );
}
