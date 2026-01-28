import * as cheerio from 'cheerio';
import type { Skill, SkillResult } from '../types/index.js';

/**
 * Web browsing skills
 */

export const webFetchSkill: Skill = {
  name: 'web_fetch',
  description: 'Fetch content from a URL and return it as readable text. Good for reading web pages, documentation, etc.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch',
      },
      selector: {
        type: 'string',
        description: 'Optional CSS selector to extract specific content (e.g., "article", "main", ".content")',
      },
    },
    required: ['url'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const { url, selector } = params as { url: string; selector?: string };
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SkynetBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      
      const contentType = response.headers.get('content-type') || '';
      
      // Handle JSON responses
      if (contentType.includes('application/json')) {
        const json = await response.json();
        return {
          success: true,
          data: {
            url,
            contentType: 'json',
            content: JSON.stringify(json, null, 2),
          },
        };
      }
      
      // Handle HTML responses
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Remove script, style, nav, footer, header elements
      $('script, style, nav, footer, header, aside, .sidebar, .menu, .navigation').remove();
      
      // Get content
      let content: string;
      if (selector) {
        content = $(selector).text();
      } else {
        // Try common content selectors
        const mainContent = $('article, main, .content, .post, #content, .article-content').first();
        if (mainContent.length) {
          content = mainContent.text();
        } else {
          content = $('body').text();
        }
      }
      
      // Clean up whitespace
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
      
      // Limit content length
      const maxLength = 50000;
      if (content.length > maxLength) {
        content = content.slice(0, maxLength) + '\n\n[Content truncated...]';
      }
      
      return {
        success: true,
        data: {
          url,
          title: $('title').text().trim(),
          contentType: 'html',
          content,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const webSearchSkill: Skill = {
  name: 'web_search',
  description: 'Search the web using DuckDuckGo and return results. Good for finding current information.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      num_results: {
        type: 'number',
        description: 'Number of results to return (default 5, max 10)',
      },
    },
    required: ['query'],
  },
  async execute(params, _context): Promise<SkillResult> {
    const { query, num_results } = params as { query: string; num_results?: number };
    const limit = Math.min(num_results || 5, 10);
    
    try {
      // Use DuckDuckGo HTML search (no API key needed)
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SkynetBot/1.0)',
        },
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `Search failed: HTTP ${response.status}`,
        };
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const results: { title: string; url: string; snippet: string }[] = [];
      
      $('.result').each((i, elem) => {
        if (i >= limit) return;
        
        const $result = $(elem);
        const title = $result.find('.result__title').text().trim();
        const url = $result.find('.result__url').text().trim();
        const snippet = $result.find('.result__snippet').text().trim();
        
        if (title && url) {
          results.push({
            title,
            url: url.startsWith('http') ? url : `https://${url}`,
            snippet,
          });
        }
      });
      
      return {
        success: true,
        data: {
          query,
          results,
          count: results.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

export const webSkills = [webFetchSkill, webSearchSkill];
