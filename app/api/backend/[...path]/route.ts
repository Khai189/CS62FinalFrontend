import { NextRequest } from "next/server";

const allowedMethods = ["GET", "POST", "DELETE", "OPTIONS"];

async function proxy(request: NextRequest, path: string[]) {
  const backendBaseUrl = process.env.BACKEND_API_BASE_URL;
  if (!backendBaseUrl) {
    return new Response("BACKEND_API_BASE_URL is not configured", { status: 500 });
  }

  const url = new URL(`${backendBaseUrl.replace(/\/$/, "")}/${path.join("/")}`);
  url.search = request.nextUrl.search;

  const forwardedHeaders = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");

  if (authorization) {
    forwardedHeaders.set("authorization", authorization);
  }
  if (contentType) {
    forwardedHeaders.set("content-type", contentType);
  }

  const init: RequestInit = {
    method: request.method,
    headers: forwardedHeaders,
    cache: "no-store"
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.text();
  }

  const response = await fetch(url, init);
  const body = await response.text();
  const proxyResponse = new Response(body, { status: response.status });
  const responseType = response.headers.get("content-type");

  if (responseType) {
    proxyResponse.headers.set("content-type", responseType);
  }

  return proxyResponse;
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: allowedMethods.join(", ")
    }
  });
}
