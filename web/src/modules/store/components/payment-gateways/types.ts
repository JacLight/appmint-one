// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
// from base-app/src/components/payment-gateways/types.ts — ported verbatim; only import paths rewired.
export interface PaymentAmount {
  amount: number;
  currency: string;
  /** Storefront checkout: the stored cart this amount is that cart's total for. */
  cartId?: string;
  /** Gift cards pay the rest, so the amount is less than the cart total. */
  partial?: boolean;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'wallet' | 'crypto' | 'gift_card' | 'account_balance' | 'offline';
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  funding?: string;
}

export interface PaymentIntent {
  id: string;
  amount: PaymentAmount;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  customer?: CustomerInfo;
  payment_method?: PaymentMethod;
  metadata?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentResult {
  success: boolean;
  payment_intent_id?: string;
  transaction_id?: string;
  error?: string;
  requires_action?: boolean;
  action_url?: string;
  metadata?: Record<string, any>;
}

export interface PaymentGatewayConfig {
  name: string;
  displayName: string;
  enabled: boolean;
  testMode: boolean;
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  supportedCurrencies: string[];
  supportedCountries: string[];
  minAmount?: number;
  maxAmount?: number;
  processingFee?: {
    type: 'fixed' | 'percentage' | 'both';
    fixed?: number;
    percentage?: number;
  };
}

export interface CreatePaymentRequest {
  amount: PaymentAmount;
  customer: CustomerInfo;
  payment_method_id?: string;
  return_url?: string;
  cancel_url?: string;
  metadata?: Record<string, string>;
  description?: string;
}

export interface ConfirmPaymentRequest {
  payment_intent_id: string;
  payment_method_id?: string;
  return_url?: string;
}

export interface RefundRequest {
  payment_intent_id: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, string>;
}

export interface RefundResult {
  success: boolean;
  refund_id?: string;
  amount?: number;
  status?: 'pending' | 'succeeded' | 'failed';
  error?: string;
}

export abstract class PaymentGateway {
  protected config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  abstract createPaymentIntent(request: CreatePaymentRequest): Promise<PaymentResult>;
  abstract confirmPayment(request: ConfirmPaymentRequest): Promise<PaymentResult>;
  abstract refundPayment(request: RefundRequest): Promise<RefundResult>;
  abstract getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null>;
  abstract handleWebhook(payload: any, signature: string): Promise<any>;

  getConfig(): PaymentGatewayConfig {
    return this.config;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  supportsAmount(amount: PaymentAmount): boolean {
    if (this.config.minAmount && amount.amount < this.config.minAmount) {
      return false;
    }
    if (this.config.maxAmount && amount.amount > this.config.maxAmount) {
      return false;
    }
    return this.config.supportedCurrencies.includes(amount.currency);
  }
}

export interface PaymentGatewayRegistry {
  register(gateway: PaymentGateway): void;
  get(name: string): PaymentGateway | null;
  getAll(): PaymentGateway[];
  getEnabled(): PaymentGateway[];
  getAvailableForAmount(amount: PaymentAmount): PaymentGateway[];
}

export type PaymentGatewayName = 'stripe' | 'payoxygen' | 'paypal' | 'account_balance' | 'gift_card' | 'offline';

export interface PaymentComponentProps {
  amount: PaymentAmount;
  customer: CustomerInfo;
  onSuccess: (result: PaymentResult) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
  className?: string;
  disabled?: boolean;
  showTitle?: boolean;
  metadata?: Record<string, string>;
  gateway?;
  currency?: string;
}
