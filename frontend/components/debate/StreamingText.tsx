"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

function StreamingTextComponent({ content, isStreaming }: StreamingTextProps) {
  if (isStreaming) {
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{content}</ReactMarkdown>
        <span className="inline-block w-[0.5em] h-[1.1em] align-text-bottom bg-slate-400 animate-cursor-blink" />
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

const StreamingText = memo(StreamingTextComponent);
StreamingText.displayName = "StreamingText";

export default StreamingText;
