"use client";

import type { Board, Experience, FriendPost, Trip, User } from "@/lib/data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export async function fetchProfiles(): Promise<User[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data.map((profile) => ({
    id: profile.id,
    name: profile.display_name,
    handle: profile.handle,
    avatarUrl: profile.avatar_url,
  }));
}

export async function fetchTrips(): Promise<Trip[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("trips").select("*").order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data.map((trip) => ({
    id: trip.id,
    userId: trip.user_id,
    title: trip.title,
    destination: trip.destination,
    date: trip.date_label,
    coverImageUrl: trip.cover_image_url,
  }));
}

export async function fetchExperiences(): Promise<Experience[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("experiences").select("*").order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data.map((experience) => ({
    id: experience.id,
    slug: experience.slug,
    name: experience.name,
    location: experience.location,
    island: experience.region,
    coordinates: [experience.longitude, experience.latitude],
    caption: experience.caption,
    highlight: experience.highlight ?? undefined,
    imageUrl: experience.image_url,
    userId: experience.user_id,
    tripId: experience.trip_id,
    alsoExperiencedBy: experience.also_experienced_by,
  }));
}

export async function fetchFriendPosts(): Promise<FriendPost[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("friend_posts").select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map((post) => ({
    id: post.id,
    type: post.type,
    userId: post.user_id,
    title: post.title,
    destination: post.destination,
    date: post.date_label,
    caption: post.caption,
    imageUrl: post.image_url,
    coordinates: [post.longitude, post.latitude],
  }));
}

export async function fetchBoards(): Promise<Board[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = createSupabaseBrowserClient();
  const [{ data: boards, error: boardsError }, { data: boardItems, error: boardItemsError }] = await Promise.all([
    supabase.from("boards").select("*").order("created_at", { ascending: true }),
    supabase.from("board_items").select("board_id, experience_slug").order("created_at", { ascending: true }),
  ]);

  if (boardsError) {
    throw boardsError;
  }

  if (boardItemsError) {
    throw boardItemsError;
  }

  return boards.map((board) => ({
    id: board.id,
    slug: board.slug,
    title: board.title,
    subtitle: board.subtitle,
    coverImageUrl: board.cover_image_url,
    experienceSlugs: boardItems.filter((item) => item.board_id === board.id).map((item) => item.experience_slug),
  }));
}
