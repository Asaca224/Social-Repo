"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface Client {
  id: string;
  name: string;
}

interface AppState {
  ready: boolean;
  agencyId: string;
  userId: string;
  clients: Client[];
  clientId: string;
  selectedClient: Client | null;
  setSession: (agencyId: string, userId?: string) => void;
  clearSession: () => void;
  setClientId: (id: string) => void;
  reloadClients: () => Promise<void>;
  /** fetch() with the tenant header attached (dev stand-in for the Clerk session). */
  api: (path: string, init?: RequestInit) => Promise<Response>;
}

const AppCtx = createContext<AppState | null>(null);

const K_AGENCY = "socialops.agencyId";
const K_USER = "socialops.userId";
const K_CLIENT = "socialops.clientId";

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [agencyId, setAgencyId] = useState("");
  const [userId, setUserId] = useState("");
  const [clientId, setClientIdState] = useState("");
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    setAgencyId(localStorage.getItem(K_AGENCY) ?? "");
    setUserId(localStorage.getItem(K_USER) ?? "");
    setClientIdState(localStorage.getItem(K_CLIENT) ?? "");
    setReady(true);
  }, []);

  const api = useCallback(
    (path: string, init: RequestInit = {}) => {
      const headers: Record<string, string> = {
        ...(init.headers as Record<string, string> | undefined),
        "x-agency-id": agencyId,
      };
      if (init.body && !headers["content-type"]) headers["content-type"] = "application/json";
      return fetch(path, { ...init, headers });
    },
    [agencyId],
  );

  const reloadClients = useCallback(async () => {
    if (!agencyId) {
      setClients([]);
      return;
    }
    const res = await api("/api/clients");
    if (res.ok) setClients(((await res.json()) as { clients: Client[] }).clients);
  }, [agencyId, api]);

  useEffect(() => {
    if (ready && agencyId) void reloadClients();
  }, [ready, agencyId, reloadClients]);

  const setClientId = useCallback((id: string) => {
    setClientIdState(id);
    if (id) localStorage.setItem(K_CLIENT, id);
    else localStorage.removeItem(K_CLIENT);
  }, []);

  const setSession = useCallback((newAgencyId: string, newUserId = "") => {
    localStorage.setItem(K_AGENCY, newAgencyId);
    if (newUserId) localStorage.setItem(K_USER, newUserId);
    localStorage.removeItem(K_CLIENT);
    setAgencyId(newAgencyId);
    setUserId(newUserId);
    setClientIdState("");
  }, []);

  const clearSession = useCallback(() => {
    [K_AGENCY, K_USER, K_CLIENT].forEach((k) => localStorage.removeItem(k));
    setAgencyId("");
    setUserId("");
    setClientIdState("");
    setClients([]);
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  const value: AppState = {
    ready,
    agencyId,
    userId,
    clients,
    clientId,
    selectedClient,
    setSession,
    clearSession,
    setClientId,
    reloadClients,
    api,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
