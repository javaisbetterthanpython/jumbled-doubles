import Head from "next/head";

const SITE = "https://jumbleddoubles.ca";

/** Shared per-page meta: title, description, canonical, and social cards. */
export function Meta({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" />
      <link rel="canonical" href={`${SITE}${path}`} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Jumbled Doubles" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={`${SITE}${path}`} />
      <meta property="og:image" content={`${SITE}/android-chrome-512x512.png`} />
      <meta name="twitter:card" content="summary" />
    </Head>
  );
}
