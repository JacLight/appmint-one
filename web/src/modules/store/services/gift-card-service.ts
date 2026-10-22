'use client';

// from base-app/src/services/gift-card-service.ts — ported verbatim; only import paths rewired.
import { getAppEngineClient } from '@/modules/store/lib/appmint-client';

/** An `sf_gift_card` as the ledger returns it to its holder: code and balance, never the PIN. */
export interface CustomerGiftCard {
  sk: string;
  /** Yours to spend, top up and share. False for a card you bought for someone else — its code is theirs and comes masked. */
  holder?: boolean;
  data: {
    serial: string;
    code: string;
    name?: string;
    type: 'physical' | 'digital' | 'promotional';
    status: 'inactive' | 'active' | 'used' | 'expired' | 'cancelled' | 'suspended';
    currency: string;
    initialAmount: number;
    balance: number;
    expirationDate?: string;
    purchasedBy?: string;
    purchaseOrderNumber?: string;
    recipientName?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    recipientMessage?: string;
    deliveredAt?: string;
    uses?: { transactionId: string; kind: string; date: string; amount: number; balanceAfter: number; orderNumber?: string }[];
  };
  createdate?: string;
}

/** The store's gift-card product, which is what a top-up buys. Null when the store sells none. */
export interface GiftCardReloadProduct {
  sku: string;
  name: string;
  image?: string;
  price: number;
  currency: string;
  denominations: number[];
  allowCustomAmount: boolean;
  minAmount?: number;
  maxAmount?: number;
}

export interface CustomerGiftCardsDTO {
  data: CustomerGiftCard[];
  total: number;
  usableBalance: number;
  reloadProduct?: GiftCardReloadProduct | null;
}

export interface ShareGiftCardRequest {
  amount: number;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

class GiftCardService {
  private client = getAppEngineClient();

  /** The signed-in customer's cards, usable value first. */
  async getMyCards(): Promise<CustomerGiftCardsDTO> {
    try {
      const result = await this.client.processRequest('get', 'client/giftcards/me');
      return result && Array.isArray(result.data) ? result : { data: [], total: 0, usableBalance: 0 };
    } catch (error) {
      console.error('Get gift cards error:', error);
      return { data: [], total: 0, usableBalance: 0 };
    }
  }

  /** Move part of one of my cards onto a new card for someone else; the server sends it to them. */
  async shareCard(serial: string, body: ShareGiftCardRequest): Promise<{ success: boolean; amount: number; sentTo: string; delivered: boolean; remainingBalance: number }> {
    return this.client.processRequest('post', `client/giftcards/me/${encodeURIComponent(serial)}/share`, body);
  }

  async checkBalance(code: string, pin?: string) {
    const qs = new URLSearchParams({ code });
    if (pin) qs.set('pin', pin);
    return this.client.processRequest('get', `client/giftcards/balance?${qs.toString()}`);
  }
}

export const giftCardService = new GiftCardService();
