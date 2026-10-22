'use client';

// from base-app/src/services/wishlist-service.ts — ported verbatim; only import paths rewired.
import { getAppEngineClient } from '@/modules/store/lib/appmint-client';
import { API_ENDPOINTS } from '@/modules/store/lib/appmint-endpoints';

/**
 * sf_wishlist record shape, as returned by /client-data/wishlist.
 * One customer can own many named wishlists; each holds a `products` array.
 */
export interface WishlistItem {
  sku: string;
  name?: string;
  price?: number;
}

export interface Wishlist {
  sk: string;
  author: string;
  datatype: 'sf_wishlist';
  data: {
    name: string;
    status?: string;
    products: WishlistItem[];
  };
  createdate?: string;
  modifydate?: string;
}

export interface WishlistDTO {
  data: Wishlist[];
  total?: number;
}

class WishlistService {
  private client = getAppEngineClient();

  /** Returns all of this customer's wishlists (BaseModelDTO of sf_wishlist). */
  async getWishlists(): Promise<WishlistDTO> {
    try {
      const result = await this.client.processRequest('get', API_ENDPOINTS.WISHLIST_GET);
      if (!result) return { data: [], total: 0 };
      if (Array.isArray(result)) return { data: result, total: result.length };
      return result;
    } catch (error) {
      console.error('Get wishlists error:', error);
      return { data: [], total: 0 };
    }
  }

  /**
   * Create a new named wishlist. With no name, ensures the customer has a
   * default wishlist and returns it.
   */
  async createWishlist(name?: string, status?: string): Promise<Wishlist | null> {
    try {
      const body: any = {};
      if (name) body.name = name;
      if (status) body.status = status;
      return await this.client.processRequest('post', API_ENDPOINTS.WISHLIST_CREATE, body);
    } catch (error) {
      console.error('Create wishlist error:', error);
      throw error;
    }
  }

  /** Delete an entire named wishlist. */
  async deleteWishlist(wishlistId: string): Promise<void> {
    try {
      await this.client.processRequest('delete', API_ENDPOINTS.WISHLIST_DELETE(wishlistId));
    } catch (error) {
      console.error('Delete wishlist error:', error);
      throw error;
    }
  }

  /**
   * Add an item (by sku) to a wishlist. If `wishlistId` is omitted, the
   * customer's default wishlist is used (auto-created on first use).
   */
  async addItem(
    productId: string,
    opts?: { wishlistId?: string; name?: string; price?: number },
  ): Promise<Wishlist | null> {
    try {
      const body: any = {};
      if (opts?.wishlistId) body.wishlistId = opts.wishlistId;
      if (opts?.name !== undefined) body.name = opts.name;
      if (opts?.price !== undefined) body.price = opts.price;
      return await this.client.processRequest('post', API_ENDPOINTS.WISHLIST_ADD_ITEM(productId), body);
    } catch (error) {
      console.error('Add to wishlist error:', error);
      throw error;
    }
  }

  /**
   * Remove an item (by sku) from a wishlist. If `wishlistId` is omitted,
   * removes from the default wishlist.
   */
  async removeItem(productId: string, wishlistId?: string): Promise<Wishlist | { status: string } | null> {
    try {
      return await this.client.processRequest('delete', API_ENDPOINTS.WISHLIST_REMOVE_ITEM(productId, wishlistId));
    } catch (error) {
      console.error('Remove from wishlist error:', error);
      throw error;
    }
  }
}

export const wishlistService = new WishlistService();
