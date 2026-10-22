import { NextRequest, NextResponse } from 'next/server';
import { getAppEngineClient } from '@/lib/appmint-client';
import { getRequestInfo } from '@/lib/activity-tracker';
import { getAppmintAuth } from '@/lib/appmint-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleRequest('GET', request, await params);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleRequest('POST', request, await params);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleRequest('PUT', request, await params);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleRequest('DELETE', request, await params);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  return handleRequest('PATCH', request, await params);
}

async function handleRequest(method: string, request: NextRequest, params: { slug: string[] }) {
  try {
    // Get the path from the slug parameters
    let clientPath = params.slug.join('/');

    // Get query parameters (handles both single and array values)
    const url = new URL(request.url);
    const clientQuery: Record<string, string | string[]> = {};
    url.searchParams.forEach((value, key) => {
      const existing = clientQuery[key];
      if (existing) {
        // If key already exists, convert to array or push to existing array
        clientQuery[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
      } else {
        clientQuery[key] = value;
      }
    });

    clientPath = clientPath + url.search;

    // Get request body for POST/PUT/PATCH requests
    let clientData = null;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const contentType = request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          clientData = await request.json();
        } else if (contentType?.includes('multipart/form-data')) {
          clientData = await request.formData();
        } else {
          clientData = await request.text();
        }
      } catch (error) {
        // If body parsing fails, continue without data
        console.warn('Failed to parse request body:', error);
      }
    }

    // Get authorization - prioritize header (from UI), then cookies
    const authHeader = request.headers.get('authorization');
    const { token, clientInfo: otherInfo } = await getAppmintAuth().getClientInfo();
    const clientAuthorization = authHeader || token;

    // Get comprehensive client info including geo data
    let clientInfo: any = (await getRequestInfo(request.headers)) || {};
    clientInfo = { ...clientInfo, ...otherInfo };
    clientInfo.timezone = request.headers.get('x-client-timezone');

    // Always prefer origin/referer for actual domain (browser sets these)
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    if (origin) {
      try {
        clientInfo.host = new URL(origin).host;
      } catch (e) {}
    } else if (referer) {
      try {
        clientInfo.host = new URL(referer).host;
      } catch (e) {}
    }

    // Add authorization to clientInfo for x-client-authorization header
    if (clientAuthorization) {
      clientInfo.authorization = clientAuthorization;
    }

    const isMultiPath = request.headers.get('content-type')?.includes('multipart/form-data') || false;

    // Process the request using AppEngineClient
    const appEngineClient = getAppEngineClient();
    const result = await appEngineClient.processRequest(method, clientPath, clientData, clientAuthorization, clientQuery, clientInfo, isMultiPath);

    // Return the response
    return NextResponse.json(result);
  } catch (error) {
    console.error('API Route Error:', error);

    // Handle different types of errors
    if (error instanceof Error) {
      // Check if it's an axios error with response
      const axiosError = error as any;
      if (axiosError.response) {
        return NextResponse.json(
          {
            error: axiosError.response.data || axiosError.message,
            status: axiosError.response.status,
          },
          { status: axiosError.response.status },
        );
      }

      // Generic error
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Unknown error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
