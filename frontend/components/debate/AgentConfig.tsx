"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiKeysStore } from "@/stores/apiKeys";
import type { AgentConfig as AgentConfigType, Provider } from "@/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Globe } from "lucide-react";

const MODELS_BY_PROVIDER: Record<
  Provider,
  { value: string; label: string }[]
> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
    { value: "claude-haiku-3.5", label: "Claude 3.5 Haiku" },
  ],
};

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

interface AgentConfigProps {
  value: AgentConfigType;
  onChange: (config: AgentConfigType) => void;
  agentLabel: string;
  accentColor?: "blue" | "green";
}

export default function AgentConfig({
  value,
  onChange,
  agentLabel,
  accentColor = "blue",
}: AgentConfigProps) {
  const hasKey = useApiKeysStore((s) => s.hasKey);

  const models = MODELS_BY_PROVIDER[value.provider];
  const missingKey = !hasKey(value.provider);
  const hasTavilyKey = hasKey("tavily");

  const handleProviderChange = (provider: Provider) => {
    const defaultModel = MODELS_BY_PROVIDER[provider][0].value;
    onChange({ ...value, provider, model: defaultModel });
  };

  const borderClass =
    accentColor === "blue" ? "border-blue-200" : "border-emerald-200";
  const headerBgClass =
    accentColor === "blue" ? "bg-blue-50" : "bg-emerald-50";
  const headerTextClass =
    accentColor === "blue" ? "text-blue-700" : "text-emerald-700";

  return (
    <div className={cn("rounded-lg border-2", borderClass)}>
      <div className={cn("px-4 py-3 border-b", headerBgClass, borderClass)}>
        <h3 className={cn("text-sm font-semibold", headerTextClass)}>
          {agentLabel}
        </h3>
      </div>

      <div className="space-y-4 p-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor={`${agentLabel}-name`}>Name</Label>
          <Input
            id={`${agentLabel}-name`}
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g., Pro Regulation"
            maxLength={100}
          />
        </div>

        {/* Provider */}
        <div className="space-y-2">
          <Label htmlFor={`${agentLabel}-provider`}>Provider</Label>
          <Select
            value={value.provider}
            onValueChange={(v) => handleProviderChange(v as Provider)}
          >
            <SelectTrigger id={`${agentLabel}-provider`}>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {missingKey && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              No API key configured for {PROVIDER_LABELS[value.provider]}.
              Please add one in Settings.
            </p>
          )}
        </div>

        {/* Model */}
        <div className="space-y-2">
          <Label htmlFor={`${agentLabel}-model`}>Model</Label>
          <Select
            value={value.model}
            onValueChange={(m) => onChange({ ...value, model: m })}
          >
            <SelectTrigger id={`${agentLabel}-model`}>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Personality */}
        <div className="space-y-2">
          <Label htmlFor={`${agentLabel}-personality`}>Personality</Label>
          <Textarea
            id={`${agentLabel}-personality`}
            value={value.personality}
            onChange={(e) =>
              onChange({ ...value, personality: e.target.value })
            }
            placeholder="e.g., A cautious policy expert who believes in strong governmental oversight of technology"
            maxLength={1000}
            rows={4}
          />
          <p className="text-xs text-muted-foreground text-right">
            {value.personality.length}/1000
          </p>
        </div>

        {/* Web Search */}
        <div className="space-y-2">
          <label
            htmlFor={`${agentLabel}-web-search`}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              !hasTavilyKey && "opacity-60 cursor-not-allowed"
            )}
          >
            <input
              id={`${agentLabel}-web-search`}
              type="checkbox"
              checked={value.web_search_enabled ?? false}
              onChange={(e) =>
                onChange({ ...value, web_search_enabled: e.target.checked })
              }
              disabled={!hasTavilyKey}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Enable Web Search</span>
          </label>
          {!hasTavilyKey && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Add a Tavily API key in Settings to enable web search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
