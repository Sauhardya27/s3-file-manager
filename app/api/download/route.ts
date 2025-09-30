import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY as string,
    secretAccessKey: process.env.AWS_SECRET_KEY as string,
  },
  region: "ap-south-1",
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET as string,
      Key: key,
    });

    const response = await client.send(command);
    const fileName = key.split("/").pop() || "download";

    return new NextResponse(response.Body as any, {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": response.ContentType || "application/octet-stream",
      },
    });
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json({ error: "Failed to get file" }, { status: 500 });
  }
}