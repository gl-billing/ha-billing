import { verifyPaymentRequestToken, getPaymentInstructions } from "@/lib/payment-request";
import { formatPeso } from "@/lib/gl-config";

type PageProps = { params: Promise<{ token: string }> };

export default async function PaymentRequestPage({ params }: PageProps) {
  const { token } = await params;
  const payload = verifyPaymentRequestToken(decodeURIComponent(token));
  const instructions = getPaymentInstructions();

  if (!payload) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <div className="card border-2 border-red-200 bg-red-50/40 p-6 text-center">
          <h1 className="text-lg font-extrabold text-red-900">Link expired or invalid</h1>
          <p className="mt-2 text-sm text-muted">Contact Hernandez & Associates for a new payment link.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <div className="card p-6">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Secure payment request</p>
        <h1 className="mt-1 text-xl font-extrabold text-ink">{instructions.payee}</h1>
        <p className="mt-3 text-sm text-muted">Re: {payload.caseTitle || payload.clientName}</p>

        <div className="mt-6 rounded-lg bg-[#faf8f4] p-4 text-center">
          <p className="text-xs font-bold uppercase text-muted">Amount due</p>
          <p className="mt-1 text-3xl font-extrabold text-[#8b1e1e]">{formatPeso(payload.amount)}</p>
        </div>

        <div className="mt-6 space-y-3 text-sm">
          <p>
            <span className="font-bold text-ink">Reference:</span> {payload.clientCode}
          </p>
          {instructions.gcash ? (
            <p>
              <span className="font-bold text-ink">GCash:</span> {instructions.gcash}
            </p>
          ) : null}
          {instructions.maya ? (
            <p>
              <span className="font-bold text-ink">Maya:</span> {instructions.maya}
            </p>
          ) : null}
          {instructions.bank ? (
            <p className="whitespace-pre-wrap">
              <span className="font-bold text-ink">Bank transfer:</span>
              <br />
              {instructions.bank}
            </p>
          ) : null}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          After paying, send your proof of payment to the firm with reference <strong>{payload.clientCode}</strong>.
          An acknowledgment receipt will be issued once payment is verified.
        </p>
      </div>
    </main>
  );
}
