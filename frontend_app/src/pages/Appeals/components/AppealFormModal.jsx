import { useRef, useState } from "react";
import Modal from "../../../components/overlay/Modal.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { appealCategories } from "../../../consts/appealCategories.js";
import { useCreateAppeal, useUploadAppealPhoto } from "../../../hooks/useAppeals.js";

export default function AppealFormModal({ open, onClose }) {
  const fileInputRef = useRef(null);
  const uploadPhoto = useUploadAppealPhoto();
  const createAppeal = useCreateAppeal();

  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [triage, setTriage] = useState(null);
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const resetForm = () => {
    setPhotoPreviewUrl(null);
    setUploadedImageUrl(null);
    setTriage(null);
    setCategory("");
    setAddress("");
    setDescription("");
    uploadPhoto.reset();
    createAppeal.reset();
  };

  const canSubmit =
    Boolean(category) &&
    address.trim().length > 3 &&
    description.trim().length > 8 &&
    !uploadPhoto.isPending &&
    !createAppeal.isPending;

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPhotoPreviewUrl(URL.createObjectURL(file));
    setUploadedImageUrl(null);
    setTriage(null);
    setSubmitted(false);

    try {
      const result = await uploadPhoto.mutateAsync(file);
      setUploadedImageUrl(result.imageUrl);
      setTriage(result.triage);
      if (result.triage) {
        setCategory((current) => current || result.triage.category);
        setDescription((current) => current || result.triage.description);
      }
    } catch {
      // Error is rendered below.
    }
  };

  const removePhoto = () => {
    setPhotoPreviewUrl(null);
    setUploadedImageUrl(null);
    setTriage(null);
    uploadPhoto.reset();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await createAppeal.mutateAsync({
        imageUrl: uploadedImageUrl,
        category,
        description: description.trim(),
        address: address.trim(),
      });
      setSubmitted(true);
      resetForm();
    } catch {
      // Error is rendered below.
    }
  };

  return (
    <Modal
      open={open}
      title="Нове звернення"
      sheet
      onClose={onClose}
      footer={
        <button
          className="h-14 w-full rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container transition disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant active:scale-95"
          disabled={!canSubmit}
          type="button"
          onClick={handleSubmit}
        >
          {createAppeal.isPending ? "Надсилання..." : "Надіслати звернення"}
        </button>
      }
    >
      <div className="space-y-6">
        {submitted ? (
          <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm font-bold text-green-700">
            Збережено
          </div>
        ) : null}
        {createAppeal.isError ? (
          <div className="rounded-xl border border-error-container bg-error-container/30 p-3 text-sm text-error">
            {createAppeal.error.message}
          </div>
        ) : null}

        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Фото (необов'язково)</label>
          <input ref={fileInputRef} className="sr-only" accept="image/jpeg,image/png,image/webp" type="file" onChange={handleFileSelect} />
          {photoPreviewUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-low">
              <img className="aspect-video w-full object-cover" alt="" src={photoPreviewUrl} />
              <button className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white" type="button" onClick={removePhoto}>
                <Icon name="close" className="text-base" />
              </button>
              {uploadPhoto.isPending ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 text-sm font-bold text-white">
                  <Icon name="smart_toy" filled /> AI аналізує фото...
                </div>
              ) : null}
            </div>
          ) : (
            <button
              className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant transition hover:border-primary-container active:scale-[0.99]"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="add_a_photo" className="text-4xl" />
              <span>Додати фото</span>
            </button>
          )}
          {uploadPhoto.isError ? (
            <p className="mt-1.5 ml-1 text-xs font-bold text-error">{uploadPhoto.error.message}</p>
          ) : null}
          {triage && !triage.isValid ? (
            <p className="mt-1.5 ml-1 text-xs text-on-surface-variant">Це може не бути міською проблемою — перевірте перед надсиланням.</p>
          ) : null}
          {uploadedImageUrl && !triage && !uploadPhoto.isPending ? (
            <p className="mt-1.5 ml-1 text-xs text-on-surface-variant">Фото збережено. AI недоступний — оберіть категорію та опишіть проблему вручну.</p>
          ) : null}
        </div>

        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Категорія</label>
          <div className="flex flex-wrap gap-2">
            {appealCategories.map((item) => {
              const active = category === item.slug;
              return (
                <button
                  key={item.slug}
                  className={`rounded-full border px-4 py-2 text-sm transition active:scale-95 ${active ? "border-primary-container bg-primary-container text-on-primary" : "border-outline-variant text-on-surface-variant"}`}
                  type="button"
                  onClick={() => setCategory(item.slug)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="appeal-address">Адреса проблеми</label>
          <div className="flex h-12 items-center gap-2 rounded-xl bg-surface-container-lowest px-3">
            <Icon name="location_on" className="shrink-0 text-lg text-outline" />
            <input
              id="appeal-address"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
              placeholder="напр. просп. Перемоги, 55"
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <p className="mt-1.5 ml-1 text-xs text-on-surface-variant">Вкажіть, де саме виникла проблема</p>
        </div>

        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Опис проблеми</label>
          <textarea
            className="min-h-32 w-full rounded-xl border-0 bg-surface-container-lowest p-3 text-sm outline-none focus:ring-0"
            placeholder="Опишіть проблему..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
