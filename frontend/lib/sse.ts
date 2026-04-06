import type { SSEEvent, ParseResult } from "@/types";

/**
 * Parses a raw SSE text buffer into structured events.
 *
 * Follows the SSE spec: events are separated by blank lines,
 * with `event:` and `data:` fields on separate lines.
 * Returns any unparsed remainder so the caller can prepend it
 * to the next chunk from the stream.
 */
export function parseSSEEvents(buffer: string): ParseResult {
  const parsed: SSEEvent[] = [];
  const lines = buffer.split("\n");

  let currentEvent = "";
  let currentData = "";
  let lastCompleteEventEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === "") {
      // Empty line = event boundary
      if (currentData) {
        try {
          const data: unknown = JSON.parse(currentData);
          parsed.push({
            event: currentEvent || "message",
            data,
          });
        } catch {
          // Malformed JSON — skip this event
        }
      }
      currentEvent = "";
      currentData = "";
      lastCompleteEventEnd = i;
    } else if (line.startsWith("event:")) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      // Support multi-line data fields by concatenating
      if (currentData) {
        currentData += "\n" + line.slice(5).trim();
      } else {
        currentData = line.slice(5).trim();
      }
    }
    // Ignore comment lines (starting with ':') and unknown fields
  }

  // Build remaining buffer from any incomplete event after the last boundary
  let remaining = "";
  if (lastCompleteEventEnd < lines.length - 1) {
    remaining = lines.slice(lastCompleteEventEnd + 1).join("\n");
  }

  return { parsed, remaining };
}
