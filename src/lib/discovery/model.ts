import zipcodes from "zipcodes";

export const categories = {
  "Custom Homes": "builder-custom-homes-114579",
  Multifamily: "builder-multifamily-114423",
  "Production / Spec Homes": "builder-production-spec-homes-114559",
  "Commercial Construction": "builder-commercial-construction-114580",
  Developer: "developer-114539",
};

export const directory = "https://members.nefba.com/directory/Search/";
export const pinnacle = "https://nefba.com/programs/pinnacle-builder/";
export const evidenceTypes = ["NEFBA", "Builder website", "Builders association", "Business listing", "Permitting", "Authorized research"];
export const states = { new: "New Discoveries", research: "Research Needed", ready: "Ready to Call", crm: "Already in CRM", archived: "Archived" } as const;

export type Fields = Partial<Record<
  "name" | "legalName" | "listing" | "phone" | "email" | "website" | "address" | "city" | "state" | "zip" |
  "contact" | "role" | "scope" | "construction" | "constructionDate" | "onboarding" | "sizeEvidence" |
  "pinnacleEvidence" | "classification" | "classificationEvidence" | "verifiedDomain" | "region" | "geoMethod" |
  "phoneConfirmed", string
>> & { distance?: number };
export type Source = { name: string; url: string; checkedAt: string | null };
export type Observation = { data: Fields; source: Source; category?: string };

const earthMiles = 3958.76;
const toRadians = (degrees: number) => degrees * Math.PI / 180;

export function distanceFromJacksonville(latitude: number, longitude: number) {
  const a = Math.sin(toRadians(latitude - 30.3322) / 2) ** 2 +
    Math.cos(toRadians(30.3322)) * Math.cos(toRadians(latitude)) *
    Math.sin(toRadians(longitude + 81.6557) / 2) ** 2;
  return earthMiles * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function regionalize(data: Fields, radius: number, coordinate?: { latitude: number; longitude: number }) {
  const zip = data.zip?.match(/^\d{5}/)?.[0];
  const point = coordinate ?? (zip ? zipcodes.lookup(zip) : undefined);
  if (point) {
    const distance = distanceFromJacksonville(point.latitude, point.longitude);
    const method = coordinate ? "Sourced coordinates" : "ZIP centroid";
    const region = !coordinate && Math.abs(distance - radius) < 5 ? "uncertain" :
      distance <= radius ? "qualified" : "outside";
    return { ...data, region, distance: Math.round(distance * 10) / 10, geoMethod: method };
  }
  const points = data.city && data.state ? zipcodes.lookupByName(data.city, data.state) : [];
  const distances = points.map((p) => distanceFromJacksonville(p.latitude, p.longitude));
  if (distances.length) {
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    const region = max < radius - 5 ? "qualified" : min > radius + 5 ? "outside" : "uncertain";
    return { ...data, region, distance: Math.round(min), geoMethod: "Nearest listed city ZIP centroid" };
  }
  return { ...data, region: "uncertain" };
}

export function score(data: Fields, now = Date.now()) {
  const age = now - Date.parse(data.constructionDate ?? "");
  const factors = {
    "Regional operations": data.region === "qualified" ? 30 : 0,
    "Small / midsize evidence": data.sizeEvidence ? 10 : 0,
    "Exterior scope evidence": data.scope ? 25 : 0,
    "Construction evidence within 12 months": data.construction && age >= 0 && age <= 365 * 86400000 ? 25 : 0,
    "Confirmed public contact": data.phoneConfirmed === "true" || (data.contact && data.role) ? 10 : 0,
  };
  return { total: Object.values(factors).reduce((a, b) => a + b, 0), factors };
}

export function publicUrl(input: unknown) {
  if (typeof input !== "string") return undefined;
  try {
    const parsed = new URL(input);
    if (/^https?:$/.test(parsed.protocol) && !parsed.username && !parsed.password) return parsed.href;
  } catch { /* Invalid or relative URL */ }
}

const text = (s: unknown, max = 600) => typeof s === "string" && s.trim() ? s.trim().slice(0, max) : undefined;

export function importEvidence(input: unknown, radius: number): Observation[] {
  if (!Array.isArray(input) || !input.length || input.length > 500) throw new Error("Supply 1–500 evidence rows.");
  return input.map((raw, index) => {
    const row = raw as Record<string, unknown>;
    const name = text(row?.name, 250);
    const sourceUrl = publicUrl(row?.sourceUrl);
    const sourceType = text(row?.sourceType);
    const checked = typeof row?.checkedAt === "string" ? Date.parse(row.checkedAt) : NaN;
    if (!name || !sourceUrl || !sourceType || !evidenceTypes.includes(sourceType) ||
        !Number.isFinite(checked) || checked > Date.now() + 60000) {
      throw new Error(`Row ${index + 1} needs a company name, public source URL, supported source type and valid checkedAt date.`);
    }
    const evidence = text(row.classificationEvidence);
    const website = publicUrl(row.website);
    const contact = text(row.contact, 150);
    const role = text(row.role, 150);
    const phone = text(row.phone, 40);
    const email = text(row.email, 250);
    const classification = evidence && ["builder", "developer", "non-builder", "uncertain"].includes(String(row.classification))
      ? String(row.classification) : undefined;
    const coordinates = typeof row.latitude === "number" && typeof row.longitude === "number" &&
      Math.abs(row.latitude) <= 90 && Math.abs(row.longitude) <= 180
      ? { latitude: row.latitude, longitude: row.longitude } : undefined;
    const zip = text(row.zip, 12);
    const city = text(row.city, 100);
    const state = text(row.state, 2)?.toUpperCase();
    const isPinnacle = new URL(sourceUrl).origin === new URL(pinnacle).origin && sourceUrl === pinnacle;
    const data: Fields = {
      name, legalName: text(row.legalName, 250), phone, email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
      website, address: text(row.address), city, state, zip,
      contact: contact && role && row.contactConfirmed === true ? contact : undefined,
      role: contact && role && row.contactConfirmed === true ? role : undefined,
      phoneConfirmed: phone && row.phoneConfirmed === true ? "true" : undefined,
      verifiedDomain: website && row.domainConfirmed === true ? new URL(website).hostname.replace(/^www\./, "") : undefined,
      scope: text(row.scope), construction: text(row.construction),
      constructionDate: text(row.construction) && /^\d{4}-\d{2}-\d{2}$/.test(String(row.constructionDate)) &&
        Number.isFinite(Date.parse(String(row.constructionDate))) ? String(row.constructionDate) : undefined,
      onboarding: publicUrl(row.onboarding), sizeEvidence: text(row.sizeEvidence),
      pinnacleEvidence: sourceType === "NEFBA" && isPinnacle ? text(row.pinnacleEvidence) : undefined,
      classification, classificationEvidence: classification ? evidence : undefined,
    };
    const withRegion = coordinates || zip || (city && state) ? regionalize(data, radius, coordinates) : data;
    return {
      data: withRegion,
      category: text(row.category, 100),
      source: { name: sourceType, url: sourceUrl, checkedAt: new Date(checked).toISOString() },
    };
  });
}
