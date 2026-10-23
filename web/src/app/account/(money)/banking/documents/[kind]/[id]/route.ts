import { requireModule, requireSession } from "@/lib/guards";
import { getAppmintAuth } from "@/lib/appmint-auth";
import { getAppEngineClient } from "@/lib/appmint-client";
import { getProxiedUrl } from "@/lib/proxy-utils";
import { runtimeEnv } from "@/lib/runtime-env";
import { usesEngineBanking } from "@/modules/money/api/adapter";
import { customerAuthorization } from "@/modules/money/api/authorization";

/** Binary adapter for the existing connector's authenticated server headers.
 * Customer ownership is checked again by AppEngine's document endpoint.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  await requireSession();
  await requireModule("money");
  if (!usesEngineBanking())
    return new Response("Document unavailable in this connection.", {
      status: 404,
    });
  const { kind, id } = await params;
  const query = new URL(request.url).searchParams;
  const account = query.get("account");
  const encoded = encodeURIComponent(id);
  const path =
    kind === "statement" && account
      ? `client/banking/accounts/${encodeURIComponent(
          account
        )}/statements/${encoded}/pdf`
      : kind === "payoff"
      ? `client/banking/loans/${encoded}/payoff/pdf`
      : kind === "notice"
      ? `client/banking/loans/applications/${encoded}/adverse-action/pdf`
      : null;
  if (!path) return new Response("Document not found.", { status: 404 });
  const { token } = await getAppmintAuth().getClientInfo();
  if (!token) return new Response("Sign in again.", { status: 401 });
  const connector = getAppEngineClient();
  const header = await connector.getHeaderWithToken();
  connector.applyClientInfoHeaders(
    header.headers,
    await connector.getServerClientInfo()
  );
  header.headers["x-client-authorization"] = customerAuthorization(token);
  header.headers.Accept = "application/pdf";
  const endpoint = getProxiedUrl(path, runtimeEnv("APPENGINE_ENDPOINT") || "");
  try {
    let result = await fetch(endpoint, {
      headers: header.headers,
      cache: "no-store",
      redirect: "error",
    });
    // Reuse the connector's token acquisition when its cached app token expired.
    if (result.status === 401) {
      const renewed = await connector.getAppToken();
      if (renewed) {
        header.headers.Authorization = `Bearer ${renewed}`;
        result = await fetch(endpoint, {
          headers: header.headers,
          cache: "no-store",
          redirect: "error",
        });
      }
    }
    if (!result.ok)
      return new Response(
        result.status === 404
          ? "Document not found."
          : "The bank could not provide this document. Try again.",
        { status: result.status }
      );
    const bytes = await result.arrayBuffer();
    if (Buffer.from(bytes).subarray(0, 5).toString() !== "%PDF-")
      return new Response("The bank did not return a PDF.", { status: 502 });
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${kind}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(
      "The bank could not provide this document. Try again.",
      { status: 503 }
    );
  }
}
