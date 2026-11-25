import { useState, type SyntheticEvent } from "react";
import { toast } from "sonner";
import type {
  McpAuthMode,
  McpServerInput,
  McpServerUpdateInput,
  McpServerValidateInput,
  McpSourceType,
  RegisteredMcpServer,
} from "@/domain/entities/mcpServer/registeredMcpServer";
import { authModeSwitchWipesStoredCredential } from "@/domain/entities/mcpServer/registeredMcpServer";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/application/components/ui/alert-dialog";
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
  /**
   * Whether the user explicitly crossed the auth-mode boundary during THIS
   * dialog session. The final mode alone cannot express a round trip
   * (`user_token` → `"headers"` → `user_token`): the final state equals the
   * initial one, yet the user DID cross into `user_token`, and the stored
   * static credential must not survive that crossing (M-2).
   */
  const [authModeCrossed, setAuthModeCrossed] = useState(false);
  /**
   * BUG-003: the auth mode picked in the confirm gate — non-null opens the
   * destructive-transition confirm; the switch is applied ONLY on confirm
   * (cancelled switches leave the state untouched).
   */
  const [pendingAuthMode, setPendingAuthMode] = useState<McpAuthMode | null>(null);
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
    setAuthModeCrossed(false);
    setPendingAuthMode(null);
    setValidationMessage(null);
    setValidationError(null);
  }

  /**
   * Applies a picked auth mode (BUG-003 gate: only called directly for
   * non-destructive switches, or after the destructive one was confirmed).
   * Records a crossing whenever the applied mode differs from the one this
   * dialog session opened with — the "did the user cross the auth-mode
   * boundary at any point of THIS session?" gate consumed by
   * {@link buildUpdateInput}.
   */
  function applyAuthMode(next: McpAuthMode) {
    setAuthMode(next);
    if (next !== initialAuthMode) {
      setAuthModeCrossed(true);
    }
    setPendingAuthMode(null);
  }

  /**
   * Select handler: a switch on an EXISTING server whose save would WIPE the
   * stored credential (M-2 boundary crossing — see
   * {@link authModeSwitchWipesStoredCredential}) is gated by a one-line
   * confirm before it is applied (BUG-003): a silent, irreversible credential
   * wipe must not follow a single select change. Create mode has nothing
   * stored — every switch applies immediately (REQ-006).
   */
  function handleAuthModeChange(next: McpAuthMode) {
    if (isEdit && authModeSwitchWipesStoredCredential(initialAuthMode, next)) {
      setPendingAuthMode(next);
      return;
    }
    applyAuthMode(next);
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  /**
   * Full payload for create mode (submit + "Test connection"). In `user_token`
   * mode NO explicit credentials are sent — the backend injects the connected
   * user's token (REQ-004); values typed before switching mode are ignored
   * (the editors are hidden and carry no committed data).
   *
   * The EDIT flow never uses this builder: its update goes through
   * {@link buildUpdateInput} (partial semantics) and its probe through
   * {@link buildValidateInput} (stored-secrets merge, BUG-001).
   */
  function buildInput(): McpServerInput {
    return {
      name: name.trim(),
      url: isOpenapi ? null : url.trim(),
      headers: isUserToken ? {} : headers,
      env: isUserToken || isOpenapi ? {} : env,
      // Create mode always has a resolved ("headers" is the REQ-006 default)
      // or explicitly picked auth_mode.
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
   * - Crossed INTO `user_token` at any point of THIS session (from
   *   `"headers"`, from an UNKNOWN mode, or via a round trip `user_token` →
   *   `"headers"` → `user_token`): an explicit empty `headers` dict REPLACES
   *   the stored dict under the registry merge (an absent key would preserve
   *   it) — the static credential stops being transmitted alongside the
   *   injected Bearer token. The gate is `authModeCrossed` (did the user
   *   cross into `user_token` during THIS edit session?), NOT a
   *   final-vs-initial comparison: a round trip ends on the mode it started
   *   with, and only the crossing proves the stored credential must not
   *   survive.
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
      if (authModeCrossed) {
        // M-2: the user crossed INTO user_token at some point of THIS
        // session (a final-vs-initial comparison cannot see a round trip
        // user_token → "headers" → user_token) — send an EXPLICIT empty dict
        // (an absent key would preserve the stored credential under the
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

  /**
   * Payload for the "Test connection" probe.
   *
   * - Create mode: the FULL candidate, sent as before (REQ-006 — the probe
   *   is a stateless dry run of a fresh candidate, nothing is persisted).
   * - Edit mode: `server_id` identifies the STORED entry and ONLY the
   *   user-visible/changed fields travel (BUG-001) — the backend merges the
   *   stored secrets into the candidate before probing, so the untouched
   *   masked editors are sent as-is-OMITTED (a present-empty dict would
   *   override the merged secrets and re-introduce the false
   *   "unreachable"/401 on stored-credential servers, REQ-016/REQ-018).
   *   An UNKNOWN stored mode is omitted too (M-3): the merged stored mode
   *   reflects the real runtime, while a guessed `"headers"` would mis-probe
   *   a `user_token` server. In `user_token` mode no static headers travel —
   *   the backend injects the connected user's credential at probe time
   *   (REQ-004); values typed before switching mode are ignored (the editors
   *   are hidden and carry no committed data).
   */
  function buildValidateInput(): McpServerValidateInput {
    if (!isEdit || !editServer) {
      return buildInput();
    }
    const input: McpServerValidateInput = {
      server_id: editServer.name,
      name: name.trim(),
      url: isOpenapi ? null : url.trim(),
      source_type: sourceType,
      openapi_url: isOpenapi ? openapiUrl.trim() : null,
    };
    if (authMode !== undefined) {
      input.auth_mode = authMode;
    }
    if (!isUserToken) {
      if (Object.keys(headers).length > 0) {
        input.headers = headers;
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
      const result = await validateServer.mutateAsync(buildValidateInput());
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
                onValueChange={(v) => handleAuthModeChange(v as McpAuthMode)}
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

        {/*
          * BUG-003: the one-line confirm gating a destructive auth-mode switch
          * on an EXISTING server (see {@link handleAuthModeChange}). Same
          * AlertDialog treatment as the API-key revoke confirm
          * (settings/ApiKeysCard.tsx); cancelling leaves the current mode.
          */}
        <AlertDialog
          open={pendingAuthMode !== null}
          onOpenChange={(o) => {
            if (!o) setPendingAuthMode(null);
          }}
        >
          <AlertDialogContent data-od-id="mcp-auth-switch-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Switch authentication mode?</AlertDialogTitle>
              <AlertDialogDescription>
                Switching authentication clears the stored headers/credential of this server. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-od-id="mcp-auth-switch-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="inline-flex h-10 items-center justify-center bg-danger text-fg border border-danger px-4 py-2 font-display uppercase tracking-[0.06em] text-sm hover:bg-danger/90"
                data-od-id="mcp-auth-switch-confirm-action"
                onClick={() => {
                  if (pendingAuthMode !== null) {
                    applyAuthMode(pendingAuthMode);
                  }
                }}
              >
                Switch mode
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

export default CreateMcpServerDialog;
