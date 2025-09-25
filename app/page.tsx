"use client";

import Navbar from "@/components/navbar";
import FileExplorer from "@/components/FileExplorer";

export default function Home() {
  const handleDownload = async (fileKey: string) => {
    try {
      const response = await fetch(`/api/download?key=${encodeURIComponent(fileKey)}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileKey.split('/').pop() || fileKey;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto p-6">
        <FileExplorer onDownload={handleDownload} />
      </div>
    </div>
  );
}