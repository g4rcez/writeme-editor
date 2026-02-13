import { describe, it, expect, vi } from "vitest";
import { parseReadItLaterHtml } from "./read-it-later-utils";

describe("parseReadItLaterHtml", () => {
  it("should extract the title and content", () => {
    const html = `
      <html>
        <head><title>Test Title</title></head>
        <body>
          <nav>Navigation</nav>
          <article>
            <h1>Main Heading</h1>
            <p>Some content.</p>
          </article>
          <footer>Footer</footer>
          <script>console.log('hi')</script>
        </body>
      </html>
    `;

    const result = parseReadItLaterHtml(html, "https://example.com", "https://mysite.com");
    expect(result.title).toBe("Test Title");
    expect(result.content).toContain("Main Heading");
    expect(result.content).toContain("Some content.");
    expect(result.content).not.toContain("Navigation");
    expect(result.content).not.toContain("Footer");
    expect(result.content).not.toContain("console.log");
  });

  it("should use a fallback title if none is found", () => {
    const html = "<body><article>Content</article></body>";
    const result = parseReadItLaterHtml(html, "https://example.com", "https://mysite.com");
    expect(result.title).toBe("Read It Later Note");
  });

  it("should extract description and favicon", () => {
    const html = `
      <html>
        <head>
          <meta name="description" content="Test Description">
          <link rel="icon" href="/favicon.ico">
        </head>
        <body></body>
      </html>
    `;
    const baseUrl = "https://example.com";
    const result = parseReadItLaterHtml(html, baseUrl);
    expect(result.description).toBe("Test Description");
    expect(result.favicon).toBe("https://example.com/favicon.ico");
  });

  it("should extract og:description if meta description is missing", () => {
    const html = `
      <html>
        <head>
          <meta property="og:description" content="OG Description">
        </head>
        <body></body>
      </html>
    `;
    const result = parseReadItLaterHtml(html, "https://example.com", "https://mysite.com");
    expect(result.description).toBe("OG Description");
  });

  it("should normalize code blocks", () => {
    const html = `
      <html>
        <body>
          <pre class="javascript"><code>console.log('line 1');\nconsole.log('line 2');</code></pre>
          <pre><code>line 1<br>line 2</code></pre>
        </body>
      </html>
    `;
    const result = parseReadItLaterHtml(html, "https://example.com", "https://mysite.com");
    expect(result.content).toContain('class="language-javascript"');
    // Ensure <br> are converted to newlines or preserved in a way TipTap likes?
    // Actually TipTap likes text nodes with newlines inside pre. 
    // If it's <br>, we should probably convert to newline.
  });

  it("should handle mixed case language classes", () => {
    const html = `<html><body><pre class="JavaScript"><code>console.log('hi')</code></pre></body></html>`;
    const result = parseReadItLaterHtml(html, "http://ex.com", "http://ex.com");
    expect(result.content).toContain('language-javascript');
  });

  it("should normalize div and p tags in code blocks", () => {
    const html = `<html><body><pre><div>line 1</div><div>line 2</div><p>line 3</p></pre></body></html>`;
    const result = parseReadItLaterHtml(html, "http://ex.com", "http://ex.com");
    // Expect divs and p tags to be replaced by newlines
    expect(result.content).toContain('line 1\nline 2\nline 3\n');
  });
});
