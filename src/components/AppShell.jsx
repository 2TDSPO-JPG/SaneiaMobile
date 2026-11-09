import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../session';
import { colors, roleLabels } from '../theme';

function entries(role) {
  return [
    ['Início', 'home', '/inicio'],
    ...(role === 'admin' ? [['Equipamentos', 'cpu', '/equipamentos'], ['Usuários', 'users', '/usuarios']]
      : [...(role === 'operator' ? [['Mapa', 'map', '/mapa']] : []), ['Relatos', 'file-text', '/relatos']]),
    ['Perfil', 'user', '/perfil'],
  ];
}

function Navigation({ desktop, role }) {
  const router = useRouter();
  const pathname = usePathname();
  return <View style={desktop ? layout.links : layout.nav}>
    {entries(role).map(([label, icon, path]) => {
      const selected = pathname === path
        || (path === '/equipamentos' && pathname === '/equipamento')
        || (path === '/relatos' && /^\/(relato|bairro)\//.test(pathname))
        || (path === '/mapa' && pathname.startsWith('/sensor/'));
      return <Pressable key={path} accessibilityRole="tab" accessibilityLabel={label}
        accessibilityState={{ selected }} onPress={() => { if (pathname !== path) router.replace(path); }}
        style={({ pressed }) => [desktop ? layout.link : layout.tab, desktop && selected && layout.active, pressed && { opacity: 0.7 }]}>
        <Feather name={icon} size={19} color={selected ? colors.primary : colors.muted} />
        <Text style={[desktop ? layout.linkLabel : layout.tabLabel, selected && { color: colors.primary, fontWeight: '700' }]}>{label}</Text>
        {desktop && selected && <View style={layout.dot} />}
      </Pressable>;
    })}
  </View>;
}

export default function AppShell({ children, Brand, back, tabs, auth, narrow }) {
  const router = useRouter();
  const { session } = useSession();
  const desktop = useWindowDimensions().width >= 980;
  const rail = desktop && Boolean(session);
  const initials = session?.user.name.split(' ').filter(Boolean).map((name) => name[0]).slice(0, 2).join('');
  return <SafeAreaView style={layout.safe}>
    <View style={layout.frame}>
      {rail && <View style={layout.rail}>
        <Brand />
        <Text style={layout.caption}>{roleLabels[session.user.role]}</Text>
        <Navigation desktop role={session.user.role} />
        <View style={layout.railFooter}><Feather name="droplet" size={16} color={colors.primary} />
          <Text style={layout.caption}>Gestão de saneamento</Text></View>
      </View>}
      <View style={layout.main}>
        <View style={[layout.top, desktop && { paddingHorizontal: 40 }]}>
          <View style={layout.topLeft}>
            {back && <Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={layout.back}
              onPress={() => router.canGoBack() ? router.back() : router.replace(session ? '/inicio' : '/')}>
              <Feather name="arrow-left" size={20} color={colors.ink} />
            </Pressable>}
            {rail ? <Text style={layout.caption}>Gestão de saneamento</Text> : <Brand />}
          </View>
          {session && <Pressable accessibilityRole="button" accessibilityLabel="Abrir meu perfil"
            onPress={() => router.push('/perfil')} style={layout.account}>
            {desktop && <View><Text style={layout.accountName}>{session.user.name}</Text>
              <Text style={layout.caption}>{roleLabels[session.user.role]}</Text></View>}
            <View style={layout.avatar}><Text style={layout.initials}>{initials}</Text></View>
          </Pressable>}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={[layout.scroll, desktop && { paddingHorizontal: 40, paddingTop: 32 }, auth && { justifyContent: 'center' }]}>
          <View style={[layout.shell, narrow && { maxWidth: 760 }, auth && layout.authShell]}>
            {auth && desktop && <View style={layout.aside}>
              <View style={layout.mark}><Image source={require('../../assets/icon.png')} style={{ width: 92, height: 92 }} /></View>
              <Text style={layout.asideTitle}>Gestão de saneamento</Text>
              <Text style={layout.asideBody}>Registros de ocorrências, acompanhamento de protocolos e monitoramento de equipamentos.</Text>
              {[['file-text', 'Atendimento ao morador', 'Solicitações e atualizações em um só lugar.'],
                ['map-pin', 'Acompanhamento por região', 'Equipamentos, endereços e histórico de leituras.']].map(([icon, title, text]) =>
                <View key={icon} style={layout.feature}><Feather name={icon} size={20} color={colors.primary} />
                  <View style={{ flex: 1, gap: 5 }}><Text style={layout.accountName}>{title}</Text><Text style={layout.caption}>{text}</Text></View></View>)}
            </View>}
            <View style={[layout.content, auth && layout.authContent]}>{children}</View>
          </View>
        </ScrollView>
        {tabs && !desktop && <Navigation role={session?.user.role} />}
      </View>
    </View>
  </SafeAreaView>;
}

const layout = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  frame: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  rail: { width: 228, padding: 24, paddingTop: 34, gap: 14, backgroundColor: colors.surface, borderRightWidth: 1, borderColor: colors.line },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  links: { gap: 7, marginTop: 25 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 7 },
  active: { backgroundColor: colors.soft },
  linkLabel: { color: colors.muted, fontSize: 14, flex: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  railFooter: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 30 },
  top: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 34, height: 38, justifyContent: 'center', alignItems: 'center' },
  account: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  accountName: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  scroll: { flexGrow: 1, alignItems: 'center', padding: 20, paddingTop: 26, paddingBottom: 36 },
  shell: { width: '100%', maxWidth: 1080 },
  content: { width: '100%', gap: 18 },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 10 },
  tab: { flex: 1, paddingVertical: 13, minHeight: 63, alignItems: 'center', gap: 5 },
  tabLabel: { fontSize: 11, color: colors.muted },
  authShell: { maxWidth: 970, flexDirection: 'row', alignItems: 'center', gap: 64, paddingVertical: 20 },
  authContent: { flex: 1, maxWidth: 440, alignSelf: 'center', gap: 22 },
  aside: { flex: 1, gap: 26, paddingVertical: 35 },
  mark: { width: 112, height: 112, backgroundColor: colors.soft, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  asideTitle: { fontSize: 36, lineHeight: 43, letterSpacing: -1.2, fontWeight: '600', color: colors.ink, maxWidth: 300 },
  asideBody: { color: colors.muted, fontSize: 15, lineHeight: 24, maxWidth: 320 },
  feature: { flexDirection: 'row', gap: 14, alignItems: 'center' },
});
