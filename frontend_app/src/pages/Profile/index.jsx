import { useState } from "react";
import Shell from "../../components/layout/Shell.jsx";
import BottomNav from "../../components/navigation/BottomNav.jsx";
import Modal from "../../components/overlay/Modal.jsx";
import Icon from "../../components/ui/Icon.jsx";

function Row({ icon, label, value, onClick }) {
  return (
    <button className="flex w-full items-center justify-between p-4 text-left transition hover:bg-surface-container/60 active:scale-[0.99]" onClick={onClick}>
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
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);

  return (
    <Shell className="bg-background pb-28">
      <header className="relative z-10 flex h-[280px] flex-col bg-primary-container px-container-padding pb-8 pt-12 text-on-primary sm:px-6 md:px-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <h1 className="text-xl font-bold">Zhytomyr Assistant</h1>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Icon name="notifications" />
          </button>
        </div>
        <div className="mx-auto mt-auto flex w-full max-w-5xl items-center gap-4">
          <div className="relative">
            <img className="h-20 w-20 rounded-full border-2 border-white/20 object-cover" alt="" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUzqSCqzBRVzqmbpih8uYJWw3Thu0y9jSHVSOpJ1TwdY9cjQk3c__6eYFGlaQR38j2-vw2nn41nn75JeYGzLC3Sr7u3oN8fj0BgTmoUqp3kLAfX6SAHTmtci2Lk_f75QwcXvRjPxRPPYP0CUhmZwntjLQ6qFBC11KyEHm55G0PUAX0Lt-gvfZa1_Y0PZz0rY2R5nGiBuiV9ki5i9Wq0rQKGbuXLoQvppkV1JeGMDU48kTTfXU5S7YvKFEiy35swDj6Y4aq-UTnmdI" />
            <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-container bg-secondary-container text-on-secondary-container">
              <Icon name="edit" className="text-base" />
            </button>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Alexander</h2>
            <p className="mt-1 flex w-fit items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs text-primary-fixed-dim"><Icon name="location_on" className="text-sm" /> Zhytomyr, Teatralna st.</p>
          </div>
        </div>
      </header>
      <main className="relative z-20 mx-auto -mt-4 w-full max-w-5xl rounded-t-3xl bg-surface-container-low px-container-padding pb-36 pt-6 sm:px-6 md:px-8">
        <div className="grid gap-section-margin lg:grid-cols-2">
          <section>
            <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Personal Information</h3>
            <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-soft">
              <Row icon="person" label="Full Name" value="Alexander Shevchenko" />
              <Row icon="call" label="Phone Number" value="+380 50 123 4567" />
              <Row icon="mail" label="Email" value="alex.shevchenko@email.com" />
            </div>
          </section>
          <section>
            <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Location Details</h3>
            <button className="flex w-full items-start justify-between rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-left shadow-soft" onClick={() => setAddressOpen(true)}>
              <span className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed/40 text-on-primary-fixed"><Icon name="home" /></span>
                <span>
                  <span className="block font-medium">Teatralna St, 15, Apt 42</span>
                  <span className="mt-1 block text-sm text-on-surface-variant">Bohunskyi District</span>
                  <span className="mt-1 block text-xs text-on-surface-variant">Zhytomyr, 10014</span>
                </span>
              </span>
              <Icon name="edit_location_alt" className="text-on-tertiary-fixed-variant" />
            </button>
          </section>
          <section className="lg:col-span-2">
            <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Preferences</h3>
            <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-soft">
              {["Utility Outage Alerts", "City News"].map((label, index) => (
                <div key={label} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-fixed/60 text-on-secondary-container"><Icon name={index ? "campaign" : "notifications_active"} /></span>
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-on-surface-variant">{index ? "Weekly digest of major events" : "Push notifications for water/power"}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input className="peer sr-only" defaultChecked={!index} type="checkbox" />
                    <span className="h-6 w-11 rounded-full bg-surface-variant transition peer-checked:bg-on-tertiary-fixed-variant" />
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                  </label>
                </div>
              ))}
              <Row icon="lock" label="Security" value="Change Password" onClick={() => setPasswordOpen(true)} />
            </div>
          </section>
        </div>
        <button className="mt-20 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-error-container bg-error-container/30 font-bold text-error">
          <Icon name="logout" /> Log Out
        </button>
      </main>
      <BottomNav active="profile" dark />
      <Modal
        open={passwordOpen}
        title="Change Password"
        onClose={() => setPasswordOpen(false)}
        footer={<div className="flex gap-3"><button className="h-12 flex-1 rounded-full border border-outline text-sm font-bold" onClick={() => setPasswordOpen(false)}>Cancel</button><button className="h-12 flex-1 rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container">Update</button></div>}
      >
        <p className="mb-5 text-sm leading-6 text-on-surface-variant">Enter your current password and choose a new one to secure your account.</p>
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
        title="Edit Address"
        onClose={() => setAddressOpen(false)}
        footer={<button className="h-12 w-full rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container">Save Address</button>}
      >
        <div className="space-y-4">
          {["Street", "Building / Apt", "District"].map((label, index) => (
            <label key={label} className="block">
              <span className="mb-1 ml-1 block text-xs text-on-surface-variant">{label}</span>
              <input className="h-12 w-full rounded-xl border border-outline-variant bg-surface px-4 outline-none focus:border-on-tertiary-fixed-variant" defaultValue={["Teatralna St", "15, Apt 42", "Bohunskyi District"][index]} />
            </label>
          ))}
        </div>
      </Modal>
    </Shell>
  );
}
