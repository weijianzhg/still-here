import StillHere from "@/components/still-here";
import { regionIdFromCountryCode } from "@/lib/geo-region";
import { headers } from "next/headers";

export default async function Home() {
  const h = await headers();
  const country = h.get("x-vercel-ip-country");
  const suggestedRegionId = regionIdFromCountryCode(country) ?? undefined;

  return <StillHere suggestedRegionId={suggestedRegionId} />;
}
