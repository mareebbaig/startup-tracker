import Parser from "rss-parser";
import type { Article } from "@st/shared";
import { USER_AGENT, type FeedConfig } from "../config/feeds.ts";

const parser = new Parser({
  timeout: 20_000,
  headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
});

function plain(s: string | undefined): string {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchFeed(feed: FeedConfig): Promise<Article[]> {
  const res = await parser.parseURL(feed.url);
  return (res.items ?? [])
    .filter((i) => i.link && i.title)
    .map((i) => ({
      sourceId: feed.id,
      url: i.link!.trim(),
      title: plain(i.title),
      text: plain(i.contentSnippet ?? i.content ?? i.summary).slice(0, 3000),
      publishedAt: i.isoDate ? new Date(i.isoDate) : new Date(),
      sourceCountry: feed.country,
    }));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
