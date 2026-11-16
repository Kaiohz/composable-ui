import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/application/components/ui/dialog";
import { Button } from "@/application/components/ui/button";
import { Input } from "@/application/components/ui/input";
import { Label } from "@/application/components/ui/label";
import { useCreateModel } from "@/application/hooks/model/useCreateModel";
import { useUpdateModel } from "@/application/hooks/model/useUpdateModel";
import type { ModelConfiguration } from "@/domain/entities/model/modelConfiguration";

interface ModelEditorDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: "create" | "edit";
  readonly model?: ModelConfiguration;
}

/**
 * Metadata-only model form (spec §MDL-002): name, provider, provider model
 * identifier and optional base URL. No credential fields or credential
 * management UI of any kind is ever rendered here. The dialog is mounted
 * only while open, so the form state is freshly initialized per session.
 */
export default function ModelEditorDialog({
  open,
  onOpenChange,
  mode,
  model,
}: Readonly<ModelEditorDialogProps>) {
  const createModel = useCreateModel();
  const updateModel = useUpdateModel();
  const [name, setName] = useState(model?.name ?? "");
  const [provider, setProvider] = useState(model?.provider ?? "");
  const [providerModel, setProviderModel] = useState(model?.provider_model ?? "");
  // The existing base URL is preserved on edit; a destructive `null` is only
  // sent when the operator explicitly clears the field (the backend treats
  // PATCH `base_url: null` as "clear it", QA BUG-009).
  const [baseUrl, setBaseUrl] = useState(model?.base_url ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const isPending = mode === "create" ? createModel.isPending : updateModel.isPending;

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation: string[] = [];
    if (!name.trim()) validation.push("Name is required");
    if (!provider.trim()) validation.push("Provider is required");
    if (!providerModel.trim()) validation.push("Provider model identifier is required");
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }
    setErrors([]);
    const baseUrlValue = baseUrl.trim() ? baseUrl.trim() : null;
    if (mode === "create") {
      createModel.mutate(
        {
          name: name.trim(),
          provider: provider.trim(),
          provider_model: providerModel.trim(),
          base_url: baseUrlValue,
        },
        {
          onSuccess: (created) => {
            toast.success(`Model "${created.name}" created`);
            onOpenChange(false);
          },
          onError: (mutationError) => setErrors([mutationError.message]),
        },
      );
    } else if (model) {
      updateModel.mutate(
        {
          id: model.id,
          name: name.trim(),
          provider: provider.trim(),
          provider_model: providerModel.trim(),
          base_url: baseUrlValue,
        },
        {
          onSuccess: (updated) => {
            toast.success(`Model "${updated.name}" updated`);
            onOpenChange(false);
          },
          onError: (mutationError) => setErrors([mutationError.message]),
        },
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-base uppercase tracking-[0.06em]">
            {mode === "create" ? "New Model" : "Edit Model"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted">
            Model metadata only — no API keys or credentials are stored with models. Existing
            runtime credential resolution is unchanged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-od-id="model-editor-form">
          <div>
            <Label htmlFor="model-name" className="mb-2 block text-xs uppercase tracking-[0.1em]">
              Name
            </Label>
            <Input
              id="model-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fast Haiku…"
              autoComplete="off"
            />
          </div>
          <div>
            <Label
              htmlFor="model-provider"
              className="mb-2 block text-xs uppercase tracking-[0.1em]"
            >
              Provider
            </Label>
            <Input
              id="model-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="openai…"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <Label
              htmlFor="model-provider-id"
              className="mb-2 block text-xs uppercase tracking-[0.1em]"
            >
              Provider model
            </Label>
            <Input
              id="model-provider-id"
              value={providerModel}
              onChange={(e) => setProviderModel(e.target.value)}
              placeholder="anthropic/claude-haiku-4.5…"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <Label
              htmlFor="model-base-url"
              className="mb-2 block text-xs uppercase tracking-[0.1em]"
            >
              Base URL
            </Label>
            <Input
              id="model-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1 (optional)…"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {errors.map((message) => (
            <p key={message} role="alert" className="font-mono text-xs text-danger">
              {message}
            </p>
          ))}

          <div className="flex items-center justify-end gap-3 border-t border-border-soft pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {mode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
