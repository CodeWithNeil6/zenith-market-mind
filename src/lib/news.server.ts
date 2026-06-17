// Server-only news fetcher. Uses Google News RSS (no API key required).
// Cloudflare Workers compatible — pure fetch + regex parsing, no XML DOM.

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  published_at: string;
  summary: string;
};

const NEWS_QUERIES: Record<string, string> = {
  NIFTY50: '"Nifty 50" OR "Nifty index" India stock market',
  BANKNIFTY: '"Bank Nifty" India banking sector',
  SENSEX: "Sensex BSE India stock market",
  FINNIFTY: '"FinNifty" India financial services index',
  MIDCPNIFTY: '"Nifty Midcap" India midcap stocks',
  NIFTYNXT50: '"Nifty Next 50" India',
};

export const ECONOMIC_QUERIES = [
  "RBI repo rate India monetary policy",
  "India CPI inflation",
  "India GDP growth",
  "FOMC Fed interest rate decision",
  "India IIP industrial production",
  "India trade deficit",
];

function decodeEntities(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function pick(item: string, tag: string): string {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return "";
  let v = m[1].trim();
  const cd = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cd) v = cd[1];
  return decodeEntities(v);
}

function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const re = /<item\b[\s\S]*?<\/item>/gi;
  const matches = xml.match(re) ?? [];
  for (const raw of matches) {
    const title = stripTags(pick(raw, "title"));
    const link = stripTags(pick(raw, "link"));
    const pub = pick(raw, "pubDate");
    const desc = stripTags(pick(raw, "description"));
    const source = stripTags(pick(raw, "source")) || (link.match(/https?:\/\/([^/]+)/)?.[1] ?? "");
    if (!title || !link) continue;
    const d = pub ? new Date(pub) : new Date();
    items.push({
      title,
      url: link,
      source: source.replace(/^www\./, ""),
      published_at: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
      summary: desc.slice(0, 400),
    });
  }
  return items;
}

async function googleNews(query: string, limit = 15): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:7d&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 AI-Algo/1.0" },
  });
  if (!res.ok) throw new Error(`Google News RSS ${res.status}`);
  const xml = await res.text();
  return parseRss(xml).slice(0, limit);
}

export async function fetchIndexNews(marketIndex: string, limit = 15): Promise<NewsItem[]> {
  const q = NEWS_QUERIES[marketIndex] ?? "India stock market";
  return googleNews(q, limit);
}

export async function fetchEconomicNews(limit = 30): Promise<NewsItem[]> {
  const results = await Promise.allSettled(ECONOMIC_QUERIES.map((q) => googleNews(q, 8)));
  const all: NewsItem[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const item of r.value) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      all.push(item);
    }
  }
  return all
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, limit);
}
