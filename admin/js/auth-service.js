import { getSupabaseClient } from "./supabase-client.js";

export async function signIn(email, password) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("No session returned after sign-in.");
  return data.session;
}

export async function signOut() {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser() {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function onAuthStateChange(callback) {
  const client = await getSupabaseClient();
  const { data } = client.auth.onAuthStateChange(callback);
  return data.subscription;
}
