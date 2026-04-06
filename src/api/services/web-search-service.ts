// Web Search Service - supports Tavily and Brave Search
// Tavily: https://tavily.com (get API key there)
// Brave: https://brave.com/search/api/

interface SearchResult {
  title: string;
  url: string;
  description: string;
  rawContent?: string; // Full page text for directory scraping
}

export async function searchWeb(query: string, count = 10): Promise<SearchResult[]> {
  // Try Tavily first, then Brave, then fallback
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) return tavilySearch(query, count, tavilyKey);

  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) return braveSearch(query, count, braveKey);

  console.log('[WebSearch] No search API key set (TAVILY_API_KEY or BRAVE_SEARCH_API_KEY)');
  return fallbackResults(query);
}

// Check if a URL looks like a directory/list page worth scraping
function isDirectoryUrl(url: string, title: string): boolean {
  const lower = (url + ' ' + title).toLowerCase();
  return /directory|member|list|certified|chamber|wbenc|bbb\.org|yelp\.com|yellowpages|manta\.com/.test(lower);
}

// Fetch full content of directory pages via Tavily extract
export async function scrapeDirectoryPages(results: SearchResult[], apiKey: string): Promise<SearchResult[]> {
  const directoryResults = results.filter(r => isDirectoryUrl(r.url, r.title) && r.url);
  if (directoryResults.length === 0) return results;

  const urlsToScrape = directoryResults.slice(0, 3).map(r => r.url); // Max 3 pages
  console.log(`[WebSearch] Scraping ${urlsToScrape.length} directory pages for company names...`);

  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        urls: urlsToScrape,
      }),
    });

    if (!res.ok) {
      console.log(`[WebSearch] Tavily extract error: ${res.status}`);
      return results;
    }

    const data = await res.json() as any;
    const extracted = data.results || [];

    // Merge raw content back into matching results
    for (const ext of extracted) {
      const match = results.find(r => r.url === ext.url);
      if (match && ext.raw_content) {
        match.rawContent = ext.raw_content.slice(0, 5000); // Cap at 5k chars
        console.log(`[WebSearch] Extracted ${ext.raw_content.length} chars from ${ext.url}`);
      }
    }
  } catch (err) {
    console.log('[WebSearch] Directory scraping failed:', (err as Error).message);
  }

  return results;
}

async function tavilySearch(query: string, count: number, apiKey: string): Promise<SearchResult[]> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: count,
        search_depth: 'basic',
        include_answer: false,
      }),
    });

    if (!res.ok) {
      console.log(`[WebSearch] Tavily error: ${res.status}`);
      return fallbackResults(query);
    }

    const data = await res.json() as any;
    return (data.results || []).slice(0, count).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      description: r.content || r.description || '',
    }));
  } catch (err) {
    console.log('[WebSearch] Tavily error:', (err as Error).message);
    return fallbackResults(query);
  }
}

async function braveSearch(query: string, count: number, apiKey: string): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({ q: query, count: String(count) });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
    });

    if (!res.ok) {
      console.log(`[WebSearch] Brave error: ${res.status}`);
      return fallbackResults(query);
    }

    const data = await res.json() as any;
    return (data.web?.results || []).slice(0, count).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      description: r.description || '',
    }));
  } catch (err) {
    console.log('[WebSearch] Brave error:', (err as Error).message);
    return fallbackResults(query);
  }
}

function fallbackResults(query: string): SearchResult[] {
  return [{
    title: '[No live search available]',
    url: '',
    description: `Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY in your environment for live web search. Without it, the agent uses its training data instead of live results.`,
  }];
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return 'No search results found.';
  return results.map((r, i) => {
    let entry = `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`;
    if (r.rawContent) {
      entry += `\n   [DIRECTORY PAGE CONTENT - Extract company names from this]:\n   ${r.rawContent.slice(0, 2000)}`;
    }
    return entry;
  }).join('\n\n');
}
