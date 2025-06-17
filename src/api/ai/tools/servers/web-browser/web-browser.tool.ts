import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";
import { WebBrowserImage } from "./web-browser.models.ts";
import { ResourceReference } from "../../../../../models/chat/ResourceReference.ts";
import { ChatToolResult } from "../../../../../models/chat/ChatToolResult.ts";
import { wrapTool } from "../../tooling.ts";
import {CLI} from "../../../../CLI.ts";
import {Tool} from "ai";

/**
 * Fetches the HTML content of a webpage
 */
async function fetchWebpage(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    return response.data;
  } catch (error: any) {
    CLI.error(`Error occurred while fetching webpage ${url}: ` + error.message);
    return `Failed to fetch webpage: ${error.message}`;
  }
}

/**
 * Extracts images from a webpage
 */
async function extractImages(url: string): Promise<WebBrowserImage[]> {
  const html = await fetchWebpage(url);
  const $ = cheerio.load(html);
  const images: WebBrowserImage[] = [];

  $('img').each((_, element) => {
    const src = $(element).attr('src');
    if (src) {
      // Convert relative URLs to absolute URLs
      const absoluteSrc = src.startsWith('http') ? src : new URL(src, url).href;
      
      images.push({
        src: absoluteSrc,
        alt: $(element).attr('alt'),
        width: $(element).attr('width'),
        height: $(element).attr('height')
      });
    }
  });

  return images;
}

/**
 * Extracts the most relevant content from a webpage
 */
async function extractContent(url: string): Promise<string> {
  const html = await fetchWebpage(url);
  const $ = cheerio.load(html);
  
  // Remove script, style, and other non-content elements
  $('script, style, meta, link, noscript, iframe, svg').remove();
  
  // Try to find the main content
  let content = '';
  
  // Look for common content containers
  const contentSelectors = [
    'article', 'main', '.content', '.main-content', '#content', '#main-content',
    '[role="main"]', '.post-content', '.entry-content', '.article-content'
  ];
  
  for (const selector of contentSelectors) {
    if ($(selector).length) {
      content = $(selector).text().trim();
      break;
    }
  }
  
  // If no content found, use the body
  if (!content) {
    content = $('body').text().trim();
  }
  
  // Clean up the content
  content = content
    .replace(/\s+/g, ' ')  // Replace multiple whitespace with a single space
    .replace(/\n+/g, '\n') // Replace multiple newlines with a single newline
    .trim();
  
  return content;
}

/**
 * Tool to extract images from a webpage
 */
async function extractImagesToolCall(input: { url: string }): Promise<ChatToolResult> {
  const images = await extractImages(input.url);
  
  return {
    text: `Found ${images.length} images on the webpage`,
    references: images.map((image, index) => {
      return <ResourceReference>{
        type: "resource-reference",
        name: image.alt || `Image ${index + 1}`,
        link: input.url,
        imageUrl: image.src,
        metadata: {
          width: image.width,
          height: image.height
        }
      };
    }),
  };
}

/**
 * Tool to extract content from a webpage
 */
async function extractContentToolCall(input: any): Promise<ChatToolResult> {
  const content = await extractContent(input.url);
  
  return <ChatToolResult>{
    text: content,
    references: [
      <ResourceReference>{
        type: "resource-reference",
        name: "Webpage Content",
        link: input.url,
        snippet: content.substring(0, 200) + (content.length > 200 ? '...' : '')
      }
    ],
  };
}

const webPageParameters = z.object({
  url: z.string().describe('The URL of the webpage to extract images from'),
});

export function extractImagesFromWebpageTool(userId: string, chatId: string, messageId: string) : Tool<typeof webPageParameters, ChatToolResult> {
  return {
    description: "Extracts images from a webpage. Returns a list of images found on the webpage.",
    parameters: webPageParameters,
    execute: wrapTool("extract-images-from-webpage", extractImagesToolCall, userId, chatId, messageId)
  };
}

const extractContentParameters = z.object({
  url: z.string().describe('The URL of the webpage to extract content from'),
});

export function extractContentFromWebpageTool(userId: string, chatId: string, messageId: string) : Tool<typeof extractContentParameters, ChatToolResult> {
  return {
    type: "function",
    description: "Extracts the most relevant content from a webpage as a single string, without any HTML tags.",
    parameters: extractContentParameters,
    execute: wrapTool("extract-content-from-webpage", extractContentToolCall, userId, chatId, messageId),
  };
}