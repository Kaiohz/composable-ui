import { useState, type SyntheticEvent } from "react";
import { toast } from "sonner";
import type {
  McpAuthMode,
  McpServerInput,
  McpServerUpdateInput,
  McpSourceType,
  RegisteredMcpServer,
} from "@/domain/entities/mcpServer/registeredMcpServer";
import { useCreateMcpServer } from "@/application/hooks/mcpServer/useCreateMcpServer";
import { useUpdateMcpServer } from "@/application/hooks/mcpServer/useUpdateMcpServer";
import { useValidateMcpServer } from "@/application/hooks/mcpServer/useValidateMcpServer";
import { extractApiMessage } from "@/infrastructure/api/store/storeApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  STRUCTURED_DIALOG_BODY_CLASS,
  STRUCTURED_DIALOG_CONTENT_CLASS,
} from "@/application/components/ui/dialog";
import { cn } from "@/application/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/application/components/ui/select";
import { Button } from "@/application/components/ui/button";
import { Input } from "@/application/components/ui/input";
import { Label } from "@/application/components/ui/label";
import KeyValueEditor from "@/application/components/agent/KeyValueEditor";

interface CreateMcpServerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly editServer?: RegisteredMcpServer;
  /** Prefills the form in create mode (e.g. a built-in MCP server card). */
  readonly prefill?: Partial<RegisteredMcpServer>;
}

const FORM_ID = "mcp-server-form";

/**
 * Placeholder shown on secret inputs while editing: the backend masks stored
 * values (REQ-018) — leaving them empty preserves the stored secret on save
 * (partial update, REQ-016/REQ-019).
 */
const MASKED_SECRET_PLACEHOLDER = "stored — leave empty to keep";

/**
 * Dialog to create or edit a registered MCP server. The form collects the
 * registry fields and submits via {@link useCreateMcpServer} (create mode) or
 * {@link useUpdateMcpServer} (edit mode, partial-update semantics). A "Test
 * connection" button calls {@link useValidateMcpServer} and surfaces the tool
 * count on success.
 *
 * The "Type" select switches between an `external` remote MCP server
 * (url + headers/env) and an `openapi` spec-mounted server (openapi_url +
 * headers — no env). The "Authentication" select chooses how credentials
 * reach the server (REQ-006): `user_token` lets the backend inject the
 * connected user's token (no secret fields are shown), `headers` (default)
 * exposes the standard headers editor for e.g. `X-API-Key`.
 */
export function CreateMcpServerDialog({
  open,
  onOpenChange,
  editServer,
  prefill,
}: Readonly<CreateMcpServerDialogProps>) {
  const isEdit = Boolean(editServer);
  const base = editServer ?? prefill;
  const [sourceType, setSourceType] = useState<McpSourceType>(base?.source_type ?? "external");
  const [name, setName] = useState(base?.name ?? "");
  const [url, setUrl] = useState(base?.url ?? "");
  const [openapiUrl, setOpenapiUrl] = useState(base?.openapi_url ?? "");
  const [headers, setHeaders] = useState<Record<string, string>>(base?.headers ?? {});
  const [env, setEnv] = useState<Record<string, string>>(base?.env ?? {});
  /**
   * The current auth mode. `undefined` means UNKNOWN: the read projection
   * carries `auth_mode` only once the registry persists it (REQ-004 rollout),
   * so the edit dialog shows a placeholder instead of guessing `"headers"` —
   * a guess would silently downgrade a stored `user_token` server on save.
   * Create mode always resolves: `"headers"` is the REQ-006 default.
   */
  const initialAuthMode: McpAuthMode | undefined = isEdit
    ? editServer?.auth_mode
    : (prefill?.auth_mode ?? "headers");
  const [authMode, setAuthMode] = useState<McpAuthMode | undefined>(initialAuthMode);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const createServer = useCreateMcpServer();
  const updateServer = useUpdateMcpServer();
  const validateServer = useValidateMcpServer();

  const isOpenapi = sourceType === "openapi";
  const isUserToken = authMode === "user_token";
  const submitLabel = isEdit ? "Save" : "Create";

  function resetForm() {
    setSourceType("external");
    setName("");
    setUrl("");
    setOpenapiUrl("");
    setHeaders({});
    setEnv({});
    setAuthMode("headers");
    setValidationMessage(null);
    setValidationError(null);
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  /**
   * Full payload for create / validate. In `user_token` mode NO explicit
   * credentials are sent — the backend injects the connected user's token
   * (REQ-004); values typed before switching mode are ignored (the editors
   * are hidden and carry no committed data).
   */
  function buildInput(): McpServerInput {
    return {
      name: name.trim(),
      url: isOpenapi ? null : url.trim(),
      headers: isUserToken ? {} : headers,
      env: isUserToken || isOpenapi ? {} : env,
      // Create mode always has a resolved mode; the edit-mode Test connection
      // is a server-side dry run (nothing is persisted), so `?? "headers"` is
      // a harmless default when the read projection carried no auth_mode.
      auth_mode: authMode ?? "headers",
      source_type: sourceType,
      openapi_url: isOpenapi ? openapiUrl.trim() : null,
    };
  }

  /**
   * Partial payload for the edit flow (REQ-016): an ABSENT key never reaches
   * the registry, whose `exclude_unset` merge then preserves the stored
   * values. Deliberate exceptions clear the stored static credential when the
   * user crosses the auth-mode boundary (M-2): the credential editors are
   * HIDDEN in `user_token` mode, so the headers state there carries no
   * committed user data.
   *
   * - Switching TO `user_token` (from `"headers"` or from an UNKNOWN mode):
   *   an explicit empty `headers` dict REPLACES the stored dict under the
   *   registry merge (an absent key would preserve it) — the static
   *   credential stops being transmitted alongside the injected Bearer token.
   * - Switching FROM `user_token` to `"headers"` with an untouched editor:
   *   the user_token-era stored credential must not be carried across the
   *   boundary (an explicit empty dict clears it). Unknown → `"headers"`
   *   clears NOTHING: the stored mode and credentials are unknown, and a
   *   guessed wipe could destroy real data — only what the user explicitly
   *   touched changes.
   *
   * `auth_mode` is sent ONLY when known: the registry does not echo the field
   * yet (REQ-004 rollout), and re-sending a guessed `"headers"` on an
   * unrelated edit would silently downgrade a `user_token` server. `env` is
   * deliberately NOT cleared on a mode switch: `headers` is the credential
   * carrier this dialog manages, while `env` stays masked in edit mode and
   * may hold non-credential configuration — wiping it would be silent data
   * loss (create mode still sends `env: {}` in `user_token` mode). The legacy
   * `auth_token` is never part of the payload (REQ-005: the backend forwards
   * the stored token as the Authorization header).
   */
  function buildUpdateInput(): McpServerUpdateInput {
    const input: McpServerUpdateInput = {
      name: name.trim(),
      url: isOpenapi ? null : url.trim(),
      source_type: sourceType,
      openapi_url: isOpenapi ? openapiUrl.trim() : null,
    };
    // M-3: send auth_mode ONLY when known — an unrelated edit of a server
    // whose read projection carries no auth_mode must not silently downgrade
    // it (the absent key preserves the stored mode under the exclude_unset
    // merge).
    if (authMode !== undefined) {
      input.auth_mode = authMode;
    }
    if (isUserToken) {
      if (authMode !== initialAuthMode) {
        // M-2: the user crossed INTO user_token — send an EXPLICIT empty
        // dict (an absent key would preserve the stored credential under the
        // exclude_unset merge) so the static credential stops being sent
        // alongside the injected Bearer token.
        input.headers = {};
      }
    } else {
      if (Object.keys(headers).length > 0) {
        input.headers = headers;
      } else if (initialAuthMode === "user_token") {
        // user_token → "headers" with an untouched editor: nothing valid to
        // carry across the boundary — clear it explicitly.
        input.headers = {};
      }
      if (!isOpenapi && Object.keys(env).length > 0) {
        input.env = env;
      }
    }
    return input;
  }

  async function handleTestConnection() {
    setValidationMessage(null);
    setValidationError(null);
    try {
      const result = await validateServer.mutateAsync(buildInput());
      setValidationMessage(`✓ ${result.tool_count} tools`);
    } catch (error) {
      setValidationError(extractApiMessage(error));
    }
  }

  function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Server name is required");
      return;
    }
    if (isOpenapi) {
      if (!openapiUrl.trim()) {
        toast.error("OpenAPI URL is required");
        return;
      }
    } else if (!url.trim()) {
      toast.error("Server URL is required");
      return;
    }

    const onSuccess = () => {
      toast.success(isEdit ? "Server updated successfully" : "Server created successfully");
      handleClose();
    };
    const onError = (error: unknown) => {
      toast.error(extractApiMessage(error));
    };

    if (isEdit && editServer) {
      updateServer.mutate({ name: editServer.name, input: buildUpdateInput() }, { onSuccess, onError });
    } else {
      createServer.mutate(buildInput(), { onSuccess, onError });
    }
  }

  const isPending = createServer.isPending || updateServer.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent
        className={cn(STRUCTURED_DIALOG_CONTENT_CLASS, "max-w-2xl")}
        data-od-id="create-mcp-server-dialog"
      >
        <div className="shrink-0 border-b border-border bg-surface px-6 pb-4 pt-6 sm:px-8">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="font-display text-lg">
              {isEdit ? "Edit MCP Server" : "Create MCP Server"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted">
              Register a remote MCP server. Secrets are stored encrypted; while editing, leave
              secret fields empty to keep the stored values.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className={STRUCTURED_DIALOG_BODY_CLASS}>
          <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label
                htmlFor="mcp-source-type"
                className="mb-2 block text-xs uppercase tracking-[0.1em]"
              >
                Type
              </Label>
              <Select
                value={sourceType}
                onValueChange={(v) => setSourceType(v as McpSourceType)}
                disabled={isEdit}
              >
                <SelectTrigger id="mcp-source-type" data-od-id="mcp-source-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="external">External</SelectItem>
                  <SelectItem value="openapi">OpenAPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="mcp-name" className="mb-2 block text-xs uppercase tracking-[0.1em]">
                Name
              </Label>
              <Input
                id="mcp-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="weather"
                autoComplete="off"
                spellCheck={false}
                aria-label="Name"
                disabled={isEdit}
              />
            </div>

            {isOpenapi ? (
              <div>
                <Label
                  htmlFor="mcp-openapi-url"
                  className="mb-2 block text-xs uppercase tracking-[0.1em]"
                >
                  OpenAPI URL
                </Label>
                <Input
                  id="mcp-openapi-url"
                  type="url"
                  value={openapiUrl}
                  onChange={(e) => setOpenapiUrl(e.target.value)}
                  placeholder="https://example.com/openapi.json"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="openapi_url"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="mcp-url" className="mb-2 block text-xs uppercase tracking-[0.1em]">
                  URL
                </Label>
                <Input
                  id="mcp-url"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="URL"
                />
              </div>
            )}

            <div>
              <Label
                htmlFor="mcp-auth-mode"
                className="mb-2 block text-xs uppercase tracking-[0.1em]"
              >
                Authentication
              </Label>
              <Select
                value={authMode ?? ""}
                onValueChange={(v) => setAuthMode(v as McpAuthMode)}
              >
                <SelectTrigger id="mcp-auth-mode" data-od-id="mcp-auth-mode">
                  <SelectValue placeholder="Unknown — select a mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user_token">OAuth2 — connected user's token</SelectItem>
                  <SelectItem value="headers">API key — headers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isUserToken && (
              <>
                <KeyValueEditor
                  label="Headers"
                  value={headers}
                  onChange={setHeaders}
                  keyPlaceholder="Header name"
                  valuePlaceholder={isEdit ? MASKED_SECRET_PLACEHOLDER : "Header value"}
                />

                {!isOpenapi && (
                  <KeyValueEditor
                    label="Env"
                    value={env}
                    onChange={setEnv}
                    keyPlaceholder="Variable name"
                    valuePlaceholder={isEdit ? MASKED_SECRET_PLACEHOLDER : "Variable value"}
                  />
                )}
              </>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={validateServer.isPending}
              >
                Test connection
              </Button>
              {validationMessage && (
                <p className="font-mono text-xs text-success" aria-live="polite">
                  {validationMessage}
                </p>
              )}
              {validationError && (
                <p className="font-mono text-xs text-danger" aria-live="assertive">
                  Error: {validationError}
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-border bg-surface px-6 py-4 sm:px-8">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <div className="flex-1" />
          <Button type="submit" form={FORM_ID} disabled={isPending}>
            {isPending ? "Saving…" : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CreateMcpServerDialog;
