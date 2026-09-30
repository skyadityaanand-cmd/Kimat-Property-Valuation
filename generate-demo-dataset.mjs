#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultPincodes = ["560038", "411001", "560102"];
const args = process.argv.slice(2);
let outputDir = path.dirname(fileURLToPath(import.meta.url));
const pincodes = [];
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--out") {
    outputDir = path.resolve(args[index + 1] ?? ".");
    index += 1;
  } else {
    pincodes.push(args[index]);
  }
}
const selectedPincodes = pincodes.length ? pincodes : defaultPincodes;
if (selectedPincodes.some((pincode) => !/^\d{6}$/.test(pincode))) {
  console.error("Provide one or more six-digit pincodes.");
  process.exit(1);
}

const localityRoots = ["Shanti", "Ashoka", "Green Park", "Model", "New", "Lake View", "Sunrise", "Silver", "Rajendra", "Vivek"];
const localitySuffixes = ["Nagar", "Colony", "Vihar", "Enclave", "Extension", "Township", "Gardens", "Heights", "Residency", "Sector"];
const amenityPool = [
  "Near school", "Near hospital", "Near metro/transit", "Furnished", "Ready to move", "Near park",
  "Gated community", "Parking available", "Lift access", "Corner plot", "24x7 water supply", "Power backup",
];
const propertyTypes = ["Apartment", "Apartment", "Independent House", "Villa"];

function seededRandom(seedText) {
  const seed = Number.parseInt(createHash("sha256").update(seedText).digest("hex").slice(0, 8), 16);
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick(rng, values) {
  return values[Math.floor(rng() * values.length)];
}

function predictPrice(basePricePerSqft, area, floor, age, propertyType, amenities, rng) {
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

function generateListings(pincode, count = 40) {
  const rng = seededRandom(pincode);
  const basePricePerSqft = Math.round(2800 + rng() * 6700);
  const listings = [];
  for (let id = 0; id < count; id += 1) {
    const bhk = 1 + Math.floor(rng() * 4);
    const areaBase = { 1: 450, 2: 750, 3: 1100, 4: 1600 }[bhk];
    const area = Math.round(areaBase + rng() * areaBase * 0.4);
    const propertyType = pick(rng, propertyTypes);
    const floor = propertyType === "Apartment" ? 1 + Math.floor(rng() * 12) : 0;
    const age = Math.floor(rng() * 15);
    const amenities = [...amenityPool].sort(() => rng() - 0.5).slice(0, 2 + Math.floor(rng() * 4));
    const [predicted, low, high] = predictPrice(basePricePerSqft, area, floor, age, propertyType, amenities, rng);
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

function getInsight(pincode, listings) {
  const averagePrice = listings.reduce((sum, listing) => sum + listing.predicted_price, 0) / listings.length;
  const averageArea = listings.reduce((sum, listing) => sum + listing.area_sqft, 0) / listings.length;
  const sortedPrices = listings.map((listing) => listing.predicted_price / 100_000).sort((a, b) => a - b);
  const lowCutoff = sortedPrices[Math.floor(sortedPrices.length * 0.33)];
  const highCutoff = sortedPrices[Math.floor(sortedPrices.length * 0.66)];
  const bands = [
    { label: "Entry", min_lakh: Math.round(sortedPrices[0] * 10) / 10, max_lakh: Math.round(lowCutoff * 10) / 10 },
    { label: "Mid-market", min_lakh: Math.round(lowCutoff * 10) / 10, max_lakh: Math.round(highCutoff * 10) / 10 },
    { label: "Premium", min_lakh: Math.round(highCutoff * 10) / 10, max_lakh: Math.round(sortedPrices.at(-1) * 10) / 10 },
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
    price_per_sqft: Math.round((averagePrice / averageArea) * 10) / 10,
    confidence: 84 + (Number(pincode.at(-1)) % 10),
    demand_label: Number(pincode.at(-1)) % 3 === 0 ? "High demand" : "Steady demand",
    price_bands: bands,
  };
}

const datasets = selectedPincodes.map((pincode) => {
  const listings = generateListings(pincode);
  return { pincode, listings, insight: getInsight(pincode, listings) };
});
const records = datasets.flatMap((dataset) => dataset.listings);
const bundle = {
  dataset_type: "synthetic_demo_data",
  source: "Deterministic generator mirrored from artifacts/api-server/src/routes/valuation.ts",
  records_per_pincode: 40,
  pincodes: selectedPincodes,
  listings: records,
};
const csvColumns = [
  "id", "address", "pincode", "bhk", "area_sqft", "property_type", "floor", "age_years",
  "amenities", "predicted_price", "price_low", "price_high",
];
const csvCell = (value) => {
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = [csvColumns.join(","), ...records.map((record) => csvColumns.map((key) => csvCell(record[key])).join(","))].join("\n") + "\n";
const insights = {
  dataset_type: "derived_synthetic_demo_insights",
  note: "Calculated from the synthetic listing records in listings.json; not independent market research.",
  pincodes: datasets.map(({ insight }) => insight),
};

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "listings.json"), `${JSON.stringify(bundle, null, 2)}\n`);
await writeFile(path.join(outputDir, "listings.csv"), csv);
await writeFile(path.join(outputDir, "pincode-insights.json"), `${JSON.stringify(insights, null, 2)}\n`);
console.log(`Wrote ${records.length} synthetic listings for ${selectedPincodes.join(", ")} to ${outputDir}`);
