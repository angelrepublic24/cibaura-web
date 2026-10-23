/**
 * HOW THE RESULTS ARE ORDERED, and what each order is called on screen.
 *
 * The values are the backend's `PublicCarSort` verbatim — they travel in the
 * URL (`?sort=rating_desc`) and straight on to the API, so a label change here
 * never changes what is sent and a value change is a contract change.
 *
 * `price_asc` is the default and is DELIBERATELY not listed as "default" in
 * its own label: it is simply the first option, which is what a renter
 * expects a sort menu to mean.
 */
export const CAR_SORTS = [
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating_desc", label: "Best rated" },
  /**
   * The newest CARS, by model year. Not to be confused with a host who is new
   * to the platform — the card says "No reviews yet" for that, never "New",
   * precisely because the two would sit two lines apart.
   */
  { value: "year_desc", label: "Newest first" },
] as const;

export type CarSort = (typeof CAR_SORTS)[number]["value"];

/** The values only, in the shape `urlEnum` wants (a non-empty tuple). */
export const CAR_SORT_VALUES = CAR_SORTS.map((s) => s.value) as unknown as [
  CarSort,
  ...CarSort[],
];

/**
 * MINIMUM HOST RATING.
 *
 * Whole and half stars only. A free-entry number would let a renter ask for
 * "4.37 stars and up", which no host's average will ever satisfy in a way
 * they could predict, and which reads as a bug when the page comes back
 * empty.
 *
 * `undefined` is "Any" — the backend treats a missing minimum and a `0` the
 * same way, and we send nothing rather than `0` so the URL stays clean.
 */
export const RATING_MINIMUMS = [
  { value: undefined, label: "Any rating" },
  { value: 3, label: "3 stars & up" },
  { value: 4, label: "4 stars & up" },
  { value: 4.5, label: "4.5 stars & up" },
] as const;
