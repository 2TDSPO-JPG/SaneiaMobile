import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors } from '../theme';
import MapLabel from './MapLabel';

export default function MonitorMap({ center, markers = [], selection, onSelect }) {
  const map = useRef(null);
  const region = { ...center, latitudeDelta: 0.014, longitudeDelta: 0.014 };
  useEffect(() => {
    map.current?.animateToRegion({
      latitude: center.latitude, longitude: center.longitude,
      latitudeDelta: 0.014, longitudeDelta: 0.014,
    }, 250);
  }, [center.latitude, center.longitude]);

  function fitMarkers() {
    if (!onSelect && markers.length > 1) {
      map.current?.fitToCoordinates(markers.map(({ coordinate }) => coordinate), {
        edgePadding: { top: 45, right: 45, bottom: 45, left: 45 }, animated: false,
      });
    }
  }

  return <View style={{ borderRadius: 15, overflow: 'hidden', backgroundColor: colors.soft }}>
    <MapView ref={map} initialRegion={region} onMapReady={fitMarkers}
      style={{ height: onSelect ? 225 : 310, width: '100%' }}
      onPress={onSelect ? ({ nativeEvent }) => onSelect(nativeEvent.coordinate) : undefined}>
      {markers.map((marker) => <Marker key={marker.id} coordinate={marker.coordinate}
        accessibilityLabel={marker.title} anchor={{ x: 0.5, y: 0.5 }} onPress={marker.onPress}>
        <MapLabel marker={marker} />
      </Marker>)}
      {selection && <Marker coordinate={selection} title="Local do problema" pinColor={colors.primary} />}
    </MapView>
  </View>;
}
