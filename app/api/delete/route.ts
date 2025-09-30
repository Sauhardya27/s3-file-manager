import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY as string,
    secretAccessKey: process.env.AWS_SECRET_KEY as string,
  },
  region: "ap-south-1",
});

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET as string,
      Key: key,
    });

    await client.send(command);

    return NextResponse.json({
      success: true,
      message: `File "${key}" deleted successfully`,
    });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete file", details: (err as Error).message },
      { status: 500 }
    );
  }
}
