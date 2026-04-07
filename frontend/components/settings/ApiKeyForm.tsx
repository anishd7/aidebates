"use client";

import { useState, useCallback } from "react";
import { Key, Trash2, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { saveKey, deleteKey } from "@/lib/api";
import { useApiKeysStore } from "@/stores/apiKeys";
import type { Provider } from "@/types";

const PROVIDER_LABELS: Record<Provider | "tavily", string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  tavily: "Tavily",
};

interface ApiKeyFormProps {
  provider: Provider | "tavily";
}

type FormState = "idle" | "editing" | "saving" | "deleting";
type FeedbackType = "success" | "error";

interface Feedback {
  type: FeedbackType;
  message: string;
}

export default function ApiKeyForm({ provider }: ApiKeyFormProps) {
  const configured = useApiKeysStore((s) => s.configured[provider]);
  const refreshKeys = useApiKeysStore((s) => s.refreshKeys);

  const [formState, setFormState] = useState<FormState>("idle");
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const isConfigured = !!configured;
  const label = PROVIDER_LABELS[provider];

  const handleStartEditing = useCallback(() => {
    setFormState("editing");
    setKeyValue("");
    setShowKey(false);
    setFeedback(null);
    setShowDeleteConfirm(false);
  }, []);

  const handleCancel = useCallback(() => {
    setFormState("idle");
    setKeyValue("");
    setShowKey(false);
    setFeedback(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!keyValue.trim()) {
      setFeedback({ type: "error", message: "Please enter an API key." });
      return;
    }

    setFormState("saving");
    setFeedback(null);

    try {
      await saveKey(provider, keyValue.trim());
      await refreshKeys();
      setFormState("idle");
      setKeyValue("");
      setShowKey(false);
      setFeedback({ type: "success", message: "API key saved successfully." });
    } catch (err) {
      setFormState("editing");
      const message =
        err instanceof Error ? err.message : "Failed to save API key.";
      setFeedback({ type: "error", message });
    }
  }, [keyValue, provider, refreshKeys]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
    setFeedback(null);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    setFormState("deleting");
    setShowDeleteConfirm(false);
    setFeedback(null);

    try {
      await deleteKey(provider);
      await refreshKeys();
      setFormState("idle");
      setFeedback({
        type: "success",
        message: "API key deleted successfully.",
      });
    } catch (err) {
      setFormState("idle");
      const message =
        err instanceof Error ? err.message : "Failed to delete API key.";
      setFeedback({ type: "error", message });
    }
  }, [provider, refreshKeys]);

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== new Date().getFullYear()
          ? "numeric"
          : undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            {label}
          </CardTitle>
          {isConfigured && formState === "idle" ? (
            <Badge
              variant="secondary"
              className="gap-1 bg-green-100 text-green-800"
            >
              <Check className="h-3 w-3" />
              Configured
            </Badge>
          ) : !isConfigured && formState === "idle" ? (
            <Badge variant="outline" className="text-muted-foreground">
              Not configured
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Configured info */}
        {isConfigured && formState === "idle" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">****{configured.key_last_four}</span>
            <span>&middot;</span>
            <span>Updated {formatDate(configured.updated_at)}</span>
          </div>
        )}

        {/* Editing state */}
        {formState === "editing" || formState === "saving" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`api-key-${provider}`}>API Key</Label>
              <div className="relative">
                <Input
                  id={`api-key-${provider}`}
                  type={showKey ? "text" : "password"}
                  placeholder={`Enter your ${label} API key`}
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  disabled={formState === "saving"}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowKey((prev) => !prev)}
                  disabled={formState === "saving"}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={formState === "saving" || !keyValue.trim()}
              >
                {formState === "saving" && (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={formState === "saving"}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {/* Delete confirmation */}
        {showDeleteConfirm && formState === "idle" && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm">
            <p className="mb-2 font-medium text-destructive">
              Are you sure? Active debates using this key will fail.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteConfirm}
              >
                Delete
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons (idle state) */}
        {formState === "idle" && !showDeleteConfirm && (
          <div className="flex gap-2">
            {isConfigured ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartEditing}
                >
                  Update Key
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleStartEditing}>
                Add Key
              </Button>
            )}
          </div>
        )}

        {/* Deleting state */}
        {formState === "deleting" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Deleting...
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <p
            className={`text-sm ${
              feedback.type === "success"
                ? "text-green-600"
                : "text-destructive"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
