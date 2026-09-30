/**
 * Oeffentliche Basis-URL der Seite, an einer Stelle.
 *
 * metadataBase (app/layout.tsx), robots.ts und sitemap.ts brauchen eine
 * absolute URL, sonst werden Relativ-Links wie "og:image" niemals absolut.
 * In der Entwicklung gibt es keine aussagekraeftige Domain, deshalb steht
 * hier localhost – und fuer das Deploy muss NEXT_PUBLIC_SITE_URL gesetzt
 * sein. Bewusst kein Fallback auf einen geratenen Hostnamen wie
 * "lexio.app": eine erfundene Domain ist im schlimmsten Fall eine echte,
 * falsche URL im Netz.
 */
export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";