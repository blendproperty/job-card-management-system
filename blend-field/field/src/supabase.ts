import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import type { Database } from "./database.types";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in field/.env.local");

/** Session kept on the device (AsyncStorage on phones, localStorage on web) so sign-in survives restarts. */
export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground (Supabase's React Native guidance).
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (s) => (s === "active" ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh()));
}
