import { useState, useEffect } from 'react';
import { useToast } from '../../../context/ToastContext';
import { getAppSettings, updateAppSettings } from '../../../services/api/admin/adminSettingsService';
import { Truck, Percent, Save } from 'lucide-react';

interface DeliverySettingSection {
  id: string;
  title: string;
  subtitle?: string;
  fields: DeliverySettingField[];
}

interface DeliverySettingField {
  id: string;
  label: string;
  description: string;
  type: 'number' | 'select' | 'text';
  value: string | number;
  options?: string[]; // For select type
  prefix?: string;    // e.g. "₹"
  suffix?: string;    // e.g. "Kms" or "%"
}

export default function AdminDeliverySettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<DeliverySettingSection[]>([
    {
      id: 'delivery_config',
      title: 'Delivery Configuration',
      subtitle: 'Manage distance limits, delivery charges, free delivery threshold, and service model.',
      fields: [
        {
          id: 'delivery_radius',
          label: 'Allow Order Within',
          description: 'Set the maximum distance limit for delivery service.',
          type: 'number',
          value: 0,
          suffix: 'Kms'
        },
        {
          id: 'service_type',
          label: 'Service Type',
          description: 'Choose how customers receive their orders.',
          type: 'select',
          value: 'Delivery + Pickup',
          options: ['Delivery', 'Pickup', 'Delivery + Pickup']
        },
        {
          id: 'delivery_fee',
          label: 'Delivery Fee',
          description: 'Applicable standard delivery charge for customer orders.',
          type: 'number',
          value: 0,
          prefix: '₹'
        },
        {
          id: 'free_delivery_above',
          label: 'Free Shipping Above',
          description: 'Offer free delivery on orders above this specified amount.',
          type: 'number',
          value: 0,
          prefix: '₹'
        }
      ]
    },
    {
      id: 'payment_discount',
      title: 'Online Payment Discount',
      subtitle: 'Enable instant promotional discounts when customers pay via online payment gateways.',
      fields: [
        {
          id: 'discount_enabled',
          label: 'Enable Online Discount',
          description: 'Enable discount for online payments (Razorpay/Cashfree).',
          type: 'select',
          value: 'No',
          options: ['Yes', 'No']
        },
        {
          id: 'discount_percentage',
          label: 'Discount Percentage',
          description: 'Set the percentage to be deducted on online transactions.',
          type: 'number',
          value: 0,
          suffix: '%'
        }
      ]
    }
  ]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await getAppSettings();
      if (response.success && response.data) {
        const settings = response.data;
        setSections(prev => prev.map(section => {
          if (section.id === 'delivery_config') {
            return {
              ...section,
              fields: section.fields.map(field => {
                switch (field.id) {
                  case 'delivery_radius':
                    return { ...field, value: settings.deliveryRadius ?? 0 };
                  case 'delivery_fee':
                    return { ...field, value: settings.deliveryCharges ?? 0 };
                  case 'free_delivery_above':
                    return { ...field, value: settings.freeDeliveryThreshold ?? 0 };
                  case 'service_type':
                    return { ...field, value: settings.serviceType || 'Delivery + Pickup' };
                  default:
                    return field;
                }
              })
            };
          }
          if (section.id === 'payment_discount') {
            return {
              ...section,
              fields: section.fields.map(field => {
                switch (field.id) {
                  case 'discount_enabled':
                    return { ...field, value: settings.onlinePaymentDiscount?.enabled ? 'Yes' : 'No' };
                  case 'discount_percentage':
                    return { ...field, value: settings.onlinePaymentDiscount?.percentage ?? 0 };
                  default:
                    return field;
                }
              })
            };
          }
          return section;
        }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (sectionId: string, fieldId: string, newValue: string | number) => {
    setSections(prev =>
      prev.map(section =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map(field =>
                field.id === fieldId ? { ...field, value: newValue } : field
              )
            }
          : section
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const getFieldValue = (id: string, sId: string = 'delivery_config') =>
        sections.find(s => s.id === sId)?.fields.find(f => f.id === id)?.value;

      const updateData = {
        deliveryRadius: Number(getFieldValue('delivery_radius')),
        deliveryCharges: Number(getFieldValue('delivery_fee')),
        freeDeliveryThreshold: Number(getFieldValue('free_delivery_above')),
        serviceType: String(getFieldValue('service_type')),
        onlinePaymentDiscount: {
          enabled: getFieldValue('discount_enabled', 'payment_discount') === 'Yes',
          percentage: Number(getFieldValue('discount_percentage', 'payment_discount'))
        }
      };

      const response = await updateAppSettings(updateData);

      if (response.success) {
        showToast('Settings saved successfully', 'success');
      } else {
        showToast(response.message || 'Failed to save settings', 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-neutral-50 rounded-xl">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-color)]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-neutral-50/70 relative">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b border-neutral-200/80 z-20 flex-shrink-0 rounded-t-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Delivery Settings</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Manage delivery areas, shipping fees, thresholds, and payment discounts</p>
          </div>
          <div className="text-sm text-neutral-600">
            <span className="text-[var(--primary-color)] font-medium">Home</span> / <span className="text-neutral-900 font-medium">Delivery Settings</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 md:p-8 pb-24">
        <div className="max-w-5xl mx-auto space-y-6">
          {sections.map((section) => (
            <div key={section.id} className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 overflow-hidden transition-shadow hover:shadow-md">
              <div className="px-6 py-4.5 border-b border-neutral-100 bg-neutral-50/40 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-[var(--primary-color)] flex items-center justify-center shrink-0 border border-amber-100">
                  {section.id === 'delivery_config' ? <Truck className="h-5 w-5" /> : <Percent className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-neutral-900">{section.title}</h2>
                  {section.subtitle && (
                    <p className="text-xs text-neutral-500 mt-0.5">{section.subtitle}</p>
                  )}
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {section.fields.map((field) => (
                    <div key={field.id} className="flex flex-col">
                      <label className="text-sm font-semibold text-neutral-800 mb-2">
                        {field.label}
                      </label>
                      <div className="relative">
                        {field.type === 'select' ? (
                          <div className="relative">
                            <select
                              value={field.value}
                              onChange={(e) => handleFieldChange(section.id, field.id, e.target.value)}
                              className="w-full h-11 px-4 pr-10 border border-neutral-300 rounded-xl text-sm bg-neutral-50/50 hover:bg-white focus:bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] appearance-none transition-all cursor-pointer shadow-xs"
                            >
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-11 flex items-center border border-neutral-300 rounded-xl bg-neutral-50/50 hover:bg-white focus-within:bg-white px-3.5 focus-within:ring-2 focus-within:ring-[var(--primary-color)] focus-within:border-[var(--primary-color)] transition-all shadow-xs">
                            {field.prefix && (
                              <span className="text-neutral-500 font-semibold text-sm select-none mr-2.5 shrink-0">
                                {field.prefix}
                              </span>
                            )}
                            <input
                              type={field.type}
                              value={field.value}
                              onChange={(e) => handleFieldChange(section.id, field.id, e.target.value)}
                              className="w-full text-sm bg-transparent text-neutral-800 focus:outline-none h-full px-0 border-none ring-0 outline-none font-medium"
                            />
                            {field.suffix && (
                              <span className="text-neutral-500 text-sm font-semibold select-none ml-2.5 shrink-0">
                                {field.suffix}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-2 leading-relaxed">{field.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-neutral-200/80 px-6 py-4 flex justify-end z-20 flex-shrink-0 shadow-xs">
        <div className="max-w-5xl w-full mx-auto flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`text-white font-semibold py-2.5 px-6 rounded-xl shadow-sm transition-all text-sm sm:text-base flex items-center justify-center min-w-[150px] gap-2 ${
              saving ? 'bg-[var(--primary-color)] cursor-not-allowed opacity-70' : 'bg-[var(--primary-color)] hover:opacity-90 hover:shadow active:scale-[0.99]'
            }`}
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

