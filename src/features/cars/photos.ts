/**
 * Car photo fallback.
 *
 * The seed ships cars with `primaryPhoto: null` (and empty `photos[]`), so
 * the UI would otherwise render icon placeholders everywhere. Until agencies
 * upload real photos, we substitute a high-quality, category-appropriate
 * stock image so every car is photo-forward (the car is the hero).
 *
 * The pick is DETERMINISTIC — same car id + category always maps to the same
 * image — so a car looks stable across the grid, the detail page and reloads.
 *
 * These are decorative fallbacks only; they never replace a real uploaded
 * photo when one is present.
 */
import type { Car, CarCategory, CarDetail } from "@/shared/types/domain";

/**
 * Curated Unsplash images per category (source.unsplash-style permalink IDs
 * served from images.unsplash.com). Each entry is a small pool; a stable
 * hash of the car id picks one, so a category shows variety across a grid
 * without any car ever changing which image it owns.
 *
 * `?auto=format&fit=crop&w=...&q=...` keeps payloads light and crisp.
 */
const CARD_PARAMS = "auto=format&fit=crop&w=800&q=70";
const HERO_PARAMS = "auto=format&fit=crop&w=1400&q=75";

const POOLS: Record<CarCategory, string[]> = {
  sedan: [
    "photo-1552519507-da3b142c6e3d", // silver sports sedan
    "photo-1553440569-bcc63803a83d", // parked sedan, warm light
    "photo-1494976388531-d1058494cdd8", // muscle sedan
  ],
  suv: [
    "photo-1519641471654-76ce0107ad1b", // suv on road
    "photo-1533473359331-0135ef1b58bf", // white suv
    "photo-1606664515524-ed2f786a0bd6", // modern suv
  ],
  pickup: [
    "photo-1595758228888-6bd0a76b48c1", // pickup truck
    "photo-1558618666-fcd25c85cd64", // truck front
    "photo-1605893477799-b99e3b8b93fe", // pickup outdoors
  ],
  van: [
    "photo-1600661653561-629509216228", // cargo van
    "photo-1617469767053-d3b523a0b982", // camper van
    "photo-1502877338535-766e1452684a", // van road trip
  ],
  hatchback: [
    "photo-1541443131876-44b03de101c5", // compact hatch
    "photo-1550355291-bbee04a92027", // small car
    "photo-1571607388263-1044f9ea01dd", // city car
  ],
  coupe: [
    "photo-1503376780353-7e6692767b70", // coupe classic
    "photo-1544636331-e26879cd4d9b", // sport coupe
    "photo-1555215695-3004980ad54e", // black coupe
  ],
  convertible: [
    "photo-1502161254066-6c74afbf07aa", // convertible top down
    "photo-1583121274602-3e2820c69888", // roadster
    "photo-1568605117036-5fe5e7bab0b7", // open convertible
  ],
  minivan: [
    "photo-1632245889029-e406faaa34cd", // family minivan
    "photo-1617469767053-d3b523a0b982", // van interior/family
    "photo-1600661653561-629509216228", // people mover
  ],
  luxury: [
    "photo-1503736334956-4c8f8e92946d", // luxury coupe
    "photo-1563720223185-11003d516935", // premium sedan
    "photo-1618843479313-40f8afb4b4d8", // luxury front
  ],
};

/** A tiny deterministic string hash (djb2) → non-negative int. */
function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return h >>> 0;
}

function fallbackId(id: string, category: CarCategory): string {
  const pool = POOLS[category] ?? POOLS.sedan;
  return pool[hash(id) % pool.length];
}

function unsplash(photoId: string, params: string): string {
  return `https://images.unsplash.com/${photoId}?${params}`;
}

/**
 * The primary card photo for a car: its real `primaryPhoto` if present,
 * otherwise a deterministic category fallback.
 */
export function carPhoto(car: Pick<Car, "id" | "category" | "primaryPhoto">): string {
  if (car.primaryPhoto) return car.primaryPhoto;
  return unsplash(fallbackId(car.id, car.category), CARD_PARAMS);
}

/** Large hero variant (higher res) for the detail gallery lead image. */
export function carHeroPhoto(
  car: Pick<Car, "id" | "category" | "primaryPhoto">,
): string {
  if (car.primaryPhoto) return car.primaryPhoto;
  return unsplash(fallbackId(car.id, car.category), HERO_PARAMS);
}

/**
 * The full gallery for a detail page: the real `photos[]` when the agency
 * uploaded any, otherwise a deterministic set of 3 category stock images
 * (starting from the car's own fallback) so the gallery never looks bare.
 */
export function carGallery(car: CarDetail): string[] {
  if (car.photos && car.photos.length > 0) return car.photos;
  const pool = POOLS[car.category] ?? POOLS.sedan;
  const start = hash(car.id) % pool.length;
  const ordered = [
    pool[start],
    pool[(start + 1) % pool.length],
    pool[(start + 2) % pool.length],
  ];
  // De-dupe in case a pool has fewer than 3 unique ids.
  return Array.from(new Set(ordered)).map((pid) => unsplash(pid, HERO_PARAMS));
}
