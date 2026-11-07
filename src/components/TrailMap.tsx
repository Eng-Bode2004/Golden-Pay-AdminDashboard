import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface TrailPoint {
  kind: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  created_at: string;
}

export const TRAIL_LABEL: Record<string, string> = {
  accepted: "عند القبول",
  started: "عند بدء الاستعلام",
  draft: "أثناء الاستعلام",
  photo: "عند التقاط صورة",
  submitted: "عند إرسال التقرير",
};

/** The investigator's positions while working, joined in time order. */
export default function TrailMap({ points, target }: { points: TrailPoint[]; target?: [number, number] | null }) {
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!holder.current || !points.length) return;
    const map = L.map(holder.current, { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
    const line = points.map((point) => [point.lat, point.lng] as [number, number]);
    L.polyline(line, { color: "#e8c987", weight: 3, dashArray: "6 6" }).addTo(map);
    points.forEach((point, index) => {
      const last = index === points.length - 1;
      if (point.accuracy) {
        L.circle([point.lat, point.lng], { radius: point.accuracy, color: "#e8c987", weight: 1, fillOpacity: 0.08 }).addTo(map);
      }
      L.circleMarker([point.lat, point.lng], {
        radius: last ? 9 : 6,
        color: "#fff",
        weight: 2,
        fillColor: last ? "#22c07a" : "#e8c987",
        fillOpacity: 1,
      })
        .bindTooltip(`${index + 1}. ${TRAIL_LABEL[point.kind] ?? point.kind}`)
        .addTo(map);
    });
    if (target) {
      L.circleMarker(target, { radius: 8, color: "#fff", weight: 2, fillColor: "#ef7477", fillOpacity: 1 })
        .bindTooltip("عنوان الاستعلام")
        .addTo(map);
      line.push(target);
    }
    map.fitBounds(L.latLngBounds(line).pad(0.4), { maxZoom: 16 });
    return () => {
      map.remove();
    };
  }, [points, target]);
  return <div className="area-map trail-map" dir="ltr" ref={holder} />;
}
