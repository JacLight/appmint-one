'use client';

// from base-app/src/components/storefront/AddressPicker.tsx — ported verbatim; only import paths rewired.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/modules/store/components/ui/input';
import { storefrontAPI } from '@/modules/store/lib/storefront-api';
import { countries_subdivisions } from '@/modules/store/lib/data/countries/countries_subdivisions';
import { Check, MapPin, Plus, Loader2 } from 'lucide-react';

/** The country's states/regions as {value: code without the country prefix, label: name}, sorted by name. */
const stateOptions = (country?: string) => {
  const c = (country || 'US').toUpperCase();
  const seen = new Set<string>();
  return countries_subdivisions
    .filter((r) => r.country === c)
    .map((r) => ({ value: r.code.split('-').slice(1).join('-'), label: r.name }))
    .filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)))
    .sort((a, b) => a.label.localeCompare(b.label));
};
/** A saved or autocompleted state written as its name ("Oregon") maps to its code ("OR"). */
const stateCodeOf = (country?: string, state?: string) => {
  const v = (state || '').trim();
  if (!v) return '';
  const opts = stateOptions(country);
  return (opts.find((o) => o.value.toLowerCase() === v.toLowerCase()) || opts.find((o) => o.label.toLowerCase() === v.toLowerCase()))?.value || v;
};

export interface Address {
  id?: string;
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  label?: string;
  isDefault?: boolean;
}

interface AddressPickerProps {
  value: Address;
  onChange: (data: Partial<Address>) => void;
  onContinue?: () => void;
  showContinue?: boolean;
  canContinue?: boolean;
  label?: string;
}

export const AddressPicker: React.FC<AddressPickerProps> = ({
  value,
  onChange,
  onContinue,
  showContinue = false,
  canContinue = false,
  label = 'Address',
}) => {
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [saveAddress, setSaveAddress] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [sessionToken] = useState(() => Math.random().toString(36).substring(2));
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced autocomplete search
  const searchAddress = useCallback(async (input: string) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setAutocompleteLoading(true);
    try {
      const results = await storefrontAPI.getAddressAutocomplete(input, sessionToken);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Autocomplete error:', error);
    } finally {
      setAutocompleteLoading(false);
    }
  }, [sessionToken]);

  const handleStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange({ street1: val });

    // Debounce autocomplete
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchAddress(val);
    }, 300);
  };

  const selectSuggestion = async (suggestion: { placeId: string; description: string }) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setAutocompleteLoading(true);

    try {
      const details = await storefrontAPI.getPlaceDetails(suggestion.placeId);
      if (details) {
        onChange({
          street1: details.street1 || '',
          street2: details.street2 || '',
          city: details.city || '',
          state: details.state || '',
          zip: details.zip || '',
          country: details.country || 'US',
        });
      }
    } catch (error) {
      console.error('Error getting place details:', error);
      // Fallback: just use the description
      onChange({ street1: suggestion.description });
    } finally {
      setAutocompleteLoading(false);
    }
  };

  // Load saved addresses on mount - only if signed in
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        // Check if user is signed in first - getCustomerFromSession returns null for guests
        const customer = storefrontAPI.getCustomerFromSession();
        if (!customer) {
          setIsSignedIn(false);
          setLoading(false);
          return;
        }

        setIsSignedIn(true);
        const addresses = await storefrontAPI.getCustomerAddresses();
        if (addresses && addresses.length > 0) {
          setSavedAddresses(addresses);
          setShowForm(false);
          // Auto-select if only one address
          if (addresses.length === 1) {
            const addr = addresses[0];
            onChange({
              name: addr.name,
              street1: addr.street1,
              street2: addr.street2,
              city: addr.city,
              state: addr.state,
              zip: addr.zip,
              country: addr.country || 'US',
              phone: addr.phone,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load addresses:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAddresses();
  }, []);

  const selectAddress = (addr: Address) => {
    onChange({
      name: addr.name,
      street1: addr.street1,
      street2: addr.street2,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      country: addr.country || 'US',
      phone: addr.phone,
    });
    setShowForm(false);
    setSaveAddress(false);
  };

  const handleContinue = async () => {
    if (saveAddress && showForm) {
      setSaving(true);
      try {
        const result = await storefrontAPI.saveCustomerAddress({
          name: value.name,
          street1: value.street1,
          street2: value.street2,
          city: value.city,
          state: value.state,
          zip: value.zip,
          country: value.country,
          phone: value.phone,
        });

        if (result.success) {
          const addresses = await storefrontAPI.getCustomerAddresses();
          if (addresses) {
            setSavedAddresses(addresses);
          }
        }
      } catch (error) {
        console.error('Failed to save address:', error);
      }
      setSaving(false);
    }

    onContinue?.();
  };

  if (loading) {
    return <div className="py-4 text-slate-500 text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Saved Addresses */}
      {savedAddresses.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Select a saved address:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Add new address card - at top */}
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className={`relative p-4 rounded-xl text-left transition-all border-2 border-dashed ${
                showForm
                  ? 'bg-slate-50 border-slate-400'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  showForm ? 'bg-slate-700' : 'bg-slate-100'
                }`}>
                  <Plus className={`w-5 h-5 ${showForm ? 'text-white' : 'text-slate-500'}`} />
                </div>
                <div>
                  <p className={`font-medium ${showForm ? 'text-slate-900' : 'text-slate-700'}`}>
                    New address
                  </p>
                  <p className="text-sm text-slate-500">Enter different address</p>
                </div>
              </div>
            </button>

            {/* Saved address cards */}
            {savedAddresses.map((addr) => {
              const isSelected = value.street1 === addr.street1 && value.city === addr.city && !showForm;
              return (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => selectAddress(addr)}
                  className={`relative p-4 rounded-xl text-left transition-all bg-white ${
                    isSelected
                      ? 'border-2 border-emerald-500 shadow-md'
                      : 'border border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-emerald-50' : 'bg-slate-100'
                    }`}>
                      <MapPin className={`w-5 h-5 ${isSelected ? 'text-emerald-600' : 'text-slate-500'}`} />
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate text-slate-900">
                          {addr.label || addr.name || label}
                        </p>
                        {addr.isDefault && (
                          <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 bg-slate-100 text-slate-600">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm truncate text-slate-600">{addr.street1}</p>
                      {addr.street2 && (
                        <p className="text-sm truncate text-slate-600">{addr.street2}</p>
                      )}
                      <p className="text-sm text-slate-600">
                        {addr.city}, {addr.state} {addr.zip}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Address Form */}
      {(showForm || savedAddresses.length === 0) && (
        <div className="space-y-3 md:space-y-4">
          <Input
            placeholder="Full name"
            value={value.name || ''}
            onChange={(e) => onChange({ name: e.target.value })}
            required
            className="h-10 md:h-12 text-sm md:text-base border-slate-300 focus:border-slate-500 focus:ring-slate-500"
          />

          <div className="relative" ref={autocompleteRef}>
            <Input
              placeholder="Street address"
              value={value.street1 || ''}
              onChange={handleStreetChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              required
              autoComplete="off"
              className="h-10 md:h-12 text-sm md:text-base border-slate-300 focus:border-slate-500 focus:ring-slate-500"
            />
            {autocompleteLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.placeId}
                    type="button"
                    onClick={() => selectSuggestion(suggestion)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                  >
                    <p className="font-medium text-sm text-slate-900">{suggestion.mainText}</p>
                    <p className="text-xs text-slate-500">{suggestion.secondaryText}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Input
            placeholder="Apartment, suite, etc. (optional)"
            value={value.street2 || ''}
            onChange={(e) => onChange({ street2: e.target.value })}
            className="h-10 md:h-12 text-sm md:text-base border-slate-300 focus:border-slate-500 focus:ring-slate-500"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
            <Input
              placeholder="City"
              value={value.city || ''}
              onChange={(e) => onChange({ city: e.target.value })}
              required
              className="h-10 md:h-12 text-sm md:text-base border-slate-300 focus:border-slate-500 focus:ring-slate-500 col-span-2 md:col-span-1"
            />
            {/* State/region is picked from the country's list (the same list the shop uses to exclude regions),
                stored as its code ("OR", "AK"); a country with no regions on file keeps a text box. */}
            {stateOptions(value.country).length ? (
              <select
                aria-label="State"
                value={stateCodeOf(value.country, value.state)}
                onChange={(e) => onChange({ state: e.target.value })}
                required
                className={`h-10 md:h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-sm md:text-base focus:border-slate-500 focus:ring-slate-500 ${value.state ? 'text-slate-900' : 'text-slate-500'}`}
              >
                <option value="">State</option>
                {stateOptions(value.country).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <Input
                placeholder="State"
                value={value.state || ''}
                onChange={(e) => onChange({ state: e.target.value })}
                required
                className="h-10 md:h-12 text-sm md:text-base border-slate-300 focus:border-slate-500 focus:ring-slate-500"
              />
            )}
            <Input
              placeholder="ZIP"
              value={value.zip || ''}
              onChange={(e) => onChange({ zip: e.target.value })}
              required
              className="h-10 md:h-12 text-sm md:text-base border-slate-300 focus:border-slate-500 focus:ring-slate-500"
            />
          </div>

          <Input
            placeholder="Phone number (optional)"
            value={value.phone || ''}
            onChange={(e) => onChange({ phone: e.target.value })}
            className="h-10 md:h-12 text-sm md:text-base border-slate-300 focus:border-slate-500 focus:ring-slate-500"
          />

          {/* Save checkbox - only for signed in users */}
          {isSignedIn && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`saveAddress-${label.replace(/\s/g, '-')}`}
                checked={saveAddress}
                onChange={(e) => setSaveAddress(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300"
              />
              <label htmlFor={`saveAddress-${label.replace(/\s/g, '-')}`} className="text-xs md:text-sm text-slate-700">
                Save this address for future orders
              </label>
            </div>
          )}
        </div>
      )}

      {/* Continue button */}
      {showContinue && canContinue && (
        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="mt-4 px-6 py-2 bg-slate-900 text-white rounded font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      )}
    </div>
  );
};

export default AddressPicker;
