import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { demoMode } from './services/api';
import { useSession } from './session';
import { colors } from './theme';

export function Brand({ light = false }) {
  return (
    <View style={styles.brand}>
      <Image source={require('../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
      <Text style={[styles.brandText, light && { color: colors.surface }]}>Saneia</Text>
    </View>
  );
}

export function Screen({ children, back = false, tabs = false }) {
  const router = useRouter();
  const { session } = useSession();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.shell}>
          <View style={styles.top}>
            {back ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={styles.back}
                onPress={() => router.canGoBack() ? router.back() : router.replace(session ? '/inicio' : '/')}>
                <Feather name="arrow-left" size={22} color={colors.ink} />
              </Pressable>
            ) : <Brand />}
            {demoMode && <View><Badge label="Demonstração" /></View>}
          </View>
          {children}
        </View>
      </ScrollView>
      {tabs && <Nav />}
    </SafeAreaView>
  );
}

function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();
  const entries = [
    ['Início', 'home', '/inicio'],
    ...(session?.user.role === 'operator' ? [['Mapa', 'map', '/mapa']] : []),
    ['Relatos', 'file-text', '/relatos'],
    ['Perfil', 'user', '/perfil'],
  ];
  return (
    <View style={styles.nav}>
      {entries.map(([title, icon, path]) => {
        const selected = pathname === path;
        return (
          <Pressable key={path} accessibilityRole="tab" accessibilityLabel={title} accessibilityState={{ selected }} style={styles.tab}
            onPress={() => { if (!selected) router.replace(path); }}>
            <Feather name={icon} size={20} color={selected ? colors.primary : colors.muted} />
            <Text style={[styles.tabLabel, selected && { color: colors.primary, fontWeight: '800' }]}>{title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
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

export function Field({ label, ...props }) {
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted}
      style={[styles.input, props.multiline && styles.multiline]} {...props} />
  </View>;
}

export function Notice({ text, error = false }) {
  if (!text) return null;
  return <View style={[styles.notice, error && styles.danger]}>
    <Feather name={error ? 'alert-circle' : 'info'} size={17} color={error ? colors.danger : colors.primary} />
    <Text accessibilityLiveRegion="polite" style={[styles.noticeText, error && { color: colors.danger }]}>{text}</Text>
  </View>;
}

export function Resource({ state, children }) {
  if (state.loading) return <ActivityIndicator accessibilityLabel="Carregando" style={{ margin: 26 }} color={colors.primary} />;
  if (state.error) return <><Notice error text={state.error} /><Button secondary title="Tentar novamente" onPress={state.retry} /></>;
  return state.data == null ? null : <>
    {state.refreshError && <Notice error text={`Não foi possível atualizar. Exibindo os últimos dados recebidos. ${state.refreshError}`} />}
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
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 30 },
  shell: { width: '100%', maxWidth: 650, gap: 15 },
  top: { minHeight: 69, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 37, height: 37, borderRadius: 10 },
  brandText: { fontSize: 26, letterSpacing: -0.9, color: colors.ink, fontWeight: '800' },
  heading: { gap: 6 },
  kicker: { color: colors.primary, fontWeight: '800', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontSize: 31, lineHeight: 37, letterSpacing: -0.9, color: colors.ink, fontWeight: '800' },
  paragraph: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  section: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  card: { padding: 16, gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 19 },
  button: { paddingHorizontal: 15, paddingVertical: 13, minHeight: 48, borderRadius: 13, backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
  buttonText: { fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  secondary: { backgroundColor: colors.soft },
  danger: { backgroundColor: colors.dangerBg },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  field: { gap: 6 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  input: { paddingHorizontal: 13, paddingVertical: 11, minHeight: 46, borderWidth: 1, borderRadius: 11, borderColor: colors.line, color: colors.ink, backgroundColor: colors.surface, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  notice: { flexDirection: 'row', gap: 8, padding: 11, borderRadius: 11, alignItems: 'flex-start', backgroundColor: colors.soft },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.primary },
  listItem: { padding: 12, flexDirection: 'row', gap: 11, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  listIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 15 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', gap: 4 },
  tabLabel: { fontSize: 11, color: colors.muted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
