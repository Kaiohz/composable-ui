import { useState } from "react";
import { flushSync } from "react-dom";
import { Cpu, Plus } from "lucide-react";
import AppShell from "@/application/components/layout/AppShell";
import ModelEditorDialog from "@/application/components/model/ModelEditorDialog";
import { Button } from "@/application/components/ui/button";
import { Badge } from "@/application/components/ui/badge";
import {
  RESOURCE_CARD_GRID_CLASS,
  ResourceCard,
  ResourceCardDeleteButton,
  ResourceCardFooter,
} from "@/application/components/ui/resource-card";
import { toast } from "sonner";
import { useModels } from "@/application/hooks/model/useModels";
import { useDeleteModel } from "@/application/hooks/model/useDeleteModel";
import type { ModelConfiguration } from "@/domain/entities/model/modelConfiguration";

const SHORT_ID_LENGTH = 8;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function ModelsPage() {
  const { data: models, isLoading, isError, error, refetch } = useModels();
  const deleteModel = useDeleteModel();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingModel, setEditingModel] = useState<ModelConfiguration | undefined>(undefined);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);

  const items = models ?? [];

  function openEdit(model: ModelConfiguration) {
    setEditorMode("edit");
    setEditingModel(model);
    setEditorOpen(true);
  }

  function handleDelete(model: ModelConfiguration) {
    if (confirmingId !== model.id) {
      setConfirmingId(model.id);
      setDeleteError(null);
      return;
    }
    deleteModel.mutate(model.id, {
      onSuccess: () => {
        toast.success(`Model "${model.name}" deleted`);
        setConfirmingId(null);
      },
      // In-use (409) errors: the page state is kept and the conflict reason
      // surfaces next to the affected card (spec §MDL-004).
      onError: (mutationError) => {
        // Synchronous flush so the conflict feedback is immediate even when
        // the error is delivered outside a React batch.
        flushSync(() => {
          setDeleteError({
            id: model.id,
            message: mutationError.message || "Model is in use by one or more agents",
          });
          setConfirmingId(null);
        });
      },
    });
  }

  return (
    <AppShell>
      <div
        className="models-view flex flex-1 flex-col gap-6 overflow-y-auto bg-bg p-4 md:p-8"
        data-od-id="models-view"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-md font-body text-sm text-muted">
            Reusable model metadata catalog. Models hold provider configuration only — API keys and
            other credentials are never stored here.
          </p>
          <div className="flex items-center gap-3">
            <Badge variant="default" data-od-id="model-count">
              {items.length} model{items.length === 1 ? "" : "s"}
            </Badge>
            <Button
              type="button"
              variant="default"
              data-od-id="model-create"
              onClick={() => {
                setEditorMode("create");
                setEditingModel(undefined);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Model
            </Button>
          </div>
        </div>

        {isLoading && (
          <div
            className="flex items-center justify-center gap-2 p-8"
            aria-busy="true"
            aria-live="polite"
          >
            <span
              className="spin inline-block h-4 w-4 border-2 border-accent border-t-transparent"
              aria-hidden="true"
            />
            <span className="font-mono text-xs text-muted">Loading models…</span>
          </div>
        )}

        {!isLoading && isError && (
          <div
            role="alert"
            data-od-id="models-error"
            className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger/10 p-4"
          >
            <p className="font-mono text-xs text-danger">
              {error instanceof Error ? error.message : "Request failed"}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div
            data-od-id="models-empty"
            className="flex flex-col items-center justify-center gap-4 p-8"
          >
            <p className="font-body text-sm text-muted">
              No models yet. Add a reusable model configuration to select it in agents.
            </p>
            <Button
              type="button"
              variant="secondary"
              data-od-id="model-create-empty"
              onClick={() => {
                setEditorMode("create");
                setEditingModel(undefined);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Model
            </Button>
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className={RESOURCE_CARD_GRID_CLASS} data-od-id="models-list">
            {items.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                confirming={confirmingId === model.id}
                deleteError={deleteError?.id === model.id ? deleteError.message : null}
                onEdit={() => openEdit(model)}
                onConfirmDelete={() => handleDelete(model)}
              />
            ))}
          </div>
        )}
      </div>

      {editorOpen && (
        <ModelEditorDialog
          key={editingModel?.id ?? "create"}
          open
          onOpenChange={setEditorOpen}
          mode={editorMode}
          model={editingModel}
        />
      )}
    </AppShell>
  );
}

interface ModelCardProps {
  readonly model: ModelConfiguration;
  readonly confirming: boolean;
  readonly deleteError: string | null;
  readonly onEdit: () => void;
  readonly onConfirmDelete: () => void;
}

function ModelCard({
  model,
  confirming,
  deleteError,
  onEdit,
  onConfirmDelete,
}: Readonly<ModelCardProps>) {
  return (
    <ResourceCard
      odId="model-card"
      icon={Cpu}
      title={model.name}
      badges={
        // `title` keeps the full (possibly ellipsis-clipped) provider value
        // reachable on hover — same precedent as McpServerCard's URL badge
        // (review J4).
        <Badge
          variant="outline"
          data-od-id="model-provider"
          className="shrink-0 capitalize"
          title={model.provider}
        >
          {model.provider}
        </Badge>
      }
    >
      <div className="space-y-1 font-mono text-xs">
        <p className="break-all">
          <span className="text-muted uppercase tracking-[0.1em]">Provider model</span>{" "}
          <span className="text-fg">{model.provider_model}</span>
        </p>
        <p className="break-all">
          <span className="text-muted uppercase tracking-[0.1em]">Base URL</span>{" "}
          <span className="text-fg">{model.base_url ?? "—"}</span>
        </p>
      </div>
      <p className="font-mono text-xs text-muted">
        updated {formatDate(model.updated_at)} · {model.id.slice(0, SHORT_ID_LENGTH)}
      </p>

      <ResourceCardFooter>
        <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <ResourceCardDeleteButton
          resourceName={model.name}
          confirming={confirming}
          onActivate={onConfirmDelete}
        />
      </ResourceCardFooter>

      {deleteError && (
        <p role="alert" className="font-mono text-xs text-danger" data-od-id="model-delete-error">
          {deleteError}
        </p>
      )}
    </ResourceCard>
  );
}
