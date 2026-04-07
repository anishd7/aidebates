"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiKeysStore } from "@/stores/apiKeys";
import { useDebateManagerStore } from "@/stores/debateManager";
import { createDebate, getDebate } from "@/lib/api";
import AgentConfig from "./AgentConfig";
import type { AgentConfig as AgentConfigType } from "@/types";
import { Loader2, Swords } from "lucide-react";

const DEFAULT_AGENT_A: AgentConfigType = {
  name: "",
  personality: "",
  provider: "openai",
  model: "gpt-4o",
  web_search_enabled: false,
};

const DEFAULT_AGENT_B: AgentConfigType = {
  name: "",
  personality: "",
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  web_search_enabled: false,
};

interface FormErrors {
  topic?: string;
  agentA?: string;
  agentB?: string;
  maxTurns?: string;
  apiKeys?: string;
  submit?: string;
}

function validateAgent(config: AgentConfigType, label: string): string | undefined {
  if (!config.name.trim()) return `${label} name is required`;
  if (config.name.length > 100) return `${label} name must be 100 characters or less`;
  if (!config.personality.trim()) return `${label} personality is required`;
  if (config.personality.length > 1000) return `${label} personality must be 1000 characters or less`;
  return undefined;
}

export default function CreateDebateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasKey = useApiKeysStore((s) => s.hasKey);
  const startDebate = useDebateManagerStore((s) => s.startDebate);

  const [topic, setTopic] = useState("");
  const [agentA, setAgentA] = useState<AgentConfigType>(DEFAULT_AGENT_A);
  const [agentB, setAgentB] = useState<AgentConfigType>(DEFAULT_AGENT_B);
  const [maxTurns, setMaxTurns] = useState(6);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-populate from a previous debate if ?from=<debateId> is present
  const fromId = searchParams.get("from");
  useEffect(() => {
    if (!fromId) return;
    let cancelled = false;
    getDebate(fromId).then((debate) => {
      if (cancelled) return;
      setTopic(debate.topic);
      setAgentA(debate.agent_a_config);
      setAgentB(debate.agent_b_config);
      setMaxTurns(debate.max_turns);
    }).catch(() => { /* ignore — just use defaults */ });
    return () => { cancelled = true; };
  }, [fromId]);

  function validate(): FormErrors {
    const errs: FormErrors = {};

    if (!topic.trim()) {
      errs.topic = "Topic is required";
    } else if (topic.length > 2000) {
      errs.topic = "Topic must be 2000 characters or less";
    }

    errs.agentA = validateAgent(agentA, "Agent A");
    errs.agentB = validateAgent(agentB, "Agent B");

    if (maxTurns < 2 || maxTurns > 100 || !Number.isInteger(maxTurns)) {
      errs.maxTurns = "Max turns must be a whole number between 2 and 100";
    }

    // Check API keys
    const missingProviders: string[] = [];
    if (!hasKey(agentA.provider)) missingProviders.push(agentA.provider);
    if (!hasKey(agentB.provider) && !missingProviders.includes(agentB.provider)) {
      missingProviders.push(agentB.provider);
    }
    if (missingProviders.length > 0) {
      errs.apiKeys = `Please add your ${missingProviders.join(" and ")} API key${missingProviders.length > 1 ? "s" : ""} in Settings`;
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validate();
    // Filter out undefined values
    const activeErrors = Object.fromEntries(
      Object.entries(validationErrors).filter(([, v]) => v !== undefined),
    ) as FormErrors;

    if (Object.keys(activeErrors).length > 0) {
      setErrors(activeErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const debate = await createDebate({
        topic: topic.trim(),
        agent_a: agentA,
        agent_b: agentB,
        max_turns: maxTurns,
      });

      // Start the debate loop and navigate
      startDebate(debate.id, debate.max_turns);
      router.push(`/debate/${debate.id}`);
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to create debate",
      });
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create New Debate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a topic and two AI agents to debate each other.
        </p>
      </div>

      {/* Topic */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Debate Topic</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="topic" className="sr-only">
              Topic
            </Label>
            <Textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Should artificial intelligence be regulated by governments?"
              maxLength={2000}
              rows={3}
            />
            <div className="flex items-center justify-between">
              {errors.topic ? (
                <p className="text-sm text-destructive">{errors.topic}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-muted-foreground">{topic.length}/2000</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Configs */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <AgentConfig
            value={agentA}
            onChange={setAgentA}
            agentLabel="Agent A"
            accentColor="blue"
          />
          {errors.agentA && (
            <p className="text-sm text-destructive">{errors.agentA}</p>
          )}
        </div>
        <div className="space-y-2">
          <AgentConfig
            value={agentB}
            onChange={setAgentB}
            agentLabel="Agent B"
            accentColor="green"
          />
          {errors.agentB && (
            <p className="text-sm text-destructive">{errors.agentB}</p>
          )}
        </div>
      </div>

      {/* Max Turns */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="max-turns">Max Turns</Label>
            <Input
              id="max-turns"
              type="number"
              value={maxTurns}
              onChange={(e) => setMaxTurns(parseInt(e.target.value, 10) || 0)}
              min={2}
              max={100}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Total number of turns in the debate (2–100)
            </p>
            {errors.maxTurns && (
              <p className="text-sm text-destructive">{errors.maxTurns}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Key Warning */}
      {errors.apiKeys && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">{errors.apiKeys}</p>
        </div>
      )}

      {/* Submit Error */}
      {errors.submit && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{errors.submit}</p>
        </div>
      )}

      {/* Submit */}
      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Debate…
          </>
        ) : (
          <>
            <Swords className="mr-2 h-4 w-4" />
            Start Debate
          </>
        )}
      </Button>
    </form>
  );
}
