import EquipmentMapDOM from './EquipmentMapDOM';

export default function MonitorMap({ center, markers = [], selection, onSelect }) {
  const points = markers.map(({ id, title, coordinate, prefix, status, compact }) => ({
    id, title, coordinate, prefix, status, compact,
  }));

  async function pressMarker(id) {
    markers.find((marker) => marker.id === id)?.onPress?.();
  }

  async function selectCoordinate(value) {
    onSelect?.(value);
  }

  const height = onSelect ? 280 : 410;
  return <EquipmentMapDOM center={center} points={points} selection={selection ?? null}
    picking={Boolean(onSelect)} onMarker={pressMarker} onPick={selectCoordinate}
    dom={{ style: { height, flex: 0 }, scrollEnabled: false }} />;
}
