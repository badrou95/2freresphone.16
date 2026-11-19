import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { AdminUser } from '../types';

interface AuthContextValue {
  user: User | null;
  admin: AdminUser | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const verifyAdminUser = React.useCallback(async (fbUser: User | null, forceRefresh = false) => {
    setUser(fbUser);
    setAuthError(null);
    if (!fbUser) {
      setAdmin(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const token = await fbUser.getIdToken(forceRefresh);
      const res = await fetch('/api/admin/me', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAdmin(null);
        if (data.error) {
          setAuthError(data.error);
        } else if (res.status >= 500) {
          setAuthError(`Erreur serveur (${res.status}) lors de la vérification du compte administrateur.`);
        } else {
          setAuthError('Accès administrateur refusé.');
        }
      } else {
        setAdmin(data.admin);
      }
    } catch (err: any) {
      setAdmin(null);
      if (err?.name === 'AbortError') {
        setAuthError('Délai dépassé lors de la vérification serveur. Vérifiez votre connexion ou réessayez.');
      } else {
        setAuthError(err?.message || 'Erreur lors de la vérification du compte administrateur.');
      }
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      void verifyAdminUser(fbUser, false);
    });
    return () => unsub();
  }, [verifyAdminUser]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await verifyAdminUser(cred.user, true);
    } catch (err: any) {
      setLoading(false);
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Fenêtre de connexion fermée avant validation.');
      } else {
        setAuthError(err?.message || 'Échec de la connexion Google.');
      }
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setAdmin(null);
    setUser(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ user, admin, loading, authError, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
