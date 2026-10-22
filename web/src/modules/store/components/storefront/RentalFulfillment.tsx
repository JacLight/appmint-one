'use client';

// from base-app/src/components/storefront/RentalFulfillment.tsx — ported verbatim; only import paths rewired.
import React, { useState } from 'react';
import { Truck, MapPin, Calendar, Check, Pencil } from 'lucide-react';
import { Input } from '@/modules/store/components/ui/input';

// SDK AddressSchema: name, street1, street2, city, state, zip, country, phone, email, company
interface Address {
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  company?: string;
}

export interface RentalFulfillmentData {
  fulfillment: {
    type: 'pickup' | 'delivery';
    scheduledDate?: string;
    address?: Address;
    instructions?: string;
  };
  return: {
    type: 'dropoff' | 'pickup';
    scheduledDate?: string;
    address?: Address;
    instructions?: string;
    useSameAddress?: boolean;
  };
}

interface PickupLocation {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  hours?: string;
  phone?: string;
}

interface CartItem {
  sku: string;
  name: string;
  fulfillment?: {
    allowPickup?: boolean;
    allowDelivery?: boolean;
    allowDropoff?: boolean;
    allowReturnPickup?: boolean;
    deliveryFee?: number;
    returnPickupFee?: number;
  };
  pickupLocation?: PickupLocation;
  [key: string]: any;
}

interface RentalFulfillmentProps {
  data: RentalFulfillmentData;
  onChange: (data: RentalFulfillmentData) => void;
  pickupLocation?: PickupLocation;
  editingSection: 'contact' | 'shipping' | 'rental' | 'payment' | null;
  setEditingSection: (section: 'contact' | 'shipping' | 'rental' | 'payment' | null) => void;
  completedSections: Set<string>;
  completeSection: (section: string) => void;
  editSection: (section: string) => void;
  rentalItems?: CartItem[];
}

// Reusable Address Form Component (using SDK AddressSchema fields)
const AddressForm: React.FC<{
  address: Address;
  onChange: (address: Address) => void;
  title: string;
}> = ({ address, onChange, title }) => {
  const updateField = (field: keyof Address, value: string) => {
    onChange({ ...address, [field]: value });
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <h5 className="font-medium text-slate-900">{title}</h5>
      <Input
        placeholder="Full name"
        value={address.name || ''}
        onChange={(e) => updateField('name', e.target.value)}
      />
      <Input
        placeholder="Street address"
        value={address.street1 || ''}
        onChange={(e) => updateField('street1', e.target.value)}
      />
      <Input
        placeholder="Apartment, suite, etc. (optional)"
        value={address.street2 || ''}
        onChange={(e) => updateField('street2', e.target.value)}
      />
      <div className="grid grid-cols-3 gap-3">
        <Input
          placeholder="City"
          value={address.city || ''}
          onChange={(e) => updateField('city', e.target.value)}
        />
        <Input
          placeholder="State"
          value={address.state || ''}
          onChange={(e) => updateField('state', e.target.value)}
        />
        <Input
          placeholder="ZIP"
          value={address.zip || ''}
          onChange={(e) => updateField('zip', e.target.value)}
        />
      </div>
      <Input
        placeholder="Phone (optional)"
        value={address.phone || ''}
        onChange={(e) => updateField('phone', e.target.value)}
      />
    </div>
  );
};

export const RentalFulfillment: React.FC<RentalFulfillmentProps> = ({
  data,
  onChange,
  pickupLocation,
  editingSection,
  setEditingSection,
  completedSections,
  completeSection,
  editSection,
  rentalItems = [],
}) => {
  const isCompleted = completedSections.has('rental');
  const isContactCompleted = completedSections.has('contact');

  // Show form if:
  // 1. Explicitly editing this section, OR
  // 2. Contact is done and rental is not yet completed, OR
  // 3. This section is not completed yet (show form by default until completed)
  const isEditing = editingSection === 'rental' || (isContactCompleted && !isCompleted) || !isCompleted;
  const isCollapsed = isCompleted && editingSection !== 'rental';

  // Determine allowed fulfillment options based on rental items config
  const allowPickup = rentalItems.length === 0 || rentalItems.some(item => item.fulfillment?.allowPickup !== false);
  const allowDelivery = rentalItems.length === 0 || rentalItems.some(item => item.fulfillment?.allowDelivery === true);
  const allowDropoff = rentalItems.length === 0 || rentalItems.some(item => item.fulfillment?.allowDropoff !== false);
  const allowReturnPickup = rentalItems.length === 0 || rentalItems.some(item => item.fulfillment?.allowReturnPickup === true);

  // Get pickup location from rental items if not provided
  const effectivePickupLocation = pickupLocation || rentalItems.find(item => item.pickupLocation)?.pickupLocation;

  // Check if address is needed
  const needsDeliveryAddress = data.fulfillment.type === 'delivery';
  const needsReturnAddress = data.return.type === 'pickup' && !data.return.useSameAddress;

  // Validate if can continue (using SDK AddressSchema fields)
  const isDeliveryAddressValid = !needsDeliveryAddress || (
    data.fulfillment.address?.name &&
    data.fulfillment.address?.street1 &&
    data.fulfillment.address?.city &&
    data.fulfillment.address?.state &&
    data.fulfillment.address?.zip
  );
  const isReturnAddressValid = !needsReturnAddress || data.return.useSameAddress || (
    data.return.address?.name &&
    data.return.address?.street1 &&
    data.return.address?.city &&
    data.return.address?.state &&
    data.return.address?.zip
  );
  const canContinue = isDeliveryAddressValid && isReturnAddressValid;

  const handleFulfillmentTypeChange = (type: 'pickup' | 'delivery') => {
    onChange({
      ...data,
      fulfillment: {
        ...data.fulfillment,
        type,
        address: type === 'delivery' ? (data.fulfillment.address || {}) : undefined,
      },
    });
  };

  const handleReturnTypeChange = (type: 'dropoff' | 'pickup') => {
    onChange({
      ...data,
      return: {
        ...data.return,
        type,
        address: type === 'pickup' ? (data.return.address || {}) : undefined,
        useSameAddress: type === 'pickup' ? (data.return.useSameAddress ?? true) : undefined,
      },
    });
  };

  const handleDeliveryAddressChange = (address: Address) => {
    onChange({
      ...data,
      fulfillment: { ...data.fulfillment, address },
    });
  };

  const handleReturnAddressChange = (address: Address) => {
    onChange({
      ...data,
      return: { ...data.return, address },
    });
  };

  const handleUseSameAddressChange = (useSame: boolean) => {
    onChange({
      ...data,
      return: {
        ...data.return,
        useSameAddress: useSame,
        address: useSame ? data.fulfillment.address : (data.return.address || {}),
      },
    });
  };

  const handleFulfillmentInstructionsChange = (instructions: string) => {
    onChange({
      ...data,
      fulfillment: { ...data.fulfillment, instructions },
    });
  };

  const handleReturnInstructionsChange = (instructions: string) => {
    onChange({
      ...data,
      return: { ...data.return, instructions },
    });
  };

  const handleContinue = () => {
    // If using same address for return, copy delivery address
    if (data.return.type === 'pickup' && data.return.useSameAddress && data.fulfillment.address) {
      onChange({
        ...data,
        return: { ...data.return, address: data.fulfillment.address },
      });
    }
    // Let Checkout.tsx's completeSection handle the navigation
    // For rental-only carts, it will go to billing address first
    completeSection('rental');
  };

  const formatAddress = (addr?: Address) => {
    if (!addr) return 'Not specified';
    const parts = [addr.street1, addr.street2, addr.city, addr.state, addr.zip].filter(Boolean);
    return parts.join(', ') || 'Not specified';
  };

  const formatPickupLocation = (loc?: PickupLocation) => {
    if (!loc) return null;
    const parts = [loc.address, loc.city, loc.state, loc.zip].filter(Boolean);
    return parts.join(', ') || null;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isCompleted ? 'bg-emerald-500' : isEditing ? 'bg-slate-900' : 'bg-slate-300'
            }`}
          >
            {isCompleted ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <span className="text-sm font-semibold text-white">2</span>
            )}
          </div>
          <div className="text-left">
            <h3 className="text font-semibold text-slate-900">Rental Fulfillment</h3>
            {isCollapsed && (
              <p className="text-sm text-slate-500">
                {data.fulfillment.type === 'delivery' ? 'Delivery' : 'Pickup'} → {data.return.type === 'dropoff' ? 'Drop-off' : 'Return Pickup'}
              </p>
            )}
          </div>
        </div>
        {isCompleted && (
          <button onClick={() => editSection('rental')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <Pencil className="w-4 h-4" />
            <span className="text-sm font-medium">Edit</span>
          </button>
        )}
      </div>

      {/* Content */}
      {isEditing && (
        <div className="p-8 space-y-6">
          {/* Fulfillment Section - How to receive */}
          <div className="space-y-4">
            <h4 className="font-medium text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              How would you like to receive your rental?
            </h4>

            {/* Pickup/Delivery Options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleFulfillmentTypeChange('pickup')}
                disabled={!allowPickup}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  data.fulfillment.type === 'pickup'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                } ${!allowPickup ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="font-medium">Pickup</span>
                </div>
                <p className="text-sm text-slate-500">Pick up from our location</p>
              </button>
              <button
                onClick={() => handleFulfillmentTypeChange('delivery')}
                disabled={!allowDelivery}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  data.fulfillment.type === 'delivery'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                } ${!allowDelivery ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-4 h-4" />
                  <span className="font-medium">Delivery</span>
                </div>
                <p className="text-sm text-slate-500">We'll deliver to your address</p>
              </button>
            </div>

            {/* Pickup Location Info */}
            {data.fulfillment.type === 'pickup' && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm font-medium text-blue-900 mb-1">Pickup Location</p>
                {effectivePickupLocation ? (
                  <>
                    {effectivePickupLocation.name && <p className="text-sm text-blue-800 font-medium">{effectivePickupLocation.name}</p>}
                    {formatPickupLocation(effectivePickupLocation) && (
                      <p className="text-sm text-blue-700">{formatPickupLocation(effectivePickupLocation)}</p>
                    )}
                    {effectivePickupLocation.hours && <p className="text-sm text-blue-600 mt-1">Hours: {effectivePickupLocation.hours}</p>}
                    {effectivePickupLocation.phone && <p className="text-sm text-blue-600">Phone: {effectivePickupLocation.phone}</p>}
                  </>
                ) : (
                  <p className="text-sm text-blue-700">Pickup location details will be provided after booking confirmation.</p>
                )}
              </div>
            )}

            {/* Delivery Address Form */}
            {data.fulfillment.type === 'delivery' && (
              <AddressForm
                address={data.fulfillment.address || {}}
                onChange={handleDeliveryAddressChange}
                title="Delivery Address"
              />
            )}

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Special instructions (optional)
              </label>
              <textarea
                value={data.fulfillment.instructions || ''}
                onChange={(e) => handleFulfillmentInstructionsChange(e.target.value)}
                placeholder="E.g., Gate code, leave at door, etc."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>
          </div>

          {/* Return Section - How to return */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              How would you like to return the rental?
            </h4>

            {/* Dropoff/Pickup Options */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleReturnTypeChange('dropoff')}
                disabled={!allowDropoff}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  data.return.type === 'dropoff'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                } ${!allowDropoff ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="font-medium">Drop-off</span>
                </div>
                <p className="text-sm text-slate-500">Return to our location</p>
              </button>
              <button
                onClick={() => handleReturnTypeChange('pickup')}
                disabled={!allowReturnPickup}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  data.return.type === 'pickup'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                } ${!allowReturnPickup ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-4 h-4" />
                  <span className="font-medium">Return Pickup</span>
                </div>
                <p className="text-sm text-slate-500">We'll pick up from your address</p>
              </button>
            </div>

            {/* Drop-off Location Info */}
            {data.return.type === 'dropoff' && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm font-medium text-blue-900 mb-1">Drop-off Location</p>
                {effectivePickupLocation ? (
                  <>
                    {effectivePickupLocation.name && <p className="text-sm text-blue-800 font-medium">{effectivePickupLocation.name}</p>}
                    {formatPickupLocation(effectivePickupLocation) && (
                      <p className="text-sm text-blue-700">{formatPickupLocation(effectivePickupLocation)}</p>
                    )}
                    {effectivePickupLocation.hours && <p className="text-sm text-blue-600 mt-1">Hours: {effectivePickupLocation.hours}</p>}
                    {effectivePickupLocation.phone && <p className="text-sm text-blue-600">Phone: {effectivePickupLocation.phone}</p>}
                  </>
                ) : (
                  <p className="text-sm text-blue-700">Drop-off location details will be provided after booking confirmation.</p>
                )}
              </div>
            )}

            {/* Return Pickup Address */}
            {data.return.type === 'pickup' && (
              <>
                {/* Use same address option - only show if delivery was selected */}
                {data.fulfillment.type === 'delivery' && data.fulfillment.address?.street1 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useSameAddress"
                      checked={data.return.useSameAddress ?? true}
                      onChange={(e) => handleUseSameAddressChange(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <label htmlFor="useSameAddress" className="text-sm text-slate-700">
                      Use same address as delivery ({formatAddress(data.fulfillment.address)})
                    </label>
                  </div>
                )}

                {/* Return address form - show if not using same address */}
                {(!data.return.useSameAddress || data.fulfillment.type !== 'delivery') && (
                  <AddressForm
                    address={data.return.address || {}}
                    onChange={handleReturnAddressChange}
                    title="Return Pickup Address"
                  />
                )}
              </>
            )}

            {/* Return Instructions */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Return instructions (optional)
              </label>
              <textarea
                value={data.return.instructions || ''}
                onChange={(e) => handleReturnInstructionsChange(e.target.value)}
                placeholder="E.g., Preferred time, contact info, etc."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className={`w-full py-3 font-medium rounded-lg transition-colors ${
              canContinue
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
};
