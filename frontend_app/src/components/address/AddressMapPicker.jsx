import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiFetch } from "../../lib/apiClient.js";
import Icon from "../ui/Icon.jsx";

const ZHYTOMYR_CENTER = [50.2547, 28.6587];
const ZHYTOMYR_BOUNDS = L.latLngBounds([50.18, 28.52], [50.33, 28.82]);

export default function AddressMapPicker({ address, onSelect }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mapElementRef.current) return undefined;

    const map = L.map(mapElementRef.current, {
      center: ZHYTOMYR_CENTER,
      zoom: 13,
      minZoom: 11,
      maxZoom: 19,
      maxBounds: ZHYTOMYR_BOUNDS,
      maxBoundsViscosity: 0.85,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const handleMapClick = async ({ latlng }) => {
      setError("");
      setIsResolving(true);
      try {
        const result = await apiFetch(
          `/users/me/address/reverse?lat=${latlng.lat}&lon=${latlng.lng}`,
        );
        if (!result.address) {
          setError("Не вдалося визначити адресу в цій точці");
          return;
        }
        onSelectRef.current(result.address);
      } catch (lookupError) {
        setError(lookupError.message || "Не вдалося визначити адресу");
      } finally {
        setIsResolving(false);
      }
    };

    map.on("click", handleMapClick);
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.off("click", handleMapClick);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !Number.isFinite(address?.lat) || !Number.isFinite(address?.lon)) return;

    const coordinates = [address.lat, address.lon];
    if (!markerRef.current) {
      markerRef.current = L.circleMarker(coordinates, {
        radius: 9,
        color: "#006c4c",
        weight: 3,
        fillColor: "#b7f1d8",
        fillOpacity: 1,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(coordinates);
    }
    map.setView(coordinates, Math.max(map.getZoom(), 16));
  }, [address]);

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant/40">
      <div ref={mapElementRef} className="h-64 w-full" data-testid="address-map" />
      <div className="flex items-center gap-2 border-t border-outline-variant/30 bg-surface-container-low p-2 text-xs text-on-surface-variant">
        <Icon name={isResolving ? "progress_activity" : "touch_app"} className={isResolving ? "animate-spin" : ""} />
        <span>{isResolving ? "Визначаємо адресу..." : "Натисніть на карту, щоб вибрати адресу в Житомирі"}</span>
      </div>
      {error ? <p className="border-t border-error-container bg-error-container/20 p-2 text-xs text-error">{error}</p> : null}
    </div>
  );
}
