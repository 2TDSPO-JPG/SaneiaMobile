import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useErrorText, useSession } from './session';

export function useResource(load, pollMs = 0) {
  const { session } = useSession();
  const errorText = useErrorText();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true });

  useFocusEffect(useCallback(() => {
    if (!session) return;
    let active = true;
    let pending = false;
    setState({ loading: true });
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const data = await load(session);
        if (active) setState({ data, loading: false });
      } catch (error) {
        if (active) {
          const message = errorText(error);
          setState((previous) => pollMs > 0 && previous.data != null
            ? { data: previous.data, refreshError: message, loading: false }
            : { error: message, loading: false });
        }
      } finally {
        pending = false;
      }
    }
    refresh();
    const interval = pollMs > 0 ? setInterval(refresh, pollMs) : null;
    return () => { active = false; if (interval) clearInterval(interval); };
    // A nova revisão reinicia a consulta mesmo quando a tela continua em foco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, session, revision, errorText, pollMs]));

  return { ...state, retry: () => setRevision((value) => value + 1) };
}
