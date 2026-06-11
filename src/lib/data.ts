export type User = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
};

export type Trip = {
  id: string;
  userId: string;
  title: string;
  destination: string;
  date: string;
  coverImageUrl: string;
};

export type Experience = {
  id: string;
  slug: string;
  name: string;
  location: string;
  island: string;
  coordinates: [number, number];
  caption: string;
  highlight?: string;
  imageUrl: string;
  userId: string;
  tripId: string;
  alsoExperiencedBy: string[];
};

export type Board = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  coverImageUrl: string;
  experienceSlugs: string[];
};

export type FriendPost = {
  id: string;
  type: "trip" | "experience";
  userId: string;
  title: string;
  destination: string;
  date: string;
  caption: string;
  imageUrl: string;
  coordinates: [number, number];
};

export type PlannedTrip = {
  id: string;
  userId: string;
  destination: string;
  dateRange: string;
  joinedUserIds: string[];
  extraCount: number;
  coordinates: [number, number];
};

export const users: User[] = [
  {
    id: "maya",
    name: "Allison",
    handle: "@maya",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80",
  },
  {
    id: "leo",
    name: "Jake",
    handle: "@leosantos",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80",
  },
  {
    id: "nina",
    name: "Sarah",
    handle: "@nina",
    avatarUrl: "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=160&q=80",
  },
  {
    id: "eli",
    name: "Matt",
    handle: "@elib",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80",
  },
  {
    id: "justin",
    name: "Justin",
    handle: "@justin",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80",
  },
  {
    id: "megan",
    name: "Megan",
    handle: "@megan",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80",
  },
  {
    id: "david",
    name: "David",
    handle: "@david",
    avatarUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=160&q=80",
  },
];

export const trips: Trip[] = [
  {
    id: "maya-hawaii",
    userId: "maya",
    title: "Soft light, big water",
    destination: "Hawaii",
    date: "May 2025",
    coverImageUrl: "https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "leo-maui",
    userId: "leo",
    title: "Maui road notes",
    destination: "Hawaii",
    date: "April 2025",
    coverImageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "nina-kona",
    userId: "nina",
    title: "A week underwater",
    destination: "Hawaii",
    date: "June 2025",
    coverImageUrl: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80",
  },
];

export const experiences: Experience[] = [
  {
    id: "manta",
    slug: "manta-ray-night-dive",
    name: "Manta Ray Night Dive",
    location: "Kailua-Kona, Big Island",
    island: "Big Island",
    coordinates: [-156.0456, 19.639],
    caption: "This was the coolest thing we did in Hawaii. Unreal experience.",
    highlight: "Worth planning the trip around",
    imageUrl: "https://images.unsplash.com/photo-1559825481-12a05cc00344?auto=format&fit=crop&w=900&q=70",
    userId: "maya",
    tripId: "maya-hawaii",
    alsoExperiencedBy: ["maya", "eli"],
  },
  {
    id: "hana",
    slug: "road-to-hana",
    name: "Road to Hana",
    location: "Hana Highway, Maui",
    island: "Maui",
    coordinates: [-156.1677, 20.7984],
    caption: "The drive to Hana is as good as everyone says. So many waterfalls!",
    highlight: "Slow travel day",
    imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=70",
    userId: "leo",
    tripId: "leo-maui",
    alsoExperiencedBy: ["maya"],
  },
  {
    id: "haleakala",
    slug: "haleakala-sunrise",
    name: "Haleakalā Sunrise",
    location: "Haleakalā National Park, Maui",
    island: "Maui",
    coordinates: [-156.2533, 20.7097],
    caption: "Cold, quiet, and completely unreal. Bring coffee for the drive up.",
    highlight: "Book ahead",
    imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=70",
    userId: "nina",
    tripId: "maya-hawaii",
    alsoExperiencedBy: ["leo", "nina"],
  },
  {
    id: "punaluu",
    slug: "punaluu-black-sand-beach",
    name: "Punaluʻu Black Sand Beach",
    location: "Kaʻu, Big Island",
    island: "Big Island",
    coordinates: [-155.5043, 19.1364],
    caption: "My favorite beach on the island. So peaceful in the morning.",
    highlight: "Golden hour",
    imageUrl: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=70",
    userId: "eli",
    tripId: "maya-hawaii",
    alsoExperiencedBy: ["nina"],
  },
  {
    id: "wailea",
    slug: "wailea-beach",
    name: "Wailea Beach",
    location: "Wailea, Maui",
    island: "Maui",
    coordinates: [-156.4417, 20.6893],
    caption: "Local food stop right after the beach. Exactly what we needed.",
    highlight: "Easy beach day",
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=70",
    userId: "maya",
    tripId: "maya-hawaii",
    alsoExperiencedBy: ["leo", "eli"],
  },
];

export const boards: Board[] = [
  {
    id: "hawaii",
    slug: "hawaii-2026",
    title: "Hawaii 2026",
    subtitle: "Ocean days, sunrise hikes, and friend-tested gems",
    coverImageUrl: "https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=1000&q=80",
    experienceSlugs: ["manta-ray-night-dive", "haleakala-sunrise", "wailea-beach"],
  },
  {
    id: "japan",
    slug: "japan",
    title: "Japan",
    subtitle: "Neighborhood walks, ryokans, and late-night noodles",
    coverImageUrl: "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=1000&q=80",
    experienceSlugs: [],
  },
  {
    id: "dive",
    slug: "future-dive-trips",
    title: "Future Dive Trips",
    subtitle: "Warm water saves from people I trust",
    coverImageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1000&q=80",
    experienceSlugs: ["manta-ray-night-dive"],
  },
];

export const friendPosts: FriendPost[] = [
  {
    id: "hawaii-2026-post",
    type: "trip",
    userId: "maya",
    title: "Hawaii 2026",
    destination: "Kona Coast, Hawaii",
    date: "2h ago",
    caption: "Saving every beach and dive note for the next warm-water escape.",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=75",
    coordinates: [-156.0456, 19.639],
  },
  {
    id: "phi-phi",
    type: "experience",
    userId: "leo",
    title: "Phi Phi Islands",
    destination: "Krabi, Thailand",
    date: "5h ago",
    caption: "Longtail boat, clear water, and a swim stop we almost skipped.",
    imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=75",
    coordinates: [98.7784, 7.7407],
  },
  {
    id: "banff-road-trip",
    type: "trip",
    userId: "nina",
    title: "Banff Road Trip",
    destination: "Banff, Canada",
    date: "1d ago",
    caption: "Cold mornings, empty trails, and a lake that looked fake in every photo.",
    imageUrl: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=75",
    coordinates: [-115.5708, 51.1784],
  },
  {
    id: "bali-evening",
    type: "experience",
    userId: "maya",
    title: "Bali East Coast",
    destination: "Uluwatu, Bali",
    date: "2d ago",
    caption: "Sunset dinner after the longest swim of the trip.",
    imageUrl: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=900&q=75",
    coordinates: [115.1889, -8.4095],
  },
  {
    id: "tokyo-evening",
    type: "trip",
    userId: "nina",
    title: "Three nights in Tokyo",
    destination: "Tokyo, Japan",
    date: "3d ago",
    caption: "Saved every tiny coffee shop and somehow still missed half the list.",
    imageUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=900&q=75",
    coordinates: [139.6917, 35.6895],
  },
  {
    id: "lisbon-tiles",
    type: "experience",
    userId: "leo",
    title: "Alfama tile walk",
    destination: "Lisbon, Portugal",
    date: "4d ago",
    caption: "No plan, just hills, viewpoints, and the best tinned fish shop.",
    imageUrl: "https://images.unsplash.com/photo-1501927023255-9063be98970c?auto=format&fit=crop&w=900&q=75",
    coordinates: [-9.1393, 38.7223],
  },
  {
    id: "dolomites-hut",
    type: "trip",
    userId: "maya",
    title: "Dolomites hut weekend",
    destination: "Cortina d'Ampezzo, Italy",
    date: "5d ago",
    caption: "Easy trails, unreal views, and a rifugio dinner I keep thinking about.",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=75",
    coordinates: [12.1357, 46.5405],
  },
  {
    id: "mexico-city-food",
    type: "experience",
    userId: "eli",
    title: "Roma Norte taco crawl",
    destination: "Mexico City, Mexico",
    date: "1w ago",
    caption: "Four stops, one long walk home, completely worth it.",
    imageUrl: "https://images.unsplash.com/photo-1512813195386-6cf811ad3542?auto=format&fit=crop&w=900&q=75",
    coordinates: [-99.1332, 19.4326],
  },
];

export const plannedTrips: PlannedTrip[] = [
  {
    id: "justin-japan",
    userId: "justin",
    destination: "Japan",
    dateRange: "May 10 - May 24, 2026",
    joinedUserIds: ["maya", "nina", "eli"],
    extraCount: 3,
    coordinates: [138.2529, 36.2048],
  },
  {
    id: "megan-italy",
    userId: "megan",
    destination: "Italy",
    dateRange: "Jun 3 - Jun 17, 2026",
    joinedUserIds: ["maya", "nina", "eli"],
    extraCount: 2,
    coordinates: [12.5674, 41.8719],
  },
  {
    id: "david-patagonia",
    userId: "david",
    destination: "Patagonia",
    dateRange: "Aug 12 - Aug 27, 2026",
    joinedUserIds: ["maya", "nina", "eli"],
    extraCount: 4,
    coordinates: [-73.0542, -50.9423],
  },
];

export const getUser = (id: string) => users.find((user) => user.id === id);
export const getTrip = (id: string) => trips.find((trip) => trip.id === id);
export const getExperience = (slug: string) => experiences.find((experience) => experience.slug === slug);
export const getBoard = (slug: string) => boards.find((board) => board.slug === slug);
