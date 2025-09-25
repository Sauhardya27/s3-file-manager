"use client";

import React, { useState, useEffect, useRef } from "react";
import { File, Folder, Download, ArrowLeft, Home, Loader2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

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

//   const navigateToFolder = async (folderPath: string) => {
//     const data = await fetchFolderContents(folderPath);
//     if (data) {
//       setCurrentPath(folderPath);
//       setCurrentData(data);
//     }
//   };

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

  const handleDownload = (fileKey: string) => {
    if (onDownload) {
      onDownload(fileKey);
    } else {
      window.open(`/api/download?key=${encodeURIComponent(fileKey)}`, "_blank");
    }
  };

  
  const normalizeFolderPath = (folderPath: string): string => {
    if (!folderPath) return "";
    
    return folderPath.replace(/\/+$/, "") + "/";
  };

  const handleUpload = async (file: File, folderPath: string) => {
    const fileName = file.name;
    
    let normalizedFolderPath = "";
    if (folderPath && folderPath.trim() !== "") {
      normalizedFolderPath = folderPath.replace(/\/+$/, "") + "/";
    }
    
    const fullKey = normalizedFolderPath + fileName;

    console.log("Upload debug:", {
      fileName,
      originalFolderPath: folderPath,
      normalizedFolderPath,
      fullKey
    });

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

      toast("Upload successful", {
        description: `${fileName} has been uploaded successfully.`,
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
        description: "There was an error uploading the file. Please try again.",
      });
    } finally {
      setUploadingFiles((prev) => prev.filter((key) => key !== fullKey));
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

  const renderUploadButton = (folderPath: string, size: "sm" | "xs" = "sm") => {
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
        className="h-8 px-3 text-sm"
      >
        {hasUploadingFiles ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Upload className="w-3 h-3" />
        )}
        <span className="ml-1">Upload</span>
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
                    <div className="flex items-center gap-3">
                      <Folder className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">
                        {getDisplayName(subFolder, folderName)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mr-4">
                      {renderUploadButton(subFolder, "xs")}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="ml-6 border-l border-border pl-4">
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
              className="flex items-center p-3 hover:bg-accent rounded-lg group"
            >
              <File className="w-4 h-4 mr-3 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{displayName}</div>
                <div className="text-xs text-muted-foreground">
                  {formatFileSize(file.Size)} • {formatDate(file.LastModified)}
                </div>
              </div>
              <Button
                size="sm"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => handleDownload(file.Key)}
              >
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
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
      <Card className="shadow-lg">
        <CardContent className="p-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            <span className="text-muted-foreground">Loading files...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <Folder className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold">S3 File Explorer</h2>
              <p className="text-sm text-muted-foreground">
                Browse, upload, and download files
              </p>
            </div>
          </CardTitle>

          <div className="flex gap-2">
            {renderUploadButton(currentPath)}
            {currentPath && (
              <>
                <Button variant="outline" size="sm" onClick={goToRoot}>
                  <Home className="w-4 h-4 mr-1" />
                  Root
                </Button>
                <Button variant="outline" size="sm" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </>
            )}
          </div>
        </div>

        {currentPath && (
          <div className="mt-2 p-2 bg-white/70 rounded">
            <span className="text-sm text-muted-foreground">
              Current: <code>/{currentPath}</code>
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          <div className="p-4">
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
                          <div className="flex items-center gap-3">
                            <Folder className="w-5 h-5 text-blue-500" />
                            <span className="font-medium">
                              {getDisplayName(folder)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mr-4">
                            {renderUploadButton(folder, "xs")}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="ml-6 border-l border-border pl-4">
                        {renderFolderContent(folder)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}

              {currentData.files?.map((file) => (
                <div
                  key={file.Key}
                  className="flex items-center p-3 hover:bg-accent rounded-lg group"
                >
                  <File className="w-5 h-5 mr-3 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {getDisplayName(file.Key)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatFileSize(file.Size)} •{" "}
                      {formatDate(file.LastModified)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => handleDownload(file.Key)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              ))}

              {!currentData.files?.length && !currentData.folders?.length && (
                <div className="text-center py-12 text-muted-foreground">
                  <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No files or folders found</p>
                  <div className="mt-4">{renderUploadButton(currentPath)}</div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default FileExplorer;