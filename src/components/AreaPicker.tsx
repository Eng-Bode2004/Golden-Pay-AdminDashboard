import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api";
import { Icon } from "./ui";

export const AREA_LEVELS = [
  { key: "governorate", label: "المحافظة" },
  { key: "district", label: "المركز / القسم / المدينة" },
  { key: "local_unit", label: "الوحدة المحلية القروية" },
  { key: "main_village", label: "القرية الأم / الرئيسية" },
  { key: "sub_village", label: "القرية التابعة / الكفر / العزبة / النجع" },
] as const;

export type AreaNames = Partial<Record<(typeof AREA_LEVELS)[number]["key"], string>>;
export type AreaFilter =
  | ({ mode: "hierarchy" } & AreaNames)
  | { mode: "circle"; lat: number; lng: number; radius_km: number }
  | { mode: "polygon"; points: [number, number][] };

export interface Candidate {
  user_id: string;
  full_name: string;
  employee_number: string | null;
  governorate: string | null;
  district: string | null;
  main_village: string | null;
  lat: number | null;
  lng: number | null;
}

interface Place {
  location_id: string;
  name: string;
}

/** Five linked place fields: pick from the list or type a new name. */
export function LocationFields({
  value,
  onChange,
}: {
  value: AreaNames;
  onChange: (next: AreaNames) => void;
}) {
  const [lists, setLists] = useState<Place[][]>([[], [], [], [], []]);

  useEffect(() => {
    let active = true;
    async function load() {
      const next: Place[][] = [[], [], [], [], []];
      let parent: string | undefined;
      for (const [index, level] of AREA_LEVELS.entries()) {
        const query = parent ? `?parent=${parent}` : "";
        if (index > 0 && !parent) break;
        const { locations } = await api<{ locations: Place[] }>(`/locations${query}`);
        next[index] = locations;
        parent = locations.find((place) => place.name === value[level.key])?.location_id;
      }
      if (active) setLists(next);
    }
    void load().catch(() => {});
    return () => {
      active = false;
    };
  }, [value.governorate, value.district, value.local_unit, value.main_village]);

  return (
    <div className="location-fields">
      {AREA_LEVELS.map((level, index) => (
        <label className="field" key={level.key}>
          <span>{level.label}</span>
          <input
            list={`places-${level.key}`}
            value={value[level.key] ?? ""}
            placeholder={lists[index].length ? "اختر أو اكتب" : "اكتب الاسم"}
            onChange={(event) => {
              const next = { ...value, [level.key]: event.target.value };
              // A changed parent makes the deeper levels meaningless.
              for (const deeper of AREA_LEVELS.slice(index + 1)) delete next[deeper.key];
              onChange(next);
            }}
          />
          <datalist id={`places-${level.key}`}>
            {lists[index].map((place) => (
              <option key={place.location_id} value={place.name} />
            ))}
          </datalist>
        </label>
      ))}
    </div>
  );
}

function MapArea({
  shape,
  filter,
  candidates,
  onChange,
}: {
  shape: "circle" | "polygon";
  filter: AreaFilter | null;
  candidates: Candidate[];
  onChange: (next: AreaFilter | null) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const drawn = useRef<L.LayerGroup | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  const latest = useRef({ shape, filter, onChange });
  latest.current = { shape, filter, onChange };

  useEffect(() => {
    if (!holder.current || map.current) return;
    // The wheel keeps scrolling the page; the +/- buttons zoom the map.
    const instance = L.map(holder.current, {
      scrollWheelZoom: false,
      minZoom: 5,
      maxBounds: [
        [20, 22],
        [33, 38],
      ],
      maxBoundsViscosity: 0.8,
    }).setView([30.05, 31.24], 7);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(instance);
    drawn.current = L.layerGroup().addTo(instance);
    pins.current = L.layerGroup().addTo(instance);
    instance.on("click", (event: L.LeafletMouseEvent) => {
      const { shape: mode, filter: current, onChange: emit } = latest.current;
      if (mode === "circle") {
        emit({
          mode: "circle",
          lat: event.latlng.lat,
          lng: event.latlng.lng,
          radius_km: current?.mode === "circle" ? current.radius_km : 5,
        });
      } else {
        const points = current?.mode === "polygon" ? current.points : [];
        emit({ mode: "polygon", points: [...points, [event.latlng.lat, event.latlng.lng]] });
      }
    });
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = drawn.current;
    if (!layer) return;
    layer.clearLayers();
    const style = { color: "#e8c987", fillColor: "#e8c987", fillOpacity: 0.16, weight: 2 };
    if (filter?.mode === "circle") {
      L.circle([filter.lat, filter.lng], { ...style, radius: filter.radius_km * 1000 }).addTo(layer);
    } else if (filter?.mode === "polygon") {
      for (const point of filter.points) {
        L.circleMarker(point, { ...style, radius: 4, fillOpacity: 1 }).addTo(layer);
      }
      if (filter.points.length >= 3) L.polygon(filter.points, style).addTo(layer);
      else if (filter.points.length === 2) L.polyline(filter.points, style).addTo(layer);
    }
  }, [filter]);

  useEffect(() => {
    const layer = pins.current;
    if (!layer) return;
    layer.clearLayers();
    for (const person of candidates) {
      if (person.lat === null || person.lng === null) continue;
      L.circleMarker([person.lat, person.lng], {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: "#22c07a",
        fillOpacity: 1,
      })
        .bindTooltip(person.full_name)
        .addTo(layer);
    }
  }, [candidates]);

  return <div className="area-map" dir="ltr" ref={holder} />;
}

/** Chooses who receives a case: by named area, or a circle or shape on the map. */
export function AreaPicker({
  filter,
  onChange,
  onMatched,
}: {
  filter: AreaFilter | null;
  onChange: (next: AreaFilter | null) => void;
  onMatched: (people: Candidate[]) => void;
}) {
  const [tab, setTab] = useState<"names" | "circle" | "polygon">("names");
  const [names, setNames] = useState<AreaNames>({});
  const [everyone, setEveryone] = useState<Candidate[]>([]);
  const [matched, setMatched] = useState<Candidate[] | null>(null);

  useEffect(() => {
    api<{ investigators: Candidate[] }>("/investigators")
      .then((data) => setEveryone(data.investigators))
      .catch(() => setEveryone([]));
  }, []);

  useEffect(() => {
    if (tab === "names") onChange(names.governorate ? { mode: "hierarchy", ...names } : null);
  }, [tab, names]);

  useEffect(() => {
    const ready =
      filter &&
      (filter.mode === "hierarchy" ||
        filter.mode === "circle" ||
        (filter.mode === "polygon" && filter.points.length >= 3));
    if (!ready) {
      setMatched(null);
      onMatched([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      api<{ investigators: Candidate[] }>("/investigators/match", {
        method: "POST",
        body: JSON.stringify(filter),
      })
        .then((data) => {
          if (!active) return;
          setMatched(data.investigators);
          onMatched(data.investigators);
        })
        .catch(() => {
          if (active) setMatched(null);
        });
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filter]);

  return (
    <div className="area-picker">
      <div className="segmented">
        {(
          [
            ["names", "بأسماء المناطق"],
            ["circle", "دائرة على الخريطة"],
            ["polygon", "رسم منطقة"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => {
              setTab(value);
              if (value !== "names") onChange(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "names" ? (
        <LocationFields value={names} onChange={setNames} />
      ) : (
        <>
          <p className="hint">
            {tab === "circle"
              ? "اضغط على الخريطة لتحديد المركز، ثم اضبط نصف القطر."
              : "اضغط على الخريطة لرسم حدود المنطقة بثلاث نقاط أو أكثر."}
          </p>
          <MapArea
            shape={tab}
            filter={filter}
            candidates={matched?.length ? matched : everyone}
            onChange={onChange}
          />
          {filter?.mode === "circle" && (
            <label className="field radius-field">
              <span>نصف القطر: {filter.radius_km} كم</span>
              <input
                type="range"
                min={1}
                max={100}
                value={filter.radius_km}
                onChange={(event) =>
                  onChange({ ...filter, radius_km: Number(event.target.value) })
                }
              />
            </label>
          )}
          {filter?.mode === "polygon" && (
            <button type="button" className="btn small ghost" onClick={() => onChange(null)}>
              مسح الرسم
            </button>
          )}
        </>
      )}
      {matched && (
        <div className={matched.length ? "match-result" : "match-result empty-area"} role="status">
          <Icon name={matched.length ? "users" : "close"} size={17} />
          <strong>
            {matched.length ? `${matched.length} مستعلم في هذه المنطقة` : "لا يوجد مستعلم متاح في هذه المنطقة"}
          </strong>
          <span>{matched.slice(0, 4).map((person) => person.full_name).join("، ")}</span>
        </div>
      )}
    </div>
  );
}
