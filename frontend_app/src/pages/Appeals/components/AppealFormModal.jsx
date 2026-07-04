import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../../components/overlay/Modal.jsx";
import Icon from "../../../components/ui/Icon.jsx";

const appealCategories = ["infrastructure", "utilities", "ecology", "transport"];

export default function AppealFormModal({ open, onClose }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [category, setCategory] = useState("infrastructure");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const photoPreviews = useMemo(
    () =>
      photos.map((file) => ({
        id: `${file.name}-${file.lastModified}`,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [photos],
  );

  const canSubmit = category && description.trim().length > 8;

  const handleFiles = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    setPhotos((current) => [...current, ...selectedFiles]);
    event.target.value = "";
  };

  const removePhoto = (id) => {
    setPhotos((current) => current.filter((file) => `${file.name}-${file.lastModified}` !== id));
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setDescription("");
    setPhotos([]);
  };

  return (
    <Modal
      open={open}
      title={t("appeals.title")}
      sheet
      onClose={onClose}
      footer={
        <button
          className="h-14 w-full rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container transition disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant active:scale-95"
          disabled={!canSubmit}
          type="button"
          onClick={handleSubmit}
        >
          {t("appeals.send")}
        </button>
      }
    >
      <div className="space-y-6">
        {submitted ? (
          <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm font-bold text-green-700">
            {t("common.saved")}
          </div>
        ) : null}
        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t("appeals.category")}</label>
          <div className="flex flex-wrap gap-2">
            {appealCategories.map((item) => {
              const active = category === item;
              return (
                <button
                  key={item}
                  className={`rounded-full border px-4 py-2 text-sm transition active:scale-95 ${active ? "border-primary-container bg-primary-container text-on-primary" : "border-outline-variant text-on-surface-variant"}`}
                  type="button"
                  onClick={() => setCategory(item)}
                >
                  {t(`categories.${item}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t("appeals.photos")}</label>
          <input ref={fileInputRef} className="sr-only" accept="image/*" multiple type="file" onChange={handleFiles} />
          <button
            className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant transition hover:border-primary-container active:scale-[0.99]"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="add_a_photo" className="text-4xl" />
            <span>{photos.length ? t("appeals.photoCount", { count: photos.length }) : t("appeals.addPhoto")}</span>
          </button>
          {photoPreviews.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {photoPreviews.map((photo) => (
                <div key={photo.id} className="relative overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-low">
                  <img className="aspect-square w-full object-cover" alt={photo.name} src={photo.url} />
                  <button className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white" type="button" onClick={() => removePhoto(photo.id)}>
                    <Icon name="close" className="text-base" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t("appeals.description")}</label>
          <textarea
            className="min-h-32 w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm outline-none focus:border-secondary-container focus:ring-2 focus:ring-secondary-container/30"
            placeholder={t("appeals.descriptionPlaceholder")}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
