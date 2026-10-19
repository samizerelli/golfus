import L from '../lib/leafletGlobal';
import 'leaflet.markercluster';
import { useEffect, useRef } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import type { GolfSummary } from '../../shared/types';
import { useI18n } from '../i18n';
import type { Origin } from '../state/search';

const EUROPE: L.LatLngExpression = [44.5, 2];
const FLAG_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21V4l10 4-10 4"/></svg>';

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right?: number;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function pillIcon(label: string | null, selected: boolean, demo: boolean) {
  return L.divIcon({
    className: 'price-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div class="price-pill${selected ? ' is-selected' : ''}${demo ? ' is-demo' : ''}">${label ? esc(label) : FLAG_SVG}</div>`,
  });
}

function FitToResults({ origin, golfs, radiusKm, insets }: { origin: Origin | null; golfs: GolfSummary[]; radiusKm: number; insets: Insets }) {
  const map = useMap();
  const key = origin ? `${origin.lat},${origin.lon},${radiusKm},${golfs.length > 0}` : 'none';
  const last = useRef('');
  useEffect(() => {
    if (key === last.current || !origin) return;
    last.current = key;
    const pts = golfs.slice(0, 15).map((g) => L.latLng(g.lat, g.lon));
    const opts = { paddingTopLeft: [insets.left + 30, insets.top + 30] as L.PointTuple, paddingBottomRight: [(insets.right ?? 0) + 30, insets.bottom + 30] as L.PointTuple, maxZoom: 13 };
    if (pts.length) map.flyToBounds(L.latLngBounds([L.latLng(origin.lat, origin.lon), ...pts]), { ...opts, duration: 0.9 });
    else map.flyTo([origin.lat, origin.lon], radiusKm > 50 ? 8 : radiusKm > 25 ? 9 : 10, { duration: 0.9 });
  }, [key, origin, golfs, radiusKm, map, insets]);
  return null;
}

/** Attribution OSM en haut à droite (le tiroir mobile masque le bas de la carte) */
function AttributionTop() {
  const map = useMap();
  useEffect(() => {
    const c = L.control.attribution({ position: 'topright', prefix: false }).addTo(map);
    return () => {
      c.remove();
    };
  }, [map]);
  return null;
}

/** Écran 3 : zoom fluide sur le golf choisi, en évitant les panneaux */
function FocusGolf({ golf, insets }: { golf: GolfSummary | null; insets: Insets }) {
  const map = useMap();
  useEffect(() => {
    if (!golf) return;
    const d = 0.01;
    map.flyToBounds(
      [
        [golf.lat - d, golf.lon - d],
        [golf.lat + d, golf.lon + d],
      ],
      { paddingTopLeft: [insets.left + 40, insets.top + 40], paddingBottomRight: [(insets.right ?? 0) + 40, insets.bottom + 40], maxZoom: 14, duration: 0.8 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [golf?.id, map]);
  return null;
}

function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Marqueurs « pastille de prix » regroupés en grappes, gérés hors du rendu React pour la fluidité. */
function GolfMarkers({
  golfs,
  selectedId,
  onSelect,
  labelFor,
  unnamedLabel,
  insets,
  highlightId,
}: {
  golfs: GolfSummary[];
  highlightId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  labelFor: (g: GolfSummary) => string | null;
  unnamedLabel: string;
  insets: Insets;
}) {
  const map = useMap();
  const group = useRef<L.MarkerClusterGroup | null>(null);
  const markers = useRef(new Map<string, { m: L.Marker; g: GolfSummary; label: string | null }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selectedId);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const highlightRef = useRef<string | null>(null);

  useEffect(() => {
    const g = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      maxClusterRadius: 52,
      spiderfyDistanceMultiplier: 1.6,
      iconCreateFunction: (c) =>
        L.divIcon({ html: `<div>${c.getChildCount()}</div>`, className: 'glass-cluster', iconSize: [44, 44] }),
    });
    // Zoom sur une grappe en tenant compte des zones masquées par l'interface
    g.on('clusterclick', (e) => {
      const c = (e as unknown as { layer: L.MarkerCluster }).layer;
      const ins = insetsRef.current;
      if (map.getZoom() >= map.getMaxZoom() - 1) return c.spiderfy();
      map.flyToBounds(c.getBounds(), {
        paddingTopLeft: [ins.left + 40, ins.top + 40],
        paddingBottomRight: [(ins.right ?? 0) + 40, ins.bottom + 40],
        maxZoom: 16,
        duration: 0.6,
      });
    });
    map.addLayer(g);
    group.current = g;
    return () => {
      map.removeLayer(g);
    };
  }, [map]);

  useEffect(() => {
    const g = group.current!;
    g.clearLayers();
    markers.current.clear();
    const list = golfs.map((golf) => {
      const name = golf.name || unnamedLabel;
      const label = labelFor(golf);
      const m = L.marker([golf.lat, golf.lon], {
        icon: pillIcon(label, golf.id === selectedRef.current, golf.isDemo),
        title: label ? `${name} · ${label}` : name,
        alt: name,
        keyboard: true,
        riseOnHover: true,
      });
      m.on('click', () => onSelectRef.current(golf.id));
      markers.current.set(golf.id, { m, g: golf, label });
      return m;
    });
    g.addLayers(list);
  }, [golfs, labelFor, unnamedLabel]);

  useEffect(() => {
    const prev = selectedRef.current;
    selectedRef.current = selectedId;
    for (const id of [prev, selectedId]) {
      const e = id ? markers.current.get(id) : null;
      if (e) e.m.setIcon(pillIcon(e.label, id === selectedId, e.g.isDemo));
    }
    const sel = selectedId ? markers.current.get(selectedId) : null;
    if (sel) {
      sel.m.setZIndexOffset(1000);
      group.current?.zoomToShowLayer(sel.m, () => {
        if (!map.getBounds().pad(-0.2).contains(sel.m.getLatLng())) map.panTo(sel.m.getLatLng(), { animate: true, duration: 0.5 });
      });
    }
    if (prev && prev !== selectedId) markers.current.get(prev)?.m.setZIndexOffset(0);
  }, [selectedId, map]);

  // Surbrillance au survol de la liste : on change seulement l'apparence du marqueur
  useEffect(() => {
    const prev = highlightRef.current;
    highlightRef.current = highlightId;
    for (const id of [prev, highlightId]) {
      const e = id ? markers.current.get(id) : null;
      if (e) e.m.setIcon(pillIcon(e.label, id === highlightId || id === selectedRef.current, e.g.isDemo));
      if (e) e.m.setZIndexOffset(id === highlightId ? 900 : id === selectedRef.current ? 1000 : 0);
    }
  }, [highlightId]);

  return null;
}

const userIcon = L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9], html: '<div class="user-dot"></div>' });

export function MapView({
  origin,
  golfs,
  radiusKm,
  selectedId,
  onSelect,
  unnamedLabel,
  labelFor,
  insets = { top: 0, bottom: 0, left: 0 },
  showRadius = true,
  focus = null,
  highlightId = null,
}: {
  origin: Origin | null;
  golfs: GolfSummary[];
  radiusKm: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  unnamedLabel: string;
  labelFor: (g: GolfSummary) => string | null;
  /** Zones couvertes par l'interface (barre de recherche, tiroir, panneau) à éviter lors du cadrage */
  insets?: Insets;
  showRadius?: boolean;
  /** Golf sur lequel centrer la carte (écran 3) */
  focus?: GolfSummary | null;
  highlightId?: string | null;
}) {
  const { t } = useI18n();

  return (
    <section aria-label={t('map.label')} className="absolute inset-0">
      <MapContainer center={EUROPE} zoom={5} className="size-full" zoomControl={false} attributionControl={false}>
        <AttributionTop />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          className="map-tiles"
        />
        <AutoResize />
        {!focus && <FitToResults origin={origin} golfs={golfs} radiusKm={radiusKm} insets={insets} />}
        <FocusGolf golf={focus} insets={insets} />
        {origin && (
          <>
            {showRadius && <Circle
              center={[origin.lat, origin.lon]}
              radius={radiusKm * 1000}
              pathOptions={{ color: '#7fb6e6', weight: 1.5, dashArray: '4 8', fillColor: '#7fb6e6', fillOpacity: 0.06 }}
              interactive={false}
            />}
            <Marker position={[origin.lat, origin.lon]} icon={userIcon} title={t('map.you')} alt={t('map.you')} keyboard={false} />
          </>
        )}
        <GolfMarkers golfs={golfs} selectedId={selectedId} highlightId={highlightId} onSelect={onSelect} labelFor={labelFor} unnamedLabel={unnamedLabel} insets={insets} />
      </MapContainer>
    </section>
  );
}
