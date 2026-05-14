"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { AuthSession } from "@/lib/types";

export const SESSION_STORAGE_KEY = "ccbid-jwt-session";
const SESSION_EVENT = "ccbid-session-updated";

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as AuthSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function emitSessionEvent() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function writeStoredSession(session: AuthSession) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  emitSessionEvent();
}

export function clearStoredSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  emitSessionEvent();
}

export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  const hydrateSession = useCallback(async () => {
    const stored = readStoredSession();

    if (!stored) {
      setSession(null);
      setReady(true);
      return;
    }

    const response = await api.getMe(stored.accessToken);
    if (response.ok && response.data) {
      setSession({ ...stored, user: response.data });
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      setSession(null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void hydrateSession();

    function handleStorage(event: StorageEvent) {
      if (event.key === SESSION_STORAGE_KEY) {
        void hydrateSession();
      }
    }

    function handleSessionEvent() {
      void hydrateSession();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(SESSION_EVENT, handleSessionEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(SESSION_EVENT, handleSessionEvent);
    };
  }, [hydrateSession]);

  const currentUser = session?.user ?? null;
  const accessToken = session?.accessToken ?? null;

  const derived = useMemo(() => {
    const isBidder = currentUser?.role === "BIDDER";
    const isAuctioneer = currentUser?.role === "AUCTIONEER";
    const activeBidderId = isBidder ? currentUser?.profileId ?? currentUser?.username ?? "" : "";

    return {
      isBidder,
      isAuctioneer,
      activeBidderId
    };
  }, [currentUser]);

  const saveSession = useCallback((nextSession: AuthSession) => {
    writeStoredSession(nextSession);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(() => {
    clearStoredSession();
    setSession(null);
  }, []);

  return {
    ready,
    session,
    currentUser,
    accessToken,
    saveSession,
    signOut,
    refreshSession: hydrateSession,
    ...derived
  };
}
