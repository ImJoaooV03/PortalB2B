import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSeller: boolean;
  isClient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Handle Session (Auth User)
  useEffect(() => {
    let mounted = true;

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth loading timed out, forcing render.');
        setLoading(false);
      }
    }, 5000); // 5 seconds max load time

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          // If no user, we are done loading. If user exists, we wait for profile.
          if (!session?.user) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error initializing session:', err);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session?.user) {
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // 2. Handle Profile (App Data) - Depends on User
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    async function fetchProfile() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          // If network error, try to retry
          if (retryCount < maxRetries && (error.message.includes('fetch') || error.code === undefined)) {
            retryCount++;
            console.log(`Retrying profile fetch (${retryCount}/${maxRetries})...`);
            setTimeout(fetchProfile, 1000 * retryCount); // Exponential backoff-ish
            return;
          }
          console.error('Error fetching profile:', error);
        } else if (mounted) {
          setProfile(data as Profile);
        }
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
      } finally {
        // Only finish loading if we are done retrying or succeeded
        if (mounted) {
           // We set loading false in finally, but if we are retrying (returned early above), 
           // this finally block runs for the *first* call. 
           // However, since we want to keep "loading" true during retries, we should only set it false
           // if we are NOT retrying.
           // The logic above returns early on retry, so this finally block WONT run for the retry path?
           // Actually, 'return' inside try triggers finally.
           // So we need a check.
           if (retryCount === 0 || retryCount >= maxRetries || profile) {
             setLoading(false);
           }
        }
      }
    }

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setProfile(null);
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    session,
    user,
    profile,
    loading,
    signOut,
    isAdmin: profile?.role === 'admin',
    isSeller: profile?.role === 'vendedor',
    isClient: profile?.role === 'cliente',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
