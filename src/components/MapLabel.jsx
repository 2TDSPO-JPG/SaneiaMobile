import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function MapLabel({ marker }) {
  const alarm = marker.status === 'alarm';
  const warning = marker.status === 'warning';
  const offline = marker.status === 'offline';
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
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 6, minHeight: 26, borderRadius: 6, borderWidth: 1, borderColor: '#C4D5CF',
    backgroundColor: colors.surface },
  text: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  signal: { width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sign: { fontSize: 11, fontWeight: '900' },
});
