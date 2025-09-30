"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  File,
  Folder,
  Download,
  ArrowLeft,
  Home,
  Loader2,
  Upload,
  Trash2,
  MoreVertical,
  FolderOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface S3File {
  Key: string;
  Size: number;
  LastModified: Date;
}

interface S3Response {
  files: S3File[];
  folders: string[];
}

interface FileExplorerProps {
  onDownload?: (fileKey: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onDownload }) => {
  const [currentData, setCurrentData] = useState<S3Response>({
    files: [],
    folders: [],
  });
  const [currentPath, setCurrentPath] = useState<string>("");
  const [folderContents, setFolderContents] = useState<{
    [key: string]: S3Response;
  }>({});
  const [loading, setLoading] = useState(true);
  const [loadingFolders, setLoadingFolders] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [deletingFiles, setDeletingFiles] = useState<string[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  // const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchRootData();
  }, []);

  const fetchRootData = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3000/api/objects");
      if (!response.ok) {
        throw new Error("Failed to fetch root data");
      }
      const data = await response.json();
      setCurrentData(data);
      setFolderContents((prev) => ({ ...prev, "": data }));
    } catch (error) {
      console.error("Error fetching root data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderContents = async (folderName: string) => {
    if (folderContents[folderName]) {
      return folderContents[folderName];
    }

    setLoadingFolders((prev) => [...prev, folderName]);

    try {
      const encodedFolderName = encodeURIComponent(folderName);
      const response = await fetch(
        `http://localhost:3000/api/objects?prefix=${encodedFolderName}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch folder contents");
      }

      const data = await response.json();

      setFolderContents((prev) => ({
        ...prev,
        [folderName]: data,
      }));

      return data;
    } catch (error) {
      console.error("Error fetching folder contents:", error);
      return { files: [], folders: [] };
    } finally {
      setLoadingFolders((prev) => prev.filter((f) => f !== folderName));
    }
  };

  const handleAccordionValueChange = (value: string[]) => {
    value.forEach((folderName) => {
      if (!folderContents[folderName] && !loadingFolders.includes(folderName)) {
        fetchFolderContents(folderName);
      }
    });
  };

  const goBack = () => {
    if (!currentPath) return;

    const parts = currentPath.split("/").filter(Boolean);
    const parentPath = parts.slice(0, -1).join("/");

    if (parentPath === "") {
      setCurrentPath("");
      setCurrentData(folderContents[""]);
    } else {
      const parentData = folderContents[parentPath];
      if (parentData) {
        setCurrentPath(parentPath);
        setCurrentData(parentData);
      }
    }
  };

  const goToRoot = () => {
    setCurrentPath("");
    setCurrentData(folderContents[""]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDisplayName = (
    fullPath: string,
    contextPath: string = currentPath
  ): string => {
    if (contextPath && fullPath.startsWith(contextPath + "/")) {
      const relativePath = fullPath.substring(contextPath.length + 1);
      return relativePath.split("/")[0];
    } else if (
      contextPath &&
      fullPath.startsWith(contextPath) &&
      contextPath !== ""
    ) {
      const relativePath = fullPath.substring(contextPath.length);
      const cleanPath = relativePath.replace(/^\/+/, "");
      return cleanPath.split("/")[0] || cleanPath;
    }

    return fullPath.replace(/\/+$/g, "").split("/").pop() || fullPath;
  };

  const handleDownload = async (fileKey: string) => {
    try {
      const response = await fetch(
        `/api/download?key=${encodeURIComponent(fileKey)}`
      );
      if (!response.ok) throw new Error("Failed to download file");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = fileKey.split("/").pop() || "download";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleUpload = async (file: File, folderPath: string) => {
    const fileName = file.name;

    let normalizedFolderPath = "";
    if (folderPath && folderPath.trim() !== "") {
      normalizedFolderPath = folderPath.replace(/\/+$/, "") + "/";
    }

    const fullKey = normalizedFolderPath + fileName;

    setUploadingFiles((prev) => [...prev, fullKey]);

    try {
      const response = await fetch(
        `http://localhost:3000/api/upload?key=${encodeURIComponent(fullKey)}`
      );

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { url } = await response.json();

      const uploadResponse = await fetch(url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      toast.success("Upload successful", {
        description: <span className="text-gray-900 dark:text-gray-100 font-medium">{`${fileName} has been uploaded successfully.`}</span>,
      });

      if (currentPath === folderPath.replace(/\/+$/, "")) {
        await fetchRootData();
      } else {
        setFolderContents((prev) => {
          const newContents = { ...prev };
          delete newContents[folderPath];
          delete newContents[folderPath.replace(/\/+$/, "")];
          return newContents;
        });
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed", {
        description: <span className="text-gray-900 dark:text-gray-100 font-medium">There was an error uploading the file. Please try again.</span>,
      });
    } finally {
      setUploadingFiles((prev) => prev.filter((key) => key !== fullKey));
    }
  };

  const handleDelete = async (fileKey: string) => {
    setFileToDelete(fileKey);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;

    setDeletingFiles((prev) => [...prev, fileToDelete]);
    setDeleteModalOpen(false);

    try {
      const response = await fetch(
        `/api/delete?key=${encodeURIComponent(fileToDelete)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      toast.success("File deleted", {
        description: <span className="text-gray-900 dark:text-gray-100 font-medium">{`${fileToDelete
          .split("/")
          .pop()} has been deleted successfully.`}</span>,
      });

      const folderPath = fileToDelete.substring(
        0,
        fileToDelete.lastIndexOf("/")
      );
      if (currentPath === folderPath) {
        await fetchRootData();
      } else {
        setFolderContents((prev) => {
          const newContents = { ...prev };
          delete newContents[folderPath];
          delete newContents[folderPath + "/"];
          return newContents;
        });
      }
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Delete failed", {
        description: <span className="text-gray-900 dark:text-gray-100 font-medium">There was an error deleting the file. Please try again.</span>,
      });
    } finally {
      setDeletingFiles((prev) => prev.filter((key) => key !== fileToDelete));
      setFileToDelete(null);
    }
  };

  const triggerFileUpload = (folderPath: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      files.forEach((file) => handleUpload(file, folderPath));
    };
    input.click();
  };

  const renderUploadButton = (folderPath: string, compact: boolean = false) => {
    const normalizedPath = folderPath.replace(/\/+$/, "");
    const hasUploadingFiles = uploadingFiles.some(
      (key) =>
        key.startsWith(normalizedPath + "/") ||
        (normalizedPath === "" && !key.includes("/"))
    );

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          triggerFileUpload(folderPath);
        }}
        disabled={hasUploadingFiles}
        className={compact ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm"}
      >
        {hasUploadingFiles ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Upload className="w-3 h-3" />
        )}
        <span className="ml-1 hidden sm:inline">Upload</span>
      </Button>
    );
  };

  const renderFolderContent = (folderName: string) => {
    const data = folderContents[folderName];
    const isLoading = loadingFolders.includes(folderName);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      );
    }

    if (!data) {
      return null;
    }

    return (
      <div className="space-y-2">
        {data.folders && data.folders.length > 0 && (
          <Accordion
            type="multiple"
            className="w-full"
            onValueChange={handleAccordionValueChange}
          >
            {data.folders.map((subFolder) => (
              <AccordionItem
                key={subFolder}
                value={subFolder}
                className="border-none"
              >
                <AccordionTrigger className="hover:no-underline hover:bg-accent rounded-lg px-3 py-2 group">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="font-medium text-sm sm:text-base truncate">
                        {getDisplayName(subFolder, folderName)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mr-4 flex-shrink-0">
                      {renderUploadButton(subFolder, true)}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="ml-3 sm:ml-6 border-l border-border pl-2 sm:pl-4">
                  {renderFolderContent(subFolder)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {data.files?.map((file) => {
          const displayName = getDisplayName(file.Key, folderName);

          if (!displayName || displayName === folderName.replace(/\/$/, "")) {
            return null;
          }

          return (
            <div
              key={file.Key}
              className="flex items-center justify-between p-3 hover:bg-accent rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate text-sm sm:text-base">
                    {displayName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(file.Size)} •{" "}
                    <span className="hidden sm:inline">
                      {formatDate(file.LastModified)}
                    </span>
                    <span className="sm:hidden">
                      {new Date(file.LastModified).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(file.Key)}
                  disabled={deletingFiles.includes(file.Key)}
                  className="h-8"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(file.Key)}
                  disabled={deletingFiles.includes(file.Key)}
                  className="h-8"
                >
                  {deletingFiles.includes(file.Key) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>


              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  className="sm:hidden flex-shrink-0"
                >
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleDownload(file.Key)}
                    disabled={deletingFiles.includes(file.Key)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(file.Key)}
                    disabled={deletingFiles.includes(file.Key)}
                    className="text-destructive focus:text-destructive"
                  >
                    {deletingFiles.includes(file.Key) ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}

        {!data.files?.length && !data.folders?.length && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            This folder is empty
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="shadow-lg w-full">
        <CardContent className="p-8 sm:p-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            <span className="text-muted-foreground">Loading files...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg w-full">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2 sm:gap-3">
            <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold">S3 File Explorer</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Browse, upload, and download files
              </p>
            </div>
          </CardTitle>

          <div className="flex gap-2 flex-wrap">
            {renderUploadButton(currentPath)}
            {currentPath && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToRoot}
                  className="h-8"
                >
                  <Home className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Root</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goBack}
                  className="h-8"
                >
                  <ArrowLeft className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {currentPath && (
          <div className="mt-2 p-2 bg-white/70 dark:bg-black/20 rounded">
            <span className="text-xs sm:text-sm text-muted-foreground break-all">
              Current: <code>/{currentPath}</code>
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[400px] sm:h-[500px]">
          <div className="p-3 sm:p-4">
            <div className="space-y-2">
              {currentData.folders && currentData.folders.length > 0 && (
                <Accordion
                  type="multiple"
                  className="w-full"
                  onValueChange={handleAccordionValueChange}
                >
                  {currentData.folders.map((folder) => (
                    <AccordionItem
                      key={folder}
                      value={folder}
                      className="border-none"
                    >
                      <AccordionTrigger className="hover:no-underline hover:bg-accent rounded-lg px-3 py-2 group">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                            <span className="font-medium text-sm sm:text-base truncate">
                              {getDisplayName(folder)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mr-4 flex-shrink-0">
                            {renderUploadButton(folder, true)}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="ml-3 sm:ml-6 border-l border-border pl-2 sm:pl-4">
                        {renderFolderContent(folder)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}

              {currentData.files?.map((file) => (
                <div
                  key={file.Key}
                  className="flex items-center justify-between p-3 hover:bg-accent rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <File className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate text-sm sm:text-base">
                        {getDisplayName(file.Key)}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {formatFileSize(file.Size)} •{" "}
                        <span className="hidden sm:inline">
                          {formatDate(file.LastModified)}
                        </span>
                        <span className="sm:hidden">
                          {new Date(file.LastModified).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>


                  <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(file.Key)}
                      disabled={deletingFiles.includes(file.Key)}
                      className="h-8"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(file.Key)}
                      disabled={deletingFiles.includes(file.Key)}
                      className="h-8"
                    >
                      {deletingFiles.includes(file.Key) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>


                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      className="sm:hidden flex-shrink-0"
                    >
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDownload(file.Key)}
                        disabled={deletingFiles.includes(file.Key)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(file.Key)}
                        disabled={deletingFiles.includes(file.Key)}
                        className="text-destructive focus:text-destructive"
                      >
                        {deletingFiles.includes(file.Key) ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {!currentData.files?.length && !currentData.folders?.length && (
                <div className="text-center py-8 sm:py-12 text-muted-foreground">
                  <Folder className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">
                    No files or folders found
                  </p>
                  <div className="mt-4">{renderUploadButton(currentPath)}</div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>

      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {fileToDelete?.split("/").pop()}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="m-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 m-0"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default FileExplorer;