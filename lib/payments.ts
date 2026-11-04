// External payment provider boundary. The build pack calls for an external provider.
// The project owner chose a simulated wallet for this demo, so no card data is collected
// and no money moves. A real provider would replace `charge` and nothing else.
export type PayMethod = 'demo-card' | 'demo-wallet' | 'demo-decline';
export const PAY_METHODS: PayMethod[] = ['demo-card', 'demo-wallet', 'demo-decline'];

export type ChargeResult = { status: 'succeeded' | 'declined' };

export async function charge(input: { method: PayMethod; amountCents: number }): Promise<ChargeResult> {
  if (input.amountCents <= 0) return { status: 'succeeded' };
  return { status: input.method === 'demo-decline' ? 'declined' : 'succeeded' };
}

export const methodLabel = (m: string) =>
  m === 'demo-wallet' ? 'Demo wallet' : m === 'demo-decline' ? 'Declined test card' : 'Demo card •••• 4242';
