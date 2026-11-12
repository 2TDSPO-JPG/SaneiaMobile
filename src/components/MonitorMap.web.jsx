import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Notice } from '../ui';
import { colors } from '../theme';
import 'leaflet/dist/leaflet.css';
import './map.css';

export default function MonitorMap({ center, markers = [], selection, onSelect }) {
  const container = useRef(null);
  const previousView = useRef('');
  const [mapState, setMapState] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let map;
    import('leaflet').then((module) => {
      if (!active) return;
      const L = module.default;
      map = L.map(container.current, { scrollWheelZoom: false }).setView([center.latitude, center.longitude], 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      const layers = L.layerGroup().addTo(map);
      setMapState({ map, layers, L });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; map?.remove(); };
    // O mapa é criado uma vez. Mudanças de coordenadas são tratadas pelo efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapState || !onSelect) return;
    const select = ({ latlng }) => onSelect({ latitude: latlng.lat, longitude: latlng.lng });
    mapState.map.on('click', select);
    return () => mapState.map.off('click', select);
  }, [mapState, onSelect]);

  useEffect(() => {
    if (!mapState) return;
    const { map, layers, L } = mapState;
    layers.clearLayers();
    for (const marker of markers) {
      const label = document.createElement('div');
      label.className = marker.compact ? `saneia-map-dot ${marker.status}` : 'saneia-map-label';
      label.textContent = marker.compact
        ? { alarm: '!', warning: '!', offline: '?' }[marker.status] ?? ''
        : marker.prefix || marker.id;
      if (!marker.compact && ['alarm', 'warning', 'offline'].includes(marker.status)) {
        const indicator = document.createElement('span');
        indicator.className = `saneia-map-signal ${marker.status}`;
        indicator.textContent = marker.status === 'offline' ? '?' : '!';
        label.appendChild(indicator);
      }
      const icon = L.divIcon({ html: label, className: 'saneia-map-marker',
        iconSize: marker.compact ? [14, 14] : [100, 30], iconAnchor: marker.compact ? [7, 7] : [50, 15] });
      const point = L.marker([marker.coordinate.latitude, marker.coordinate.longitude], {
        icon, title: marker.title, keyboard: true,
      }).addTo(layers).on('click', () => marker.onPress?.());
      point.getElement()?.setAttribute('aria-label', marker.title);
    }
    if (selection) L.circleMarker([selection.latitude, selection.longitude], {
      radius: 9, color: '#FFFFFF', weight: 3, fillColor: colors.primary, fillOpacity: 1,
    }).addTo(layers);
    const points = selection ? [[selection.latitude, selection.longitude]]
      : markers.map(({ coordinate }) => [coordinate.latitude, coordinate.longitude]);
    const view = JSON.stringify(points.length ? points : [[center.latitude, center.longitude]]);
    if (view !== previousView.current) {
      if (points.length > 1) map.fitBounds(points, { padding: [45, 45], maxZoom: 16 });
      else map.setView(points[0] || [center.latitude, center.longitude], 15);
      previousView.current = view;
    }
    map.invalidateSize();
  }, [mapState, center.latitude, center.longitude, markers, selection]);

  return <View style={{ gap: 10 }}>
    <div ref={container} role="region" aria-label={onSelect ? 'Selecionar localização no mapa' : 'Mapa de equipamentos'}
      style={{ height: onSelect ? 280 : 410, width: '100%', borderRadius: 10, border: `1px solid ${colors.line}`, zIndex: 0 }} />
    {failed && <Notice error text="Não foi possível carregar o mapa. Atualize a página para tentar novamente." />}
  </View>;
}
