import ApiKeyForm from "@/components/settings/ApiKeyForm";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">API Keys</h2>
        <p className="text-sm text-muted-foreground">
          Manage your API keys for AI model providers. Keys are encrypted at
          rest and never shared.
        </p>
      </div>

      <div className="space-y-4">
        <ApiKeyForm provider="openai" />
        <ApiKeyForm provider="anthropic" />
      </div>
    </div>
  );
}
