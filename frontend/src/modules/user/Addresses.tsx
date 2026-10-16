import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAddresses, deleteAddress, Address } from '../../services/api/customerAddressService';
import Button from '../../components/ui/button';
import { motion } from 'framer-motion';

export default function Addresses() {
    const navigate = useNavigate();
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAddresses = async () => {
        try {
            setLoading(true);
            const res = await getAddresses();
            if (res.success && Array.isArray(res.data)) {
                setAddresses(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch addresses:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAddresses();
    }, []);

    const handleDelete = async (id: string | undefined) => {
        if (!id) return;
        if (!window.confirm('Are you sure you want to delete this address?')) return;

        try {
            await deleteAddress(id);
            setAddresses(addresses.filter(a => a._id !== id));
        } catch (error) {
            console.error('Failed to delete address:', error);
        }
    };

    return (
        <div className="pb-24 md:pb-8 bg-[var(--brand-cream,#FDF9F2)] min-h-screen">
            <div className="px-4 py-4 bg-white/90 backdrop-blur-md border-b border-[var(--brand-border,#E9E2D3)] mb-4 sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-1 text-[var(--brand-ink,#1C2B20)]" aria-label="Back">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <h1 className="font-display text-xl font-bold text-[var(--brand-ink,#1C2B20)]">Saved Addresses</h1>
                </div>
                <Button
                    onClick={() => navigate('/checkout/address')}
                    className="bg-[var(--brand-green,#236B34)] hover:bg-[var(--brand-green-dark,#1B5128)] text-white rounded-full text-xs py-1.5 px-4 h-auto shadow-sm"
                >
                    ADD NEW
                </Button>
            </div>

            <div className="px-4 space-y-4">
                {loading ? (
                    <div className="flex justify-center pt-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-green,#236B34)]"></div>
                    </div>
                ) : addresses.length > 0 ? (
                    <div className="space-y-4">
                        {addresses.map((addr) => (
                            <motion.div
                                key={addr._id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-2xl border border-[var(--brand-border,#E9E2D3)] bg-white relative hover:border-[var(--brand-leaf,#5FA82E)] transition-all shadow-[0_4px_16px_rgba(35,107,52,0.04)]"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--brand-leaf-tint,#EAF5E0)] flex items-center justify-center flex-shrink-0 text-lg">
                                        {addr.type === 'Home' ? '🏠' : addr.type === 'Work' ? '🏢' : '📍'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-display font-bold text-sm text-[var(--brand-ink,#1C2B20)]">{addr.fullName}</h3>
                                            <span className="text-[10px] font-bold bg-[var(--brand-cream-soft,#F6EFE2)] px-2 py-0.5 rounded-full uppercase text-[var(--brand-ink-muted,#5B6B60)]">
                                                {addr.type}
                                            </span>
                                            {addr.isDefault && (
                                                <span className="text-[10px] font-bold bg-[var(--brand-leaf-tint,#EAF5E0)] text-[var(--brand-green,#236B34)] border border-[var(--brand-leaf,#5FA82E)]/30 px-2 py-0.5 rounded-full uppercase">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-[var(--brand-ink-muted,#5B6B60)] mb-1">{addr.address}</p>
                                        <p className="text-sm text-[var(--brand-ink-muted,#5B6B60)] mb-1">{addr.city}, {addr.pincode}</p>
                                        <p className="text-sm text-[var(--brand-ink,#1C2B20)] font-medium">📞 {addr.phone}</p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-[var(--brand-border-light,#F2ECE0)] flex gap-4">
                                    <button
                                        onClick={() => handleDelete(addr._id)}
                                        className="text-xs font-bold text-[var(--brand-error,#D6402F)] hover:text-red-700 uppercase tracking-wider"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => navigate('/checkout/address')}
                                        className="text-xs font-bold text-[var(--brand-green,#236B34)] hover:text-[var(--brand-green-dark,#1B5128)] uppercase tracking-wider"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-[var(--brand-ink-muted,#5B6B60)]">
                        <div className="text-6xl mb-4">📍</div>
                        <h2 className="font-display text-lg font-bold text-[var(--brand-ink,#1C2B20)] mb-2">No saved addresses</h2>
                        <p className="text-sm mb-6 text-[var(--brand-ink-muted,#5B6B60)]">Add an address to start ordering</p>
                        <Button onClick={() => navigate('/checkout/address')} className="bg-[var(--brand-green,#236B34)] text-white hover:bg-[var(--brand-green-dark,#1B5128)] rounded-full px-8 shadow-md shadow-[var(--brand-green,#236B34)]/20">
                            Add New Address
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
