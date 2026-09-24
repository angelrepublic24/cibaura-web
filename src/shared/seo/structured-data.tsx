import type { CarDetail } from "@/shared/types/domain";
import type { AgencyPublicProfile, Review } from "@/features/agencies/api";
import { carGallery } from "@/features/cars/photos";
import { absoluteUrl } from "./metadata";
import { carDescription, carPath, carTitle } from "./public-api";

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function JsonLd({ data }: { data: { [key: string]: JsonValue } }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": absoluteUrl("/#organization"),
        name: "Cibaura",
        url: absoluteUrl("/"),
        logo: absoluteUrl("/brand/isotype.png"),
      }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; path: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: absoluteUrl(item.path),
        })),
      }}
    />
  );
}

function agencySchema(agency: AgencyPublicProfile, reviews: Review[] = []) {
  const url = absoluteUrl(`/agencies/${encodeURIComponent(agency.slug)}`);
  const rated =
    agency.reviewCount > 0 && agency.ratingAvg >= 1 && agency.ratingAvg <= 5;
  const visibleReviews = reviews
    .slice(0, 3)
    .filter((review) => review.comment?.trim());
  return {
    // This describes the public rental storefront, including sole proprietors,
    // not the private identity of its owner. Person does not support aggregateRating.
    "@type": "AutoRental",
    "@id": `${url}#agency`,
    name: agency.name,
    url,
    ...(rated
      ? {
          // The API derives ratingAvg from ratingSum/reviewCount, rounded to one decimal.
          // Never average the current review page or attribute agency reviews to a car.
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: agency.ratingAvg,
            reviewCount: agency.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
          ...(visibleReviews.length
            ? {
                review: visibleReviews.map((review) => ({
                  "@type": "Review",
                  "@id": `${url}#review-${encodeURIComponent(review.id)}`,
                  author: { "@type": "Person", name: review.reviewerName },
                  datePublished: review.createdAt,
                  reviewBody: review.comment ?? "",
                  reviewRating: {
                    "@type": "Rating",
                    ratingValue: review.rating,
                    bestRating: 5,
                    worstRating: 1,
                  },
                })),
              }
            : {}),
        }
      : {}),
  };
}

export function AgencyJsonLd({
  agency,
  reviews,
}: {
  agency: AgencyPublicProfile;
  reviews: Review[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        ...agencySchema(agency, reviews),
      }}
    />
  );
}

export function VehicleJsonLd({
  car,
  agency,
  reviews,
}: {
  car: CarDetail;
  agency: AgencyPublicProfile;
  reviews: Review[];
}) {
  const url = absoluteUrl(carPath(car));
  const images = carGallery(car);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Vehicle",
        "@id": `${url}#vehicle`,
        url,
        name: carTitle(car),
        description: carDescription(car),
        ...(images.length ? { image: images } : {}),
        brand: { "@type": "Brand", name: car.make.name },
        model: car.model.name,
        vehicleModelDate: String(car.year),
        color: car.color,
        vehicleTransmission: car.transmission,
        fuelType: car.fuel,
        vehicleSeatingCapacity: car.seats,
        offers: {
          "@type": "Offer",
          url,
          businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
          ...(car.status === "paused"
            ? { availability: "https://schema.org/OutOfStock" }
            : {}),
          // USD matches the backend pricing contract and the visible daily-rate UI.
          // This is a base daily rate, not a date-specific quote or availability claim.
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: (car.pricePerDayCents / 100).toFixed(2),
            priceCurrency: "USD",
            name: "Base daily rental rate; fees calculated at booking",
            referenceQuantity: {
              "@type": "QuantitativeValue",
              value: 1,
              unitCode: "DAY",
            },
          },
          seller: agencySchema(agency, reviews),
        },
      }}
    />
  );
}
