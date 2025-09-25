import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { ClerkProvider, SignedOut, SignIn, SignedIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "S3 File Explorer",
  description: "Manage your S3 files with ease",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          />
        </head>
        <body className="antialiased">
          <SignedOut>
            <div className="min-h-screen min-w-screen flex justify-center items-center">
              <SignIn routing="hash" />
            </div>
          </SignedOut>
          <SignedIn>{children}</SignedIn>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
