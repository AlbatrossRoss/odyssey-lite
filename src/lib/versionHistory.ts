export type VersionHistoryEntry = {
  date: string;
  id: string;
  summary: string;
  title: string;
};

export const versionHistory: VersionHistoryEntry[] = [
  {
    date: "June 17, 2026",
    id: "v7.4",
    title: "Recommendation Detail and Performance Pass",
    summary:
      "Refined recommendation detail pages with moved shared-by controls, follow actions, more-media strips, nested comment replies, and lighter location cards, while improving performance through image compression, lazy media loading, reduced video autoplay, capped post fetches, and new database indexes.",
  },
  {
    date: "June 17, 2026",
    id: "v7.3",
    title: "Boards Redesign and Post Swiping",
    summary:
      "Redesigned Boards with selectable board previews, compact saved-post layouts, board-only maps that fit saved pins, profile board routing, stronger remembered-login behavior, and swipe navigation through post detail pages from Explore, Boards, and Profiles.",
  },
  {
    date: "June 16, 2026",
    id: "v7.2",
    title: "Trip Posting Paused",
    summary:
      "Temporarily hid Trip posting from the visible app while keeping the code in place, removed the profile Trips section, and cleaned up published trip and trip-stop records while recommendation posting stays active.",
  },
  {
    date: "June 16, 2026",
    id: "v7.1",
    title: "Trip Publishing",
    summary:
      "Added the first publish path for Trips, including profile My Trips sections, trip detail pages, Explore placement for trip stops and recommendations, and stop posts that open in the recommendation detail view.",
  },
  {
    date: "June 16, 2026",
    id: "v7.0",
    title: "Create Post Flow Refresh",
    summary:
      "Redesigned Create with a cleaner recommendation form, draggable media thumbnails with cover ordering, generic location autofill, and a full posted confirmation page with detail and share actions.",
  },
  {
    date: "June 16, 2026",
    id: "v6.9",
    title: "Profile Setup Loading Guard",
    summary:
      "Prevented the Profile Setup checklist from flashing during profile loads by waiting for fresh account and profile-post hydration before deciding whether setup is still needed.",
  },
  {
    date: "June 16, 2026",
    id: "v6.8",
    title: "Explore Save and Detail Reliability",
    summary:
      "Fixed expanded Explore card board saves so bookmarks highlight after saving and confirmation banners appear above the recommendations sheet, while improving post-detail media playback, full-size viewing, cached loading, and profile map polish.",
  },
  {
    date: "June 16, 2026",
    id: "v6.7",
    title: "Profile Page Redesign",
    summary:
      "Redesigned Profile with a real travel-map header, username-forward layout, condensed counters, Recently Added and Boards sections, a dedicated My Posts grid, capped account suggestions, and owner-only post deletion from detail pages.",
  },
  {
    date: "June 16, 2026",
    id: "v6.6",
    title: "Longer Video Posts",
    summary:
      "Increased the Create video upload limit from 30 seconds to 1 minute while keeping the same multi-media posting flow and duration validation.",
  },
  {
    date: "June 15, 2026",
    id: "v6.5",
    title: "Recommendation Detail Redesign",
    summary:
      "Redesigned post detail pages with edge-to-edge media, cleaner title and description placement, simpler text-only layouts, a trimmed location/map block, comments-focused content, and a single bottom Save to Board action.",
  },
  {
    date: "June 15, 2026",
    id: "v6.4",
    title: "Branded Loading Screen",
    summary:
      "Added a dedicated Odyssey loading screen with logo and animated status bar while the app restores the saved account session, avoiding the create-account screen flash on launch.",
  },
  {
    date: "June 15, 2026",
    id: "v6.3",
    title: "Notification History and Mentions",
    summary:
      "Changed Explore notifications into a slide-in comment history with unread markers, added mention-based comment notifications, and auto-prefixed comments with the relevant @username for replies.",
  },
  {
    date: "June 15, 2026",
    id: "v6.2",
    title: "Expanded Recommendation Cards",
    summary:
      "Polished expanded Explore recommendation cards with full-width rectangular layouts, stronger media gradients, title and description previews, bookmark-to-latest-board saving, and normalized post date labels.",
  },
  {
    date: "June 15, 2026",
    id: "v6.1",
    title: "Explore Sheet Card Polish",
    summary:
      "Tightened Explore recommendation preview cards, removed card outlines, improved text-only card previews, and made drag snapping return to the middle sheet position.",
  },
  {
    date: "June 15, 2026",
    id: "v6.0",
    title: "Navigation Bar Polish",
    summary:
      "Restyled the bottom nav with lighter labels, same-size icons, selected-only circles, removed profile and boards back buttons, and added a Version History back link to Profile.",
  },
  {
    date: "June 15, 2026",
    id: "v5.9",
    title: "Simplified Bottom Navigation",
    summary:
      "Reduced the bottom nav to Explore, Boards, Recommend, and Profile with labels, and moved Version History access into the Profile header.",
  },
  {
    date: "June 15, 2026",
    id: "v5.8",
    title: "Explore Filter Drawer",
    summary:
      "Changed Explore to primary Me/Friends/All tabs with a separate multi-select category filter drawer, and made reset return to the user's current location when available.",
  },
  {
    date: "June 15, 2026",
    id: "v5.7",
    title: "Comment Notifications",
    summary:
      "Moved post comments below the detail-page map and added an Explore notification button for unread comments on the user's posts.",
  },
  {
    date: "June 15, 2026",
    id: "v5.6",
    title: "Public Post Comments",
    summary:
      "Added public comments on post detail pages, including a logged-in comment composer, commenter avatars/usernames, comment timestamps, and a Supabase comments migration.",
  },
  {
    date: "June 15, 2026",
    id: "v5.5",
    title: "Profile Header and Grid Polish",
    summary:
      "Refined account headers with larger profile photos, current city display, cleaner clickable stats, and improved travel-grid previews for text-only and media recommendations.",
  },
  {
    date: "June 15, 2026",
    id: "v5.4",
    title: "Profile Setup Checklist",
    summary:
      "Added a profile setup checklist with guided profile photo, local city, follow suggestions, and conversational local recommendation prompts that can create tagged first posts for the map.",
  },
  {
    date: "June 15, 2026",
    id: "v5.3",
    title: "Explore Category Filters",
    summary:
      "Added Mine, Food & Drink, Experiences, Nature, Stays, and Hidden Gem filters to Explore, connected post tags to map/feed filtering, and added emoji map pins for text-only tagged recommendations.",
  },
  {
    date: "June 15, 2026",
    id: "v5.2",
    title: "Text-Only Recommendations",
    summary:
      "Made media optional in Create, supported text-only recommendation cards across Explore and profiles, kept current-location defaults for posting, and allowed recommendations to publish without photos or videos.",
  },
  {
    date: "June 14, 2026",
    id: "v5.1",
    title: "Posting Location Suggestions",
    summary:
      "Added Mapbox autosuggestions to the Create location field and made video selection more forgiving for mobile camera-roll files by accepting common video extensions and using a sturdier duration check.",
  },
  {
    date: "June 14, 2026",
    id: "v5.0",
    title: "Rich Posting Feedback and Video Media",
    summary:
      "Added post-created and board-save success banners on Explore, multi-media detail previews, owner post deletion from profiles, precise recommendation maps, and 30-second video upload support with autoplaying muted previews across recommendation cards and map pins.",
  },
  {
    date: "June 14, 2026",
    id: "v4.9",
    title: "New Post Controls",
    summary:
      "Removed duplicate Next actions from Create, kept the reliable top-right picker advance and bottom Share action, and retained the automatic photo-picker attempt with a Select fallback for PWA browser limits.",
  },
  {
    date: "June 14, 2026",
    id: "v4.8",
    title: "Create Flow and Feed Safeguard",
    summary:
      "Tightened the New Post camera-roll flow, moved Recommendation into the compact details form, and added a compatibility fallback so recommendations keep loading while media URL database changes roll out.",
  },
  {
    date: "June 14, 2026",
    id: "v4.7",
    title: "Instagram-Style Posting",
    summary:
      "Reworked Create into a light two-step New Post flow with multi-photo camera-roll selection, Recommendation and Description fields, metadata-backed date/location, and storage-backed media URLs that preserve uploaded photo data.",
  },
  {
    date: "June 14, 2026",
    id: "v4.6",
    title: "Explore Feed Recovery",
    summary:
      "Moved the main map feed to /explore, preserved the old Hawaii route as a redirect, and switched new post uploads to Supabase Storage URLs so oversized inline image data cannot blank the recommendations feed.",
  },
  {
    date: "June 13, 2026",
    id: "v4.5",
    title: "Manual PWA Layout Tuning",
    summary:
      "Captured the latest manually tuned PWA layout changes for deployment testing on the installed iPhone app.",
  },
  {
    date: "June 13, 2026",
    id: "v4.4",
    title: "iPhone-First PWA Formatting",
    summary:
      "Applied the requested iPhone PWA baseline with black-translucent status bar, #fff8ef theme colors, dynamic viewport surfaces, and safe-area helper classes.",
  },
  {
    date: "June 13, 2026",
    id: "v4.3",
    title: "Baseline PWA Layout",
    summary:
      "Reset the app shell to a conventional iPhone PWA layout with static viewport metadata, dynamic viewport shell height, and safe-area spacing only on inner UI.",
  },
  {
    date: "June 12, 2026",
    id: "v4.2",
    title: "Top Edge Overdraw",
    summary:
      "Extended the fixed mobile shell upward by the iOS top safe-area inset so the installed PWA draws all the way to the top edge again.",
  },
  {
    date: "June 12, 2026",
    id: "v4.1",
    title: "iOS Viewport Recalculation",
    summary:
      "Aligned the PWA viewport meta with the fullscreen iOS guide and added a standalone-mode viewport-fit toggle to force safe-area recalculation on cold start.",
  },
  {
    date: "June 12, 2026",
    id: "v4.0",
    title: "Edge-to-Edge PWA Shell",
    summary:
      "Rebuilt the installed iOS PWA shell around viewport-fit cover, a black-translucent status bar, fixed inset 100vh layout, and inner-only safe-area spacing.",
  },
  {
    date: "June 12, 2026",
    id: "v3.9",
    title: "PWA Cold-Start Height",
    summary:
      "Replaced dynamic viewport shell heights with 100vh and removed the top safe-area stretch experiment to avoid iOS PWA cold-start geometry gaps.",
  },
  {
    date: "June 12, 2026",
    id: "v3.8",
    title: "Top Safe-Area Stretch",
    summary:
      "Pulled the mobile app frame upward by the iOS top safe-area inset so the PWA can fill the status-bar gap without restoring the bottom chin issue.",
  },
  {
    date: "June 12, 2026",
    id: "v3.7",
    title: "Top Safe-Area Background",
    summary:
      "Matched the outer document background to the app shell color so the iOS standalone status-bar area no longer appears as a white top gap.",
  },
  {
    date: "June 12, 2026",
    id: "v3.6",
    title: "Default iOS Status Bar",
    summary:
      "Removed the black-translucent iOS web app status bar setting while keeping standalone display and viewport-fit cover to avoid the reported PWA chin offset bug.",
  },
  {
    date: "June 12, 2026",
    id: "v3.5",
    title: "Capped PWA Chin Inset",
    summary:
      "Capped the iOS bottom safe-area value used by the nav so standalone PWA inset glitches cannot create a large blank shelf under the bottom navigation.",
  },
  {
    date: "June 12, 2026",
    id: "v3.4",
    title: "Safe-Area Padding Cleanup",
    summary:
      "Centralized the iOS bottom safe-area measurement, removed the remaining chin spacer references, and aligned board/save sheets with the same PWA bottom padding model.",
  },
  {
    date: "June 12, 2026",
    id: "v3.3",
    title: "PWA Safe-Area Nav",
    summary:
      "Restored the bottom nav with standard iOS safe-area padding, removed the oversized custom chin spacer, and moved the mobile app shell to dynamic viewport height.",
  },
  {
    date: "June 12, 2026",
    id: "v3.2",
    title: "Explore Grid Sheet",
    summary:
      "Slimmed the recommendation preview cards, tightened the sheet header spacing, and changed the expanded recommendations view into a mixed-size explore grid.",
  },
  {
    date: "June 12, 2026",
    id: "v3.1",
    title: "Board Preview Collages",
    summary:
      "Added bottom navigation to post detail pages, upgraded board cards to Pinterest-style image collages, and adjusted recommendation sheets to clear the PWA bottom nav.",
  },
  {
    date: "June 12, 2026",
    id: "v3.0",
    title: "Cleaner Recommendation Cards",
    summary:
      "Refreshed recommendation imagery with cleaner professional photos, removed captions from content cards, and softened title typography over darker image masks.",
  },
  {
    date: "June 12, 2026",
    id: "v2.9",
    title: "Cleaner Mobile Nav",
    summary:
      "Moved board/save sheets above the PWA chin area and redesigned the bottom nav as icon-only with a centered Create button and account avatar support.",
  },
  {
    date: "June 12, 2026",
    id: "v2.8",
    title: "Account Boards",
    summary:
      "Moved boards to account-specific Supabase storage, removed shared sample boards, and added a clean save flow from post detail pages into existing or newly created boards.",
  },
  {
    date: "June 12, 2026",
    id: "v2.7",
    title: "Image-Forward Rec Cards",
    summary:
      "Restyled recommendation cards to be taller and image-led, with softer photo opacity, darker overlays, and smaller white text for better readability.",
  },
  {
    date: "June 12, 2026",
    id: "v2.6",
    title: "Recommendations Feed Filters",
    summary:
      "Replaced the latest-posts home sheet with a persistent Recommendations feed and made Friends/All filters control both map markers and content cards.",
  },
  {
    date: "June 12, 2026",
    id: "v2.5",
    title: "Cleaner Rec Images and Logout",
    summary:
      "Refreshed the sample rec image sources, cleaned up expanded post cards to avoid awkward image bands, and added a visible Log out action on your account page.",
  },
  {
    date: "June 12, 2026",
    id: "v2.4",
    title: "Map-Driven Explore",
    summary:
      "Made Explore activate from map movement when the visible map area contains posts, and improved bottom-sheet swipe gestures for expanding and collapsing content cards.",
  },
  {
    date: "June 12, 2026",
    id: "v2.3",
    title: "Shared Posts on Map",
    summary:
      "Added database-backed rec posts as Explore map markers, including the new sample posts, and made post markers open their post detail pages.",
  },
  {
    date: "June 12, 2026",
    id: "v2.2",
    title: "PWA Nav Shift Tuning",
    summary:
      "Reduced the standalone PWA bottom-nav shift so the nav stays pulled toward the bottom edge without sliding under the iPhone chin area.",
  },
  {
    date: "June 12, 2026",
    id: "v2.1",
    title: "PWA Bottom Nav Placement",
    summary:
      "Moved the bottom nav controls into the filled iOS PWA chin area while keeping the Create share bar above the nav so users can navigate away after posting.",
  },
  {
    date: "June 12, 2026",
    id: "v2.0",
    title: "iOS Chin Gap Fill",
    summary:
      "Extended the bottom navigation background below the CSS viewport on mobile so iOS standalone PWAs should no longer show a white chin gap under the nav.",
  },
  {
    date: "June 12, 2026",
    id: "v1.9",
    title: "Viewport-Pinned Bottom Nav",
    summary:
      "Pinned the bottom navigation directly to the phone viewport and made the mobile app shell explicitly full-screen so the nav should fill the bottom edge instead of stopping above it.",
  },
  {
    date: "June 12, 2026",
    id: "v1.8",
    title: "Single Rec Posting Flow",
    summary:
      "Rebuilt Create as a stripped-down recommendation poster: choose one camera-roll item, extract date/location metadata, review/edit title, location, and date, then publish with one plain Share button.",
  },
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
