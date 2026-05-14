import { NextRequest } from "next/server";

const allowedMethods = ["GET", "POST", "DELETE", "OPTIONS"];
/**
 * Proxies an incoming request to the configured backend API service.
 * 
 * @param request the incoming Next.js request object
 * @param path an array of path segments representing the target backend endpoint
 * @returns the response received from the backend service, or a 500 error if configuration is missing
 */
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
/**
 * Handles HTTP GET requests by proxying them to the backend service.
 * 
 * @param request the incoming HTTP request
 * @param context the route context
 * @returns response from the proxied backend service
 */
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

/**
 * Handles HTTP POST requests by proxying them to the backend service.
 * 
 * @param request the incoming HTTP request
 * @param context the route context
 * @returns response from the proxied backend service
 */
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

/**
 * Handles HTTP DELETE requests by proxying them to the backend service.
 * 
 * @param request the incoming HTTP request
 * @param context the route context
 * @returns response from the proxied backend service
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

/**
 * Handles HTTP OPTIONS requests for CORS preflight.
 * 
 * @returns a 204 No Content response indicating allowed methods
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: allowedMethods.join(", ")
    }
  });
}
