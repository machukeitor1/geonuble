import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const CHILLAN = [-36.6066, -72.1034];

// Mapa OpenStreetMap. Con onPick, un clic en el mapa fija la ubicación.
function MapView({ lat, lng, onPick, height = 320, zoom = 15 }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const pickRef = useRef(onPick);
  const hasPoint = lat !== null && lat !== undefined && lng !== null && lng !== undefined;

  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    map.current = L.map(container.current, { scrollWheelZoom: false }).setView(CHILLAN, 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    map.current.on("click", (e) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
    return () => {
      map.current.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hasPoint) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const point = [lat, lng];
    if (marker.current) marker.current.setLatLng(point);
    else {
      marker.current = L.circleMarker(point, {
        radius: 10,
        color: "#1a3a5c",
        weight: 3,
        fillColor: "#f0c040",
        fillOpacity: 1,
      }).addTo(map.current);
    }
    map.current.setView(point, Math.max(map.current.getZoom(), zoom));
  }, [hasPoint, lat, lng, zoom]);

  return (
    <div
      ref={container}
      style={{ height, borderRadius: 12, overflow: "hidden", zIndex: 0 }}
      role="region"
      aria-label={onPick ? "Mapa: haz clic para marcar la ubicación" : "Mapa de ubicación"}
    />
  );
}

export default MapView;
