import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  GetPincodeInsightQueryParams,
  GetPincodeInsightResponse,
  SearchPropertiesQueryParams,
  SearchPropertiesResponse,
} from "@workspace/api-zod";

type Listing = {
  id: number;
  address: string;
  pincode: string;
  bhk: number;
  area_sqft: number;
  property_type: string;
  floor: number;
  age_years: number;
  amenities: string[];
  predicted_price: number;
  price_low: number;
  price_high: number;
};

type ParsedRequirement = {
  bhk: number | null;
  budget_lakh: number | null;
  tags: string[];
};

type Random = () => number;

const localityRoots = [
  "Shanti",
  "Ashoka",
  "Green Park",
  "Model",
  "New",
  "Lake View",
  "Sunrise",
  "Silver",
  "Rajendra",
  "Vivek",
];
const localitySuffixes = [
  "Nagar",
  "Colony",
  "Vihar",
  "Enclave",
  "Extension",
  "Township",
  "Gardens",
  "Heights",
  "Residency",
  "Sector",
];
const amenityPool = [
  "Near school",
  "Near hospital",
  "Near metro/transit",
  "Furnished",
  "Ready to move",
  "Near park",
  "Gated community",
  "Parking available",
  "Lift access",
  "Corner plot",
  "24x7 water supply",
  "Power backup",
];
const propertyTypes = ["Apartment", "Apartment", "Independent House", "Villa"];
const keywordTagMap: Record<string, string> = {
  school: "Near school",
  hospital: "Near hospital",
  metro: "Near metro/transit",
  furnished: "Furnished",
  "ready to move": "Ready to move",
  "under construction": "Under construction",
  park: "Near park",
  gated: "Gated community",
  parking: "Parking available",
  lift: "Lift access",
  corner: "Corner plot",
};

function seededRandom(seedText: string): Random {
  const seed = Number.parseInt(
    createHash("sha256").update(seedText).digest("hex").slice(0, 8),
    16,
  );
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(rng: Random, values: T[]): T {
  return values[Math.floor(rng() * values.length)]!;
}

function parseFreeText(text: string): ParsedRequirement {
  const normalized = text.toLowerCase();
  const parsed: ParsedRequirement = {
    bhk: null,
    budget_lakh: null,
    tags: [],
  };

  const bhkMatch = normalized.match(/(\d)\s*-?\s*bhk/);
  if (bhkMatch) parsed.bhk = Number(bhkMatch[1]);

  const lakhMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|l\b)/);
  if (lakhMatch) parsed.budget_lakh = Number(lakhMatch[1]);

  const croreMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(crore|cr\b)/);
  if (croreMatch) parsed.budget_lakh = Number(croreMatch[1]) * 100;

  for (const [keyword, tag] of Object.entries(keywordTagMap)) {
    if (normalized.includes(keyword)) parsed.tags.push(tag);
  }

  return parsed;
}

function predictPrice(
  basePricePerSqft: number,
  area: number,
  floor: number,
  age: number,
  propertyType: string,
  amenities: string[],
  rng: Random,
): [number, number, number] {
  let multiplier = 1;
  if (floor > 0) multiplier += Math.min(floor, 10) * 0.006;
  multiplier -= age * 0.01;
  if (amenities.includes("Gated community")) multiplier += 0.05;
  if (amenities.includes("Near metro/transit")) multiplier += 0.08;
  if (propertyType === "Villa") multiplier += 0.15;
  if (propertyType === "Independent House") multiplier += 0.05;
  multiplier = Math.max(0.65, multiplier);

  const predicted = Math.round((basePricePerSqft * multiplier * area) / 1000) * 1000;
  const spread = Math.round(predicted * (0.05 + rng() * 0.04));
  return [predicted, predicted - spread, predicted + spread];
}

function generateListings(pincode: string, count = 40): Listing[] {
  const rng = seededRandom(pincode);
  const basePricePerSqft = Math.round(2800 + rng() * 6700);
  const listings: Listing[] = [];

  for (let id = 0; id < count; id += 1) {
    const bhk = 1 + Math.floor(rng() * 4);
    const areaBase = { 1: 450, 2: 750, 3: 1100, 4: 1600 }[bhk]!;
    const area = Math.round(areaBase + rng() * areaBase * 0.4);
    const propertyType = pick(rng, propertyTypes);
    const floor = propertyType === "Apartment" ? 1 + Math.floor(rng() * 12) : 0;
    const age = Math.floor(rng() * 15);
    const amenities = [...amenityPool]
      .sort(() => rng() - 0.5)
      .slice(0, 2 + Math.floor(rng() * 4));
    const [predicted, low, high] = predictPrice(
      basePricePerSqft,
      area,
      floor,
      age,
      propertyType,
      amenities,
      rng,
    );

    listings.push({
      id,
      address: `${1 + Math.floor(rng() * 400)}, ${pick(rng, localityRoots)} ${pick(rng, localitySuffixes)}`,
      pincode,
      bhk,
      area_sqft: area,
      property_type: propertyType,
      floor,
      age_years: age,
      amenities,
      predicted_price: predicted,
      price_low: low,
      price_high: high,
    });
  }

  return listings;
}

function scoreListing(
  listing: Listing,
  bhk: number | undefined,
  propertyType: string | undefined,
  budgetMin: number | undefined,
  budgetMax: number | undefined,
  parsed: ParsedRequirement,
): number {
  let score = 0;
  const wantedBhk = bhk ?? parsed.bhk;

  if (wantedBhk) {
    if (wantedBhk >= 4) {
      score += listing.bhk >= 4 ? 30 : listing.bhk === 3 ? 12 : 0;
    } else {
      score +=
        listing.bhk === wantedBhk
          ? 30
          : Math.abs(listing.bhk - wantedBhk) === 1
            ? 12
            : 0;
    }
  } else {
    score += 20;
  }

  score += propertyType
    ? listing.property_type === propertyType
      ? 15
      : 0
    : 10;

  const priceLakh = listing.predicted_price / 100_000;
  const lower = budgetMin ?? (parsed.budget_lakh ? parsed.budget_lakh * 0.75 : undefined);
  const upper = budgetMax ?? (parsed.budget_lakh ? parsed.budget_lakh * 1.15 : undefined);
  if (lower !== undefined && upper !== undefined) {
    if (lower <= priceLakh && priceLakh <= upper) {
      score += 30;
    } else {
      const distance = priceLakh < lower ? lower - priceLakh : priceLakh - upper;
      score += Math.max(0, 30 - distance * 1.5);
    }
  } else {
    score += 22;
  }

  if (parsed.tags.length) {
    const hits = parsed.tags.filter((tag) => listing.amenities.includes(tag)).length;
    score += Math.min(25, (hits / parsed.tags.length) * 25);
  } else {
    score += 18;
  }

  return Math.round((score / 100) * 100);
}

function getInsight(pincode: string) {
  const listings = generateListings(pincode);
  const averagePrice = listings.reduce((sum, listing) => sum + listing.predicted_price, 0) / listings.length;
  const averageArea = listings.reduce((sum, listing) => sum + listing.area_sqft, 0) / listings.length;
  const pricePerSqft = Math.round((averagePrice / averageArea) * 10) / 10;
  const sortedPrices = listings.map((listing) => listing.predicted_price / 100_000).sort((a, b) => a - b);
  const lowCutoff = sortedPrices[Math.floor(sortedPrices.length * 0.33)]!;
  const highCutoff = sortedPrices[Math.floor(sortedPrices.length * 0.66)]!;
  const bands = [
    { label: "Entry", min_lakh: Math.round(sortedPrices[0]! * 10) / 10, max_lakh: Math.round(lowCutoff * 10) / 10 },
    { label: "Mid-market", min_lakh: Math.round(lowCutoff * 10) / 10, max_lakh: Math.round(highCutoff * 10) / 10 },
    { label: "Premium", min_lakh: Math.round(highCutoff * 10) / 10, max_lakh: Math.round(sortedPrices.at(-1)! * 10) / 10 },
  ].map((band) => ({
    ...band,
    count: listings.filter((listing) => {
      const price = listing.predicted_price / 100_000;
      return price >= band.min_lakh && price <= band.max_lakh;
    }).length,
  }));

  return {
    pincode,
    locality: `${pick(seededRandom(`${pincode}:root`), localityRoots)} district`,
    inventory_count: listings.length,
    average_price_lakh: Math.round(averagePrice / 1000) / 100,
    price_per_sqft: Math.round(pricePerSqft),
    confidence: 84 + (Number(pincode.at(-1))! % 10),
    demand_label: Number(pincode.at(-1))! % 3 === 0 ? "High demand" : "Steady demand",
    price_bands: bands,
  };
}

const router: IRouter = Router();

router.get("/search", (req, res) => {
  const parsedQuery = SearchPropertiesQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  const { pincode, free_text, bhk, property_type, budget_min, budget_max, limit } = parsedQuery.data;
  const parsedRequirement = parseFreeText(free_text);
  const listings = generateListings(pincode).map((listing) => ({
    ...listing,
    match_score: scoreListing(listing, bhk, property_type, budget_min, budget_max, parsedRequirement),
  }));
  listings.sort((a, b) => b.match_score - a.match_score);

  res.json(
    SearchPropertiesResponse.parse({
      pincode,
      total_candidates: listings.length,
      results: listings.slice(0, limit),
      parsed_requirement: parsedRequirement,
    }),
  );
});

router.get("/pincode-insight", (req, res) => {
  const parsedQuery = GetPincodeInsightQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }

  res.json(GetPincodeInsightResponse.parse(getInsight(parsedQuery.data.pincode)));
});

export default router;