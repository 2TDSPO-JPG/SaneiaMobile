import { createContext, useCallback, useContext, useState } from 'react';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  return <SessionContext.Provider value={{ session, setSession }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

export function useErrorText() {
  const { setSession } = useSession();
  return useCallback((error) => {
    if (error.status === 401) setSession(null);
    return error.message;
  }, [setSession]);
}
