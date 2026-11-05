import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import MapLabel from './MapLabel';

export default function MonitorMap({ center, markers = [], selection, onSelect }) {
  const mapWidth = useRef(0);
  const extent = Math.max(0.007, ...markers.flatMap(({ coordinate }) => [
    Math.abs(coordinate.latitude - center.latitude) * 1.3, Math.abs(coordinate.longitude - center.longitude) * 1.3,
  ]));
  const shown = selection ? [{ id: 'selected', title: 'Local escolhido', coordinate: selection, symbol: '+', color: colors.primary }] : markers;
  const height = onSelect ? 210 : 300;
  return <View style={[map.styles, { height }]} onLayout={(event) => { mapWidth.current = event.nativeEvent.layout.width; }}>
    {onSelect && <Pressable accessibilityRole="button" accessibilityLabel="Marcar local no mapa esquemático"
      style={StyleSheet.absoluteFill} onPress={({ nativeEvent }) => {
        const x = nativeEvent.locationX;
        const y = nativeEvent.locationY;
        if (!mapWidth.current || !Number.isFinite(x) || !Number.isFinite(y)) return;
        onSelect({ latitude: center.latitude + (0.5 - y / height) * extent * 2,
          longitude: center.longitude + (x / mapWidth.current - 0.5) * extent * 2 });
      }} />}
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[19, 40, 65, 83].map((position) => <View key={position}
        style={[map.road, { top: `${position}%`, transform: [{ rotate: '-9deg' }] }]} />)}
      {[18, 43, 66, 84].map((position) => <View key={position}
        style={[map.cross, { left: `${position}%`, transform: [{ rotate: '10deg' }] }]} />)}
      <Text style={map.caption}>MAPA ESQUEMÁTICO</Text>
    </View>
    {shown.map((marker) => {
      const top = `${50 - 50 * (marker.coordinate.latitude - center.latitude) / extent}%`;
      const left = `${50 + 50 * (marker.coordinate.longitude - center.longitude) / extent}%`;
      return marker.onPress
        ? <Pressable key={marker.id} accessibilityRole="button" accessibilityLabel={marker.title}
          style={[map.equipment, { top, left }]} onPress={marker.onPress}>
          <MapLabel marker={marker} />
        </Pressable>
        : <View key={marker.id} pointerEvents="none" style={[map.marker, { top, left, backgroundColor: marker.color }]}>
          <Text style={map.symbol}>{marker.symbol}</Text>
        </View>;
    })}
  </View>;
}

const map = StyleSheet.create({
  styles: { overflow: 'hidden', borderRadius: 15, backgroundColor: '#DCECE4' },
  road: { position: 'absolute', left: -15, right: -15, height: 7, backgroundColor: '#F6FAF8' },
  cross: { position: 'absolute', top: -15, bottom: -15, width: 7, backgroundColor: '#F6FAF8' },
  caption: { position: 'absolute', bottom: 8, right: 8, color: colors.muted, fontSize: 9, fontWeight: '800' },
  equipment: { position: 'absolute', width: 86, marginLeft: -43, marginTop: -13, alignItems: 'center' },
  marker: { position: 'absolute', width: 31, height: 31, borderRadius: 16, marginLeft: -15, marginTop: -15,
    borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  symbol: { color: colors.surface, fontSize: 13, fontWeight: '800' },
});
