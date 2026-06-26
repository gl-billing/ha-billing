import {
  verifyClientPortalToken,
  formatPortalExpiry
} from "@/lib/client-portal-token";
import { buildPaymentRequestUrl, createPaymentRequestToken, getPaymentInstructions } from "@/lib/payment-request";
import { ClientPortalView } from "@/components/ClientPortalView";

type PageProps = { params: Promise<{ token: string }> };

export default async function ClientPortalPage({ params }: PageProps) {
  const { token } = await params;
  const payload = verifyClientPortalToken(decodeURIComponent(token));

  if (!payload) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <div className="card border-2 border-red-200 bg-red-50/40 p-6 text-center">
          <h1 className="text-lg font-extrabold text-red-900">Link expired or invalid</h1>
          <p className="mt-2 text-sm text-muted">Contact Hernandez & Associates for a new client portal link.</p>
        </div>
      </main>
    );
  }

  const snapshot = payload.snapshot;
  const expiresLabel = formatPortalExpiry(payload.exp);
  const payUrl =
    snapshot.balance > 0.005
      ? buildPaymentRequestUrl(
          createPaymentRequestToken({
            clientCode: snapshot.clientCode,
            clientName: snapshot.clientName,
            amount: snapshot.balance,
            caseTitle: snapshot.caseTitle,
            preferredGreeting: snapshot.preferredGreeting,
            expiresInDays: 7
          })
        )
      : null;

  return (
    <main className="client-portal-shell mx-auto min-h-screen max-w-lg px-4 py-8 pb-12">
      <ClientPortalView
        token={decodeURIComponent(token)}
        snapshot={snapshot}
        expiresLabel={expiresLabel}
        payUrl={payUrl}
        paymentInstructions={getPaymentInstructions()}
      />
    </main>
  );
}
