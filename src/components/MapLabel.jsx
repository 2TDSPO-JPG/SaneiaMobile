import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function MapLabel({ marker }) {
  const alarm = marker.status === 'alarm';
  const warning = marker.status === 'warning';
  const offline = marker.status === 'offline';
  if (marker.compact) return <View style={[styles.dot, {
    backgroundColor: alarm ? colors.danger : warning ? '#FFD65B' : offline ? '#82938B' : colors.primary,
  }]}>
    {(alarm || warning || offline) && <Text style={[styles.compactSign, {
      color: warning ? colors.ink : colors.surface,
    }]}>{offline ? '?' : '!'}</Text>}
  </View>;
  return <View style={styles.label}>
    {(alarm || warning || offline) && <View style={[styles.signal, {
      backgroundColor: alarm ? colors.danger : warning ? '#FFD65B' : colors.grayBg,
    }]}>
      <Text style={[styles.sign, { color: alarm ? colors.surface : colors.ink }]}>{offline ? '?' : '!'}</Text>
    </View>}
    <Text numberOfLines={1} style={styles.text}>{marker.prefix}</Text>
  </View>;
}

const styles = StyleSheet.create({
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.surface,
    alignItems: 'center', justifyContent: 'center' },
  compactSign: { fontSize: 9, lineHeight: 11, fontWeight: '900' },
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 6, minHeight: 26, borderRadius: 6, borderWidth: 1, borderColor: '#C4D5CF',
    backgroundColor: colors.surface },
  text: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  signal: { width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sign: { fontSize: 11, fontWeight: '900' },
});
