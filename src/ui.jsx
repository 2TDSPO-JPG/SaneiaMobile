import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AppShell from './components/AppShell';
import { colors } from './theme';

export function Brand({ light = false }) {
  return (
    <View style={styles.brand}>
      <Image source={require('../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
      <Text style={[styles.brandText, light && { color: colors.surface }]}>Saneia</Text>
    </View>
  );
}

export function Screen(props) {
  return <AppShell {...props} Brand={Brand} />;
}

export function Heading({ kicker, title, subtitle }) {
  return <View style={styles.heading}>
    {!!kicker && <Text style={styles.kicker}>{kicker}</Text>}
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {!!subtitle && <Text style={styles.paragraph}>{subtitle}</Text>}
  </View>;
}

export function Body({ children, style }) {
  return <Text style={[styles.paragraph, style]}>{children}</Text>;
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, icon, secondary = false, danger = false, busy = false, disabled = false }) {
  const color = danger ? colors.danger : secondary ? colors.primary : colors.surface;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ busy, disabled: busy || disabled }}
      disabled={busy || disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, danger && styles.danger,
        (pressed || busy || disabled) && { opacity: 0.65 }]}>
      {busy ? <ActivityIndicator color={color} /> : icon && <Feather name={icon} size={18} color={color} />}
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }) {
  const tones = {
    neutral: [colors.grayBg, colors.muted], green: [colors.soft, colors.primary],
    red: [colors.dangerBg, colors.danger], blue: [colors.blueBg, colors.blue],
    yellow: [colors.warningBg, colors.warning],
  };
  const [bg, fg] = tones[tone] || tones.neutral;
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[styles.badgeText, { color: fg }]}>{label}</Text></View>;
}

export function Field({ label, trailing, ...props }) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={styles.inputFrame}>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline && styles.multiline, props.editable === false && { opacity: 0.6 }]} {...props} />
      {trailing}
    </View>
  </View>;
}

export function EmptyState({ icon = 'inbox', title, description }) {
  return <View style={styles.empty}>
    <View style={styles.emptyIcon}><Feather name={icon} size={24} color={colors.muted} /></View>
    <Text style={styles.itemTitle}>{title}</Text>
    {!!description && <Body style={{ textAlign: 'center', maxWidth: 340 }}>{description}</Body>}
  </View>;
}

export function Metric({ label, value, icon = 'activity', tone = 'green', onPress }) {
  const palette = tone === 'red' ? [colors.dangerBg, colors.danger]
    : tone === 'yellow' ? [colors.warningBg, colors.warning] : [colors.soft, colors.primary];
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={`${value} registros`}
    onPress={onPress} style={({ pressed }) => [styles.metric, pressed && { opacity: 0.7 }]}>
    <View style={styles.metricTop}>
      <View style={[styles.metricIcon, { backgroundColor: palette[0] }]}><Feather name={icon} size={17} color={palette[1]} /></View>
      <Feather name="arrow-up-right" size={15} color={colors.muted} />
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </Pressable>;
}

export function Notice({ text, error = false }) {
  if (!text) return null;
  return <View style={[styles.notice, error && styles.danger]}>
    <Feather name={error ? 'alert-circle' : 'info'} size={17} color={error ? colors.danger : colors.primary} />
    <Text accessibilityLiveRegion="polite" style={[styles.noticeText, error && { color: colors.danger }]}>{text}</Text>
  </View>;
}

export function Resource({ state, children }) {
  if (state.loading) return <View style={styles.loading}><ActivityIndicator accessibilityLabel="Carregando" color={colors.primary} /><Body>Carregando informações…</Body></View>;
  if (state.error) return <Card><Notice error text={state.error} /><Button secondary title="Tentar novamente" icon="refresh-cw" onPress={state.retry} /></Card>;
  return state.data == null ? null : <>
    {state.refreshError && <Notice error text={`Não foi possível atualizar as informações. ${state.refreshError}`} />}
    {children(state.data)}
  </>;
}

export function ListItem({ title, description, metadata, icon, tone, badge, onPress }) {
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.listItem, pressed && { opacity: 0.65 }]}>
    <View style={styles.listIcon}><Feather name={icon} color={colors.primary} size={19} /></View>
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={styles.itemTitle}>{title}</Text>
      {!!description && <Body style={{ fontSize: 13 }}>{description}</Body>}
      {!!metadata && <Body style={{ fontSize: 12, lineHeight: 17 }}>{metadata}</Body>}
      {!!badge && <Badge label={badge} tone={tone} />}
    </View>
    <Feather name="chevron-right" size={18} color={colors.muted} />
  </Pressable>;
}

export const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 32, height: 32, borderRadius: 7 },
  brandText: { fontSize: 24, letterSpacing: -0.8, color: colors.ink, fontWeight: '700' },
  heading: { gap: 6, paddingBottom: 6 },
  kicker: { color: colors.muted, fontWeight: '500', fontSize: 12 },
  title: { fontSize: 28, lineHeight: 35, letterSpacing: -0.8, color: colors.ink, fontWeight: '700' },
  paragraph: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  section: { color: colors.ink, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  card: { padding: 20, gap: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  button: { paddingHorizontal: 18, paddingVertical: 13, minHeight: 46, borderRadius: 7, backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  buttonText: { fontSize: 14, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  secondary: { backgroundColor: colors.soft },
  danger: { backgroundColor: colors.dangerBg },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 5 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  field: { gap: 7 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  inputFrame: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 7, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 13, paddingVertical: 12, minHeight: 46, color: colors.ink, fontSize: 14 },
  multiline: { minHeight: 105, textAlignVertical: 'top' },
  notice: { flexDirection: 'row', gap: 9, padding: 13, borderRadius: 7, alignItems: 'flex-start', backgroundColor: colors.soft },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 20, color: colors.primary },
  listItem: { padding: 17, flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 9, borderWidth: 1, borderColor: colors.line },
  listIcon: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: colors.ink, fontWeight: '600', fontSize: 14, lineHeight: 20 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexBasis: 145, flexGrow: 1, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 9 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricIcon: { width: 31, height: 31, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  metricValue: { color: colors.ink, fontSize: 30, lineHeight: 37, fontWeight: '600', letterSpacing: -1 },
  metricLabel: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 34, paddingHorizontal: 20, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line },
  emptyIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.grayBg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  loading: { padding: 32, alignItems: 'center', gap: 12 },
});
