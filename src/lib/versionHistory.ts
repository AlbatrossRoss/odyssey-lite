export type VersionHistoryEntry = {
  date: string;
  id: string;
  summary: string;
  title: string;
};

export const versionHistory: VersionHistoryEntry[] = [
  {
    date: "June 12, 2026",
    id: "v1.7",
    title: "Plain Share Button and Body Fix",
    summary:
      "Removed fixed body sizing, custom touch handlers, and the blocking startup splash; kept the app frame fixed to the screen and made experience Share a plain always-tappable button.",
  },
  {
    date: "June 12, 2026",
    id: "v1.6",
    title: "Fixed Shell and Inline Share",
    summary:
      "Replaced the measured viewport approach with a fixed full-screen shell, set the outside safe-area background to white, and moved experience sharing into the normal details screen as an inline button.",
  },
  {
    date: "June 12, 2026",
    id: "v1.5",
    title: "iPhone Viewport and Share Button",
    summary:
      "Synced the app height to the live iPhone viewport, fixed the mobile Share bar to the physical screen, and added a touch pointer handler so Share responds reliably in the PWA.",
  },
  {
    date: "June 12, 2026",
    id: "v1.4",
    title: "Bottom Edge and Share Tap Fix",
    summary:
      "Pinned the PWA viewport to all screen edges to remove the bottom gap, removed the tiny header Share action, and enlarged the bottom Share button with higher tap priority.",
  },
  {
    date: "June 12, 2026",
    id: "v1.3",
    title: "PWA Fullscreen and Share Fix",
    summary:
      "Locked the mobile PWA viewport to reduce rubber-band movement, contained in-app scrolling, enlarged the Create share action, and allowed sharing posts without requiring a custom title.",
  },
  {
    date: "June 12, 2026",
    id: "v1.2",
    title: "Shared Posts and Profile Grids",
    summary:
      "Added database-backed trip and experience posts, Explore feed placement, Instagram-style account post grids, and clickable post detail pages.",
  },
  {
    date: "June 12, 2026",
    id: "v1.1",
    title: "Accounts and Follows",
    summary:
      "Added create account/login, persistent app accounts, optional profile photos, account pages, follower/following counts, and follow actions.",
  },
  {
    date: "June 11, 2026",
    id: "v1.0",
    title: "Temporary App Icon",
    summary:
      "Updated the installable app icon and Apple touch icon to use the temporary Odyssey ship logo without placing the logo inside the app UI.",
  },
  {
    date: "June 11, 2026",
    id: "v0.9",
    title: "Public Experience Posts",
    summary:
      "Improved experience posting with place-name metadata, fallback metadata checks across selected media, a cleaner Instagram-style post UI, and public posts that appear on the Explore map when All is selected.",
  },
  {
    date: "June 11, 2026",
    id: "v0.8",
    title: "Navigation and Version History",
    summary:
      "Removed the Home nav tab, made Explore the map entry point with a search icon, and added this visible version history page for deployment checks.",
  },
  {
    date: "June 11, 2026",
    id: "v0.7",
    title: "Real Experience Media Picker",
    summary:
      "Removed inactive map buttons and added a real photo/video picker for posting an experience, with preview, title, editable date, editable location, visibility, and a share action.",
  },
  {
    date: "June 11, 2026",
    id: "v0.6",
    title: "PWA Chrome Cleanup",
    summary:
      "Removed fake mobile status indicators so the home-screen web app uses the device browser chrome and safe-area spacing.",
  },
  {
    date: "June 11, 2026",
    id: "v0.5",
    title: "Supabase and Deployment Prep",
    summary:
      "Connected Supabase environment variables, added seed-backed queries with local fallback, and prepared Vercel deployment settings.",
  },
  {
    date: "June 11, 2026",
    id: "v0.4",
    title: "Boards Management",
    summary:
      "Added board creation, editing, deleting, and board-detail settings while keeping board data local for Lite testing.",
  },
  {
    date: "June 11, 2026",
    id: "v0.3",
    title: "Explore Sheet and Global Search",
    summary:
      "Added a swipe-up friends feed, global map search suggestions, home/world map state, and empty Explore content when friends have no posts nearby.",
  },
  {
    date: "June 11, 2026",
    id: "v0.2",
    title: "Mapbox Explore",
    summary:
      "Connected Mapbox, centered Hawaii, added custom friend photo markers, and tuned the Explore page toward the provided mobile mockup.",
  },
  {
    date: "June 11, 2026",
    id: "v0.1",
    title: "Lite Prototype Shell",
    summary:
      "Built the first Odyssey Lite mobile prototype with Explore, experience detail, boards, static seed data, and bottom navigation.",
  },
];
