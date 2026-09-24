/** Public diagnostic: no credentials or upstream response bodies/errors are exposed. */
export async function probeUpstream(apiUrl: string, siteOrigin: string) {
  try {
    const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/health`, {
      headers: { Origin: siteOrigin },
      signal: AbortSignal.timeout(2000),
      redirect: "error",
      cache: "no-store",
    });
    const corsMatched =
      response.headers.get("access-control-allow-origin") === siteOrigin;
    await response.body?.cancel();
    return {
      ok: response.ok && corsMatched,
      status: response.status,
      corsMatched,
    };
  } catch {
    return { ok: false, status: null, corsMatched: false };
  }
}
