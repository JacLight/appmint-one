'use client';

// from base-app/src/components/storefront/CustomerInfo.tsx — ported verbatim; only import paths rewired.
import React from 'react';
import { Input } from '@/modules/store/components/ui/input';
import { Edit3, Check } from 'lucide-react';
import { AddressPicker, Address } from './AddressPicker';

interface CustomerInfoProps {
  formData: {
    email: string;
    phone: string;
    shippingAddress: Address;
    billingAddress: Address;
    useSameForBilling: boolean;
  };
  setFormData: (data: Partial<CustomerInfoProps['formData']>) => void;
  editingSection: 'contact' | 'shipping' | 'rental' | 'payment' | null;
  completedSections: Set<string>;
  completeSection: (section: string) => void;
  editSection: (section: 'contact' | 'shipping' | 'rental' | 'payment') => void;
  isRentalOnly?: boolean;
}

export const CustomerInfo: React.FC<CustomerInfoProps> = ({
  formData,
  setFormData,
  editingSection,
  completedSections,
  completeSection,
  editSection,
  isRentalOnly = false,
}) => {
  const addressSectionLabel = isRentalOnly ? 'Delivery Address' : 'Shipping Address';

  const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isContactValid = isEmailValid(formData.email);

  const isAddressValid = (addr: Address) => !!(addr.name && addr.street1 && addr.city && addr.state && addr.zip);
  const isShippingValid = isAddressValid(formData.shippingAddress);
  const isBillingValid = isRentalOnly
    ? isAddressValid(formData.billingAddress)
    : (formData.useSameForBilling || isAddressValid(formData.billingAddress));

  const canContinue = isRentalOnly ? isBillingValid : (isShippingValid && isBillingValid);

  return (
    <div className="space-y-8">
      {/* Contact Section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${completedSections.has('contact') ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              {completedSections.has('contact') ? <Check className="w-4 h-4 text-white" /> : <span className="text-sm font-semibold text-white">1</span>}
            </div>
            <h3 className="text font-semibold text-slate-900">Contact Information</h3>
          </div>
          {completedSections.has('contact') && (
            <button onClick={() => editSection('contact')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <Edit3 className="w-4 h-4" />
              <span className="text-sm font-medium">Edit</span>
            </button>
          )}
        </div>

        {editingSection === 'contact' || !completedSections.has('contact') ? (
          <div className="p-4">
            <Input
              type="email"
              placeholder="Enter your email address"
              value={formData.email}
              onChange={(e) => setFormData({ email: e.target.value })}
              required
              className="h-12 text-base border-slate-300 focus:border-slate-900 focus:ring-slate-900"
            />
            {isContactValid && (
              <button type="button" onClick={() => completeSection('contact')} className="mt-4 px-6 py-2 bg-slate-900 text-white rounded font-medium">
                Continue
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-50">
            <p className="text-slate-700 font-medium">{formData.email}</p>
          </div>
        )}
      </div>

      {/* Shipping Section */}
      {!isRentalOnly && (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${completedSections.has('shipping') ? 'bg-emerald-500' : editingSection === 'shipping' ? 'bg-slate-900' : 'bg-slate-300'}`}>
              {completedSections.has('shipping') ? <Check className="w-4 h-4 text-white" /> : <span className="text-sm font-semibold text-white">2</span>}
            </div>
            <h3 className="text font-semibold text-slate-900">{addressSectionLabel}</h3>
          </div>
          {completedSections.has('shipping') && (
            <button onClick={() => editSection('shipping')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <Edit3 className="w-4 h-4" />
              <span className="text-sm font-medium">Edit</span>
            </button>
          )}
        </div>

        {editingSection === 'shipping' || !completedSections.has('shipping') ? (
          <div className="p-8 space-y-4">
            <AddressPicker
              value={formData.shippingAddress}
              onChange={(updates) => setFormData({ shippingAddress: { ...formData.shippingAddress, ...updates } })}
              showContinue={formData.useSameForBilling}
              canContinue={canContinue}
              onContinue={() => completeSection('shipping')}
              label={addressSectionLabel}
            />

            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="useSameForBilling"
                checked={formData.useSameForBilling}
                onChange={(e) => setFormData({ useSameForBilling: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor="useSameForBilling" className="text-sm text-slate-700">
                Use same address for billing
              </label>
            </div>

            {!formData.useSameForBilling && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h4 className="font-medium text-slate-900">Billing Address</h4>
                <AddressPicker
                  value={formData.billingAddress}
                  onChange={(updates) => setFormData({ billingAddress: { ...formData.billingAddress, ...updates } })}
                  showContinue
                  canContinue={isShippingValid && isAddressValid(formData.billingAddress)}
                  onContinue={() => completeSection('shipping')}
                  label="Billing Address"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-50">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{addressSectionLabel}</p>
                <p className="text-slate-700 font-medium">{formData.shippingAddress.name}</p>
                <p className="text-slate-600">{formData.shippingAddress.street1}</p>
                {formData.shippingAddress.street2 && <p className="text-slate-600">{formData.shippingAddress.street2}</p>}
                <p className="text-slate-600">{formData.shippingAddress.city}, {formData.shippingAddress.state} {formData.shippingAddress.zip}</p>
                {formData.shippingAddress.phone && <p className="text-slate-600">{formData.shippingAddress.phone}</p>}
              </div>

              {!formData.useSameForBilling && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Billing Address</p>
                  <p className="text-slate-700 font-medium">{formData.billingAddress.name}</p>
                  <p className="text-slate-600">{formData.billingAddress.street1}</p>
                  {formData.billingAddress.street2 && <p className="text-slate-600">{formData.billingAddress.street2}</p>}
                  <p className="text-slate-600">{formData.billingAddress.city}, {formData.billingAddress.state} {formData.billingAddress.zip}</p>
                  {formData.billingAddress.phone && <p className="text-slate-600">{formData.billingAddress.phone}</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Billing Address Section - for rental-only carts */}
      {isRentalOnly && (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${completedSections.has('shipping') ? 'bg-emerald-500' : editingSection === 'shipping' ? 'bg-slate-900' : 'bg-slate-300'}`}>
              {completedSections.has('shipping') ? <Check className="w-4 h-4 text-white" /> : <span className="text-sm font-semibold text-white">3</span>}
            </div>
            <h3 className="text font-semibold text-slate-900">Billing Address</h3>
          </div>
          {completedSections.has('shipping') && (
            <button onClick={() => editSection('shipping')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <Edit3 className="w-4 h-4" />
              <span className="text-sm font-medium">Edit</span>
            </button>
          )}
        </div>

        {editingSection === 'shipping' || !completedSections.has('shipping') ? (
          <div className="p-8 space-y-4">
            <AddressPicker
              value={formData.billingAddress}
              onChange={(updates) => setFormData({ billingAddress: { ...formData.billingAddress, ...updates } })}
              showContinue
              canContinue={isBillingValid}
              onContinue={() => completeSection('shipping')}
              label="Billing Address"
            />
          </div>
        ) : (
          <div className="p-4 bg-slate-50">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Billing Address</p>
              <p className="text-slate-700 font-medium">{formData.billingAddress.name}</p>
              <p className="text-slate-600">{formData.billingAddress.street1}</p>
              {formData.billingAddress.street2 && <p className="text-slate-600">{formData.billingAddress.street2}</p>}
              <p className="text-slate-600">{formData.billingAddress.city}, {formData.billingAddress.state} {formData.billingAddress.zip}</p>
              {formData.billingAddress.phone && <p className="text-slate-600">{formData.billingAddress.phone}</p>}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
