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
 * Identity-only model form (model-catalog-settings-only.md §E, UI-001):
 * exactly `Name` and `Provider model`, both required. The provider connection
 * (`provider`, `base_url`, `api_key`) is configured in the user's LLM
 * Settings and is never rendered, collected or sent here. The dialog is
 * mounted only while open, so the form state is freshly initialized per
 * session.
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
  const [providerModel, setProviderModel] = useState(model?.provider_model ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const isPending = mode === "create" ? createModel.isPending : updateModel.isPending;

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation: string[] = [];
    if (!name.trim()) validation.push("Name is required");
    if (!providerModel.trim()) validation.push("Provider model identifier is required");
    if (validation.length > 0) {
      setErrors(validation);
      return;
    }
    setErrors([]);
    // UI-002: only the two contract fields are sent — never `provider` or
    // `base_url`, not even as `null`.
    if (mode === "create") {
      createModel.mutate(
        {
          name: name.trim(),
          provider_model: providerModel.trim(),
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
          provider_model: providerModel.trim(),
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
            Model identity only — no API keys or credentials are stored with models. The provider
            connection comes from your LLM Settings.
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
