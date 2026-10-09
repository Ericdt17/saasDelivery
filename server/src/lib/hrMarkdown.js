"use strict";

/**
 * Minimal Markdown → HTML renderer for company documents (règlement
 * intérieur). XSS-safe by construction: ALL input is HTML-escaped first,
 * then markdown transforms are applied — raw HTML in the source can never
 * reach the output as markup.
 *
 * Supported syntax (what a structured regulation needs):
 *   # / ## / ### headings · paragraphs · blank-line separation
 *   **bold** · *italic* · - / * bullet lists · 1. ordered lists
 *   --- horizontal rule
 */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/**
 * @param {string} markdown
 * @returns {string} sanitised HTML
 */
function renderMarkdown(markdown) {
  const lines = escapeHtml(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let list = null; // 'ul' | 'ol' | null
  let paragraph = [];

  function closeList() {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  }

  function closeParagraph() {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join("<br/>"))}</p>`);
      paragraph = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      closeParagraph();
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^(---|\*\*\*)$/.test(trimmed)) {
      closeParagraph();
      closeList();
      out.push("<hr/>");
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      closeParagraph();
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${renderInline(bullet[1])}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (ordered) {
      closeParagraph();
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${renderInline(ordered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  closeParagraph();
  closeList();
  return out.join("\n");
}

module.exports = { renderMarkdown };
