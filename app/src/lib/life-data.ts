export interface Region {
  id: string;
  name: string;
  lifeExpectancy: number;
  description: string;
}

// Source: World Bank Open Data (2023), see world.md
export const regions: Region[] = [
  { id: "world", name: "World Average", lifeExpectancy: 73, description: "Global average" },
  { id: "north-america", name: "North America", lifeExpectancy: 79, description: "USA, Canada, Mexico" },
  { id: "europe-central-asia", name: "Europe & Central Asia", lifeExpectancy: 78, description: "EU, UK, Russia, Central Asia" },
  { id: "east-asia-pacific", name: "East Asia & Pacific", lifeExpectancy: 77, description: "China, Japan, Korea, SE Asia, Oceania" },
  { id: "latin-america", name: "Latin America & Caribbean", lifeExpectancy: 76, description: "Central & South America, Caribbean" },
  { id: "south-asia", name: "South Asia", lifeExpectancy: 72, description: "India, Pakistan, Bangladesh, Sri Lanka" },
  { id: "mena", name: "Middle East & North Africa", lifeExpectancy: 72, description: "MENA, Afghanistan, Pakistan" },
  { id: "sub-saharan-africa", name: "Sub-Saharan Africa", lifeExpectancy: 62, description: "Africa south of the Sahara" },
  { id: "custom", name: "Custom", lifeExpectancy: 0, description: "Enter your own estimate" },
];

export function getRegionById(id: string): Region | undefined {
  return regions.find((r) => r.id === id);
}
