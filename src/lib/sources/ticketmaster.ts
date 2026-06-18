// Ticketmaster Discovery API — events near Greenwich (postalCode 06830,
// 10mi radius). Greenwich has no Ticketmaster venues, so every hit is
// out-of-town; the old 25mi radius pulled in Mohegan Sun / far-Stamford shows
// that have zero bearing on Greenwich Ave parking. 10mi keeps only the nearest
// (downtown-Stamford-ish) venues. Will return [] most days.

import type { SpecialEvent } from "@/lib/model/types";
import { fetchWithTimeout } from "@/lib/utils/fetch";

const ENDPOINT = "https://app.ticketmaster.com/discovery/v2/events.json";
const REVALIDATE_SECONDS = 3600;
const DEFAULT_BOOST = 6;

export async function fetchTicketmasterGreenwichEvents(): Promise<SpecialEvent[]> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return [];
  try {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      postalCode: "06830",
      radius: "25",
      unit: "miles",
      startDateTime: now.toISOString().slice(0, 19) + "Z",
      endDateTime: in48h.toISOString().slice(0, 19) + "Z",
      size: "20",
      apikey: key,
    });
    const res = await fetchWithTimeout(`${ENDPOINT}?${params.toString()}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as TmResponse;
    const events = data._embedded?.events ?? [];
    return events.map(tmToSpecial);
  } catch (err) {
    console.warn("[ticketmaster] fetch failed:", err);
    return [];
  }
}

type TmResponse = {
  _embedded?: {
    events?: Array<{
      id: string;
      name?: string;
      url?: string;
      dates?: { start?: { dateTime?: string; localDate?: string } };
    }>;
  };
};

function tmToSpecial(e: NonNullable<NonNullable<TmResponse["_embedded"]>["events"]>[number]): SpecialEvent {
  const startsAt = e.dates?.start?.dateTime ?? new Date().toISOString();
  const date = e.dates?.start?.localDate ?? startsAt.slice(0, 10);
  return {
    date,
    name: e.name ?? "Ticketmaster event",
    demandBoost: DEFAULT_BOOST,
    startsAt,
    source: "ticketmaster",
    url: e.url,
  };
}
