'use dom';

import MonitorMap from './MonitorMap.web';

export default function EquipmentMapDOM({ center, points, selection, picking, onMarker, onPick }) {
  const markers = points.map((point) => ({
    ...point,
    onPress: () => onMarker(point.id),
  }));
  return <MonitorMap center={center} markers={markers} selection={selection}
    onSelect={picking ? onPick : undefined} />;
}
