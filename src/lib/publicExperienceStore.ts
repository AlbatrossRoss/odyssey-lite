import type { Experience } from "@/lib/data";

const publicExperiencesKey = "odyssey:public-experiences";

export type PublicExperienceDraft = Experience & {
  createdAt: string;
  visibility: "Public";
};

export function readPublicExperiences() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return (JSON.parse(window.localStorage.getItem(publicExperiencesKey) ?? "[]") as PublicExperienceDraft[]).filter(
      (experience) => Array.isArray(experience.coordinates) && experience.coordinates.length === 2,
    );
  } catch {
    return [];
  }
}

export function addPublicExperience(experience: PublicExperienceDraft) {
  if (typeof window === "undefined") {
    return;
  }

  const next = [experience, ...readPublicExperiences().filter((item) => item.id !== experience.id)];
  window.localStorage.setItem(publicExperiencesKey, JSON.stringify(next));
  window.dispatchEvent(new Event("odyssey:public-experiences-changed"));
}
