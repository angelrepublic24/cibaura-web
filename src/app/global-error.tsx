"use client";

import { useEffect } from "react";
import { captureException } from "@sentry/nextjs";

/** This boundary must work without the root layout, styles or providers. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: "3rem",
          maxWidth: "40rem",
          margin: "auto",
        }}
      >
        <main>
          <h1>Something went wrong</h1>
          <p>
            We could not load this page. Please try again. If the problem
            continues, come back in a few minutes.
          </p>
          <button onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
