import { useState, useMemo, useCallback } from "react";
import { FolderPlus, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/application/components/layout/AppShell";
import BreadcrumbBar from "@/application/components/rag/BreadcrumbBar";
import FileList from "@/application/components/rag/FileList";
import UploadButton from "@/application/components/rag/UploadButton";
import RagTabBar from "@/application/components/rag/RagTabBar";
import QueryPanel from "@/application/components/rag/QueryPanel";
import FileContentPanel from "@/application/components/rag/FileContentPanel";
import CreateFolderDialog from "@/application/components/rag/CreateFolderDialog";
import ConfirmDeleteDialog from "@/application/components/rag/ConfirmDeleteDialog";
import SpaceSelector from "@/application/components/shared/SpaceSelector";
import { Button } from "@/application/components/ui/button";
import { useFolders } from "@/application/hooks/rag/useFolders";
import { useFiles } from "@/application/hooks/rag/useFiles";
import { useClassicalIndexFile } from "@/application/hooks/rag/useClassicalIndexFile";
import { useClassicalIndexFolder } from "@/application/hooks/rag/useClassicalIndexFolder";
import { useReadFile } from "@/application/hooks/rag/useReadFile";
import { useCreateFolder } from "@/application/hooks/rag/useCreateFolder";
import { useDeleteFile } from "@/application/hooks/rag/useDeleteFile";
import { useDeleteFolder } from "@/application/hooks/rag/useDeleteFolder";
import { useUploadFiles, extractFilesFromDrop } from "@/application/hooks/rag/useUploadFiles";
import { cn } from "@/application/lib/utils";
import { trimTrailingSlashes } from "@/domain/entities/rag/fileEntry";
import { PERSONAL_SLUG } from "@/domain/entities/space/spaceRecord";

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

function prefixToSegments(prefix: string): string[] {
  const trimmed = trimTrailingSlashes(prefix);
  if (!trimmed) return [];
  return trimmed.split("/");
}

function segmentsToPrefix(segments: string[], upToIndex: number): string {
  if (upToIndex < 0) return "";
  return segments.slice(0, upToIndex + 1).join("/") + "/";
}

/**
 * The scope-relative object path of a listed file (mcp-raganything composes
 * the storage key server-side, REQ-003). The explorer lists NON-recursively
 * under the current in-space prefix, so every returned object (full bucket
 * key) maps to `<in-space prefix>/<basename>` — the shape `delete_file` and
 * `read_file` expect from the client.
 */
function toRelativeObjectPath(inSpacePrefix: string, objectName: string): string {
  const basename = objectName.split("/").at(-1) ?? objectName;
  return `${inSpacePrefix}${basename}`;
}

export default function RagPage() {
  const [activeTab, setActiveTab] = useState<"browse" | "query">("browse");
  // Space scope (REQ-021): `personal` by default, persisted for the page
  // lifetime across tab switches. The selected slug travels to
  // mcp-raganything via `X-Composable-Agent`; the backend composes the
  // storage scope from the authenticated identity, so every path on this page
  // stays RELATIVE to the selected space.
  const [spaceSlug, setSpaceSlug] = useState(PERSONAL_SLUG);
  // In-space navigation prefix (scope-relative, e.g. "" or "zeta-docs/").
  const [currentPrefix, setCurrentPrefix] = useState("");
  // Project-level working directory (scope-relative, e.g. "" or "p1").
  const [workingDir, setWorkingDir] = useState("");

  const [fileContentOpen, setFileContentOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "file" | "folder";
    name: string;
  } | null>(null);

  const classicalIndexFile = useClassicalIndexFile();
  const classicalIndexFolder = useClassicalIndexFolder();
  const readFile = useReadFile(spaceSlug);
  const createFolder = useCreateFolder();
  const deleteFile = useDeleteFile();
  const deleteFolder = useDeleteFolder();
  const uploadFiles = useUploadFiles();
  const [isDragActive, setIsDragActive] = useState(false);

  const segments = useMemo(() => prefixToSegments(currentPrefix), [currentPrefix]);

  const foldersQuery = useFolders(currentPrefix, spaceSlug);
  const filesQuery = useFiles(currentPrefix, false, spaceSlug);

  const workspaceFoldersQuery = useFolders("", spaceSlug);

  const handleSpaceChange = useCallback((slug: string) => {
    setSpaceSlug(slug);
    setCurrentPrefix("");
    // A project chosen in the previous space must not leak into the new one:
    // it would target {user_id}/{new_slug}/{old_project}/ server-side.
    setWorkingDir("");
  }, []);

  const handleUploadComplete = useCallback(() => {
    foldersQuery.refetch();
    filesQuery.refetch();
  }, [foldersQuery, filesQuery]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const items = e.dataTransfer?.items;
      if (!items || items.length === 0) return;

      const files = await extractFilesFromDrop(items);
      if (files.length === 0) return;

      uploadFiles.mutate(
        { prefix: currentPrefix, files, agentSlug: spaceSlug },
        {
          onSuccess: (data) => {
            if (data.kind === "all-ok") {
              toast.success(
                `${data.items.length} file${data.items.length > 1 ? "s" : ""} uploaded successfully`,
              );
            } else {
              toast.warning(`${data.succeeded} uploaded, ${data.failed} failed`);
            }
            handleUploadComplete();
          },
          onError: (error: Error) => {
            toast.error(error.message);
          },
        },
      );
    },
    [currentPrefix, spaceSlug, uploadFiles, handleUploadComplete],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  // Only hide the overlay when leaving the dropzone itself (not its children).
  // currentTarget is the dropzone div, target is the element being exited.
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragActive(false);
    }
  }, []);

  const handleNavigate = (index: number) => {
    if (index < 0) {
      setCurrentPrefix("");
    } else {
      setCurrentPrefix(segmentsToPrefix(segments, index));
    }
  };

  // Listed folder prefixes are already scope-relative (REQ-003).
  const handleFolderClick = (prefix: string) => {
    setCurrentPrefix(prefix);
  };

  const handleFileRead = (objectName: string) => {
    readFile.mutate(toRelativeObjectPath(currentPrefix, objectName));
    setFileContentOpen(true);
  };

  const handleFileIndexClassical = (objectName: string) => {
    classicalIndexFile.mutate({
      fileName: toRelativeObjectPath(currentPrefix, objectName),
      workingDir: workingDir || currentPrefix,
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunkOverlap: DEFAULT_CHUNK_OVERLAP,
      agentSlug: spaceSlug,
    });
  };

  const handleFolderIndexClassical = (prefix: string) => {
    classicalIndexFolder.mutate({
      // Folder prefixes arrive scope-relative (backend relativize_folders), so
      // the backend composes {user_id}/{agent_slug}/{prefix}/ (REQ-006).
      workingDir: prefix,
      recursive: true,
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunkOverlap: DEFAULT_CHUNK_OVERLAP,
      agentSlug: spaceSlug,
    });
  };

  const handleCreateFolder = (name: string) => {
    createFolder.mutate(
      { prefix: currentPrefix + name, agentSlug: spaceSlug },
      {
        onSuccess: () => {
          toast.success("Folder created");
          setCreateFolderOpen(false);
          handleUploadComplete();
        },
        onError: (error: Error) => {
          toast.error(error.message);
        },
      },
    );
  };

  const handleFileDelete = (objectName: string) => {
    setDeleteTarget({ kind: "file", name: objectName });
  };

  const handleFolderDelete = (prefix: string) => {
    setDeleteTarget({ kind: "folder", name: prefix });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const onSuccess = () => {
      toast.success(target.kind === "file" ? "File deleted" : "Folder deleted");
      setDeleteTarget(null);
      handleUploadComplete();
    };
    const onError = (error: Error) => {
      toast.error(error.message);
    };
    if (target.kind === "file") {
      // The object path is scope-relative; working_dir targets the vector
      // cascade at the project namespace the UI indexed into (relative too).
      deleteFile.mutate(
        {
          objectName: toRelativeObjectPath(currentPrefix, target.name),
          workingDir: workingDir || currentPrefix,
          agentSlug: spaceSlug,
        },
        { onSuccess, onError },
      );
    } else {
      // Folder prefixes arrive scope-relative (REQ-003): the backend composes
      // {user_id}/{agent_slug}/{prefix}/ and cascades recursively.
      deleteFolder.mutate({ prefix: target.name, agentSlug: spaceSlug }, { onSuccess, onError });
    }
  };

  const isLoading = foldersQuery.isLoading || filesQuery.isLoading;
  const error = foldersQuery.error || filesQuery.error;

  const folderSuggestions = (workspaceFoldersQuery.data ?? []).map((f) => f.prefix);

  return (
    <AppShell>
      <div data-od-id="rag-view" className="flex-1 overflow-y-auto bg-bg">
        <div className="flex flex-col gap-6 p-4 md:p-8">
          {/* Space selector header bar (REQ-021/REQ-026): above the explorer
              AND above the project-level workspace control of the Query tab. */}
          <SpaceSelector value={spaceSlug} onChange={handleSpaceChange} />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="max-w-md font-body text-sm text-muted">
              Browse and manage your RAG knowledge base.
            </p>
            {activeTab === "browse" && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateFolderOpen(true)}
                  data-od-id="create-folder"
                >
                  <FolderPlus className="h-4 w-4" aria-hidden="true" />
                  New Folder
                </Button>
                <UploadButton
                  prefix={currentPrefix}
                  agentSlug={spaceSlug}
                  onUploadComplete={handleUploadComplete}
                />
              </div>
            )}
          </div>

          <div>
            <RagTabBar activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {activeTab === "browse" && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              className={cn(
                "relative flex flex-col gap-6 rounded-xl border-2 border-dashed p-4 transition-all duration-200",
                isDragActive ? "border-primary bg-primary/10 scale-[1.01]" : "border-transparent",
              )}
            >
              {isDragActive && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 rounded-xl bg-bg/90 backdrop-blur-sm">
                  <UploadCloud
                    className="h-16 w-16 text-primary animate-bounce"
                    aria-hidden="true"
                  />
                  <p className="text-lg font-semibold text-primary">Déposez vos fichiers ici</p>
                  <p className="text-sm text-muted">Les dossiers conservent leur structure</p>
                </div>
              )}

              <BreadcrumbBar segments={segments} onNavigate={handleNavigate} />

              <FileList
                folders={foldersQuery.data ?? []}
                files={filesQuery.data ?? []}
                isLoading={isLoading}
                error={error}
                onFolderClick={handleFolderClick}
                onRetry={() => {
                  foldersQuery.refetch();
                  filesQuery.refetch();
                }}
                onFileRead={handleFileRead}
                onFileIndexClassical={handleFileIndexClassical}
                onFolderIndexClassical={handleFolderIndexClassical}
                onFileDelete={handleFileDelete}
                onFolderDelete={handleFolderDelete}
              />

              {fileContentOpen && readFile.data && (
                <FileContentPanel
                  content={readFile.data.content}
                  metadata={readFile.data.metadata}
                  tables={readFile.data.tables}
                  onClose={() => setFileContentOpen(false)}
                />
              )}

              {!isDragActive && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border-soft py-3 text-xs text-muted">
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  Drag and drop files or folders here
                </div>
              )}
            </div>
          )}

          {activeTab === "query" && (
            <QueryPanel
              workingDir={workingDir}
              onWorkingDirChange={setWorkingDir}
              folders={folderSuggestions}
              agentSlug={spaceSlug}
            />
          )}
        </div>
      </div>

      <CreateFolderDialog
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onCreate={handleCreateFolder}
        isPending={createFolder.isPending}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
        isPending={deleteFile.isPending || deleteFolder.isPending}
      />
    </AppShell>
  );
}
