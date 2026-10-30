import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getProfile, updateProfile, CustomerProfile } from '../../services/api/customerService';
import { getHeaderCategoriesPublic } from '../../services/api/headerCategoryService';
import { getTheme } from '../../utils/themes';

export default function Account() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout: authLogout, updateUser } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGstModal, setShowGstModal] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [allThemeKey, setAllThemeKey] = useState('all');

  // Edit Profile States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDob, setEditDob] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadAllTheme = async () => {
      try {
        const cats = await getHeaderCategoriesPublic();
        const allCat = Array.isArray(cats) ? cats.find((c: any) => c?.slug === 'all') : null;
        if (allCat?.theme) setAllThemeKey(allCat.theme);
      } catch {
        // keep default
      }
    };

    void loadAllTheme();
  }, []);

  const withAlpha = (color: string, alpha: number) => {
    const c = (color || '').trim();
    if (!c) return c;

    const hex = c.startsWith('#') ? c.slice(1) : '';
    if (hex.length === 3 || hex.length === 6) {
      const full = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const rgb = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;

    const rgba = c.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)$/i);
    if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${alpha})`;

    return c;
  };

  const allTheme = getTheme(allThemeKey || 'all');
  const allBase = allTheme?.primary?.[0] || 'var(--brand-leaf-tint, #EAF5E0)';
  // Soft brand gradient header fading to brand cream
  const accountHeaderGradient = `linear-gradient(to bottom, ${withAlpha(allBase, 0.22)}, ${withAlpha(allBase, 0.06)}, var(--brand-cream, #FDF9F2))`;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await getProfile();
        if (response.success && response.data) {
          setProfile(response.data);
          setEditName(response.data.name || '');
          setEditEmail(response.data.email || '');
          if (response.data.dateOfBirth) {
            try {
              setEditDob(new Date(response.data.dateOfBirth).toISOString().split('T')[0]);
            } catch {
              setEditDob('');
            }
          }
        } else {
          setError('Failed to load profile');
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || 'Failed to load profile';
        const statusCode = err.response?.status;

        // If it's an auth error or customer not found, log out the user
        if (statusCode === 401 || statusCode === 404 || errorMessage.toLowerCase().includes('not found')) {
          authLogout();
          setError(''); // Clear error to show login/signup UI
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user, navigate, authLogout]);

  // Open edit modal if ?edit=true is present in URL
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && user) {
      setShowEditModal(true);
    }
  }, [searchParams, user]);

  const openEditModal = () => {
    setEditName(profile?.name || user?.name || '');
    setEditEmail(profile?.email || user?.email || '');
    if (profile?.dateOfBirth) {
      try {
        setEditDob(new Date(profile.dateOfBirth).toISOString().split('T')[0]);
      } catch {
        setEditDob('');
      }
    }
    setProfileMsg(null);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setProfileMsg(null);
    if (searchParams.get('edit')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('edit');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setProfileMsg({ type: 'error', text: 'Name is required' });
      return;
    }
    try {
      setSavingProfile(true);
      setProfileMsg(null);
      const res = await updateProfile({
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        dateOfBirth: editDob || undefined,
      });

      if (res.success && res.data) {
        setProfile(res.data);
        if (updateUser && user) {
          updateUser({
            ...user,
            name: res.data.name,
            email: res.data.email,
          });
        }
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
        setTimeout(() => {
          closeEditModal();
        }, 1000);
      } else {
        setProfileMsg({ type: 'error', text: res.message || 'Failed to update profile' });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update profile';
      setProfileMsg({ type: 'error', text: msg });
    } finally {
      setSavingProfile(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const handleLogout = () => {
    authLogout();
    navigate('/login');
  };

  const handleGstSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowGstModal(false);
  };

  // Show login/signup prompt for unregistered users
  if (!user) {
    return (
      <div className="pb-24 md:pb-8 bg-[var(--brand-cream,#FDF9F2)] min-h-screen md:flex md:items-center md:justify-center md:py-12">
        <div className="w-full md:max-w-md md:bg-white md:rounded-2xl md:shadow-xl md:border md:border-[var(--brand-border,#E9E2D3)] md:overflow-hidden">
          <div className="pb-6 md:pb-8 pt-4 md:pt-8" style={{ background: accountHeaderGradient }}>
            <div className="px-4 md:px-6">
              <button onClick={() => navigate(-1)} className="mb-4 text-neutral-900 hover:opacity-80 transition-opacity" aria-label="Back">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className="flex flex-col items-center mb-4 md:mb-6">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-[var(--brand-leaf-tint,#EAF5E0)] flex items-center justify-center mb-3 md:mb-4 border-2 border-white shadow-sm">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-[var(--brand-green,#236B34)] md:w-12 md:h-12">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h1 className="font-display text-xl md:text-2xl font-bold text-[var(--brand-ink,#1C2B20)] mb-2">Welcome!</h1>
                <p className="text-sm md:text-base text-[var(--brand-ink-muted,#5B6B60)] text-center px-4">
                  Login or sign up to access your profile, orders, and more
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 md:px-8 pb-8 mt-6 relative z-10">
            <div className="space-y-3">
              <Link
                to="/login"
                className="block w-full text-center py-3.5 rounded-xl font-semibold text-base bg-[var(--brand-green,#236B34)] text-white hover:bg-[var(--brand-green-dark,#1B5128)] transition-colors shadow-lg shadow-[var(--brand-green,#236B34)]/20"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="block w-full text-center py-3.5 rounded-xl font-semibold text-base bg-white text-[var(--brand-green,#236B34)] border-2 border-[var(--brand-green,#236B34)] hover:bg-[var(--brand-leaf-tint,#EAF5E0)] transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--customer-primary-dark)] mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--customer-primary-dark)] mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-[var(--customer-primary-dark)] text-white rounded">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayName = profile?.name || user?.name || 'User';
  const displayPhone = profile?.phone || user?.phone || '';
  const displayEmail = profile?.email || user?.email || '';
  const displayDateOfBirth = profile?.dateOfBirth;

  return (
    <div className="pb-24 md:pb-8 bg-[var(--brand-cream,#FDF9F2)] min-h-screen">
      <div className="pb-6 md:pb-8 pt-4 md:pt-6" style={{ background: accountHeaderGradient }}>
        <div className="max-w-4xl mx-auto px-4 md:px-0">
          <button onClick={() => navigate(-1)} className="mb-4 text-neutral-900 hover:opacity-80 transition-opacity" aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="flex flex-col items-center mb-4 md:mb-6">
            <div className="relative mb-3 md:mb-4">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-[var(--brand-leaf-tint,#EAF5E0)] flex items-center justify-center border-2 border-white shadow-sm font-display font-extrabold text-2xl md:text-3xl text-[var(--brand-green,#236B34)]">
                {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <button
                type="button"
                onClick={openEditModal}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--brand-green,#236B34)] text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
                title="Edit Profile"
                aria-label="Edit Profile"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <h1 className="font-display text-xl md:text-2xl font-bold text-[var(--brand-ink,#1C2B20)]">{displayName}</h1>
              <button
                type="button"
                onClick={openEditModal}
                className="p-1 rounded-full text-[var(--brand-green,#236B34)] hover:bg-white/60 transition-colors"
                title="Edit Profile"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col items-center gap-1 md:gap-1.5 text-xs md:text-sm text-[var(--brand-ink-muted,#5B6B60)]">
              {displayPhone && (
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{displayPhone}</span>
                </div>
              )}
              {displayEmail && (
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <span>{displayEmail}</span>
                </div>
              )}
              {displayDateOfBirth && (
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" /><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  <span>{formatDate(displayDateOfBirth)}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={openEditModal}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-[var(--brand-border,#E9E2D3)] text-[var(--brand-green,#236B34)] hover:bg-[var(--brand-leaf-tint,#EAF5E0)] transition-all shadow-sm"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 -mt-4 md:-mt-6 mb-4 md:mb-6">
        <div className="grid grid-cols-2 md:grid-cols-2 gap-2.5 md:gap-6 max-w-4xl md:mx-auto">
          <button onClick={() => navigate('/orders')} className="bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] p-3 md:p-4 hover:shadow-md hover:border-[var(--brand-leaf,#5FA82E)] transition-all text-center outline-none shadow-[0_4px_16px_rgba(35,107,52,0.04)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-1.5 md:mb-2 text-[var(--brand-green,#236B34)] md:w-6 md:h-6"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M16 10a4 4 0 0 1-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div className="text-[11px] md:text-xs font-semibold text-[var(--brand-ink,#1C2B20)]">Your orders</div>
          </button>
          <button
            onClick={() => navigate('/faq')}
            className="bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] p-3 md:p-4 hover:shadow-md hover:border-[var(--brand-leaf,#5FA82E)] transition-all text-center outline-none shadow-[0_4px_16px_rgba(35,107,52,0.04)]"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto mb-1.5 md:mb-2 text-[var(--brand-green,#236B34)] md:w-6 md:h-6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div className="text-[11px] md:text-xs font-semibold text-[var(--brand-ink,#1C2B20)]">Need help?</div>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full px-4 py-2.5 md:px-0">
        <h2 className="font-display text-xs font-bold text-[var(--brand-ink,#1C2B20)] mb-2 uppercase tracking-wide">Your information</h2>
        <div className="bg-white rounded-2xl border border-[var(--brand-border,#E9E2D3)] overflow-hidden divide-y divide-[var(--brand-border-light,#F2ECE0)] shadow-[0_4px_16px_rgba(35,107,52,0.04)]">
          <button onClick={openEditModal} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--brand-cream-soft,#F6EFE2)] transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--brand-green,#236B34)]">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-left">
                <span className="text-[13px] font-medium text-[var(--brand-ink,#1C2B20)] block">Profile Settings</span>
                <span className="text-[11px] text-[var(--brand-ink-muted,#5B6B60)] block">Name, Email, Date of Birth</span>
              </div>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => navigate('/address-book')} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--brand-cream-soft,#F6EFE2)] transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--brand-green,#236B34)]"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-[13px] font-medium text-[var(--brand-ink,#1C2B20)]">Address Book</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => navigate('/wishlist')} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--brand-cream-soft,#F6EFE2)] transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--brand-orange,#F97316)]"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-[13px] font-medium text-[var(--brand-ink,#1C2B20)]">Your Wishlist</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => setShowGstModal(true)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--brand-cream-soft,#F6EFE2)] transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--brand-green,#236B34)]"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-[13px] font-medium text-[var(--brand-ink,#1C2B20)]">GST Details</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => navigate('/support')} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--brand-cream-soft,#F6EFE2)] transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--brand-green,#236B34)]"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line x1="8" y1="13" x2="13" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <span className="text-[13px] font-medium text-[var(--brand-ink,#1C2B20)]">Help &amp; Support (raise a ticket)</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={() => navigate('/about-us')} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--brand-cream-soft,#F6EFE2)] transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--brand-green,#236B34)]"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="2" /><line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="2" /></svg>
              <span className="text-[13px] font-medium text-[var(--brand-ink,#1C2B20)]">About Us</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button onClick={handleLogout} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-red-50/50 transition-colors">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--brand-error,#D6402F)]"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <span className="text-[13px] font-medium text-[var(--brand-error,#D6402F)]">Log Out</span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeEditModal} />
          <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50 animate-in slide-in-from-bottom md:zoom-in-95 duration-200 pointer-events-none p-0 md:p-4">
            <div className="bg-white rounded-t-[28px] md:rounded-2xl border-t md:border border-[var(--brand-border,#E9E2D3)] shadow-2xl w-full max-w-lg mx-auto p-5 sm:p-6 relative pointer-events-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-[var(--brand-border-light,#F2ECE0)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[var(--brand-leaf-tint,#EAF5E0)] flex items-center justify-center text-[var(--brand-green,#236B34)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-[var(--brand-ink,#1C2B20)]">Edit Profile</h3>
                    <p className="text-xs text-[var(--brand-ink-muted,#5B6B60)]">Update your personal account information</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500 transition-colors"
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {profileMsg && (
                <div className={`mb-4 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  <span>{profileMsg.type === 'success' ? '✓' : '⚠️'}</span>
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--brand-ink,#1C2B20)] mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full rounded-xl border border-[var(--brand-border,#E9E2D3)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-leaf,#5FA82E)]/30 focus:border-[var(--brand-green,#236B34)] transition-all bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--brand-ink,#1C2B20)] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-[var(--brand-border,#E9E2D3)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-leaf,#5FA82E)]/30 focus:border-[var(--brand-green,#236B34)] transition-all bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--brand-ink,#1C2B20)] mb-1">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={displayPhone || ''}
                      disabled
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-500 cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-neutral-400 bg-neutral-200 px-2 py-0.5 rounded">
                      Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">Mobile number is linked to your login session</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--brand-ink,#1C2B20)] mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    className="w-full rounded-xl border border-[var(--brand-border,#E9E2D3)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-leaf,#5FA82E)]/30 focus:border-[var(--brand-green,#236B34)] transition-all bg-white"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={savingProfile}
                    className="flex-1 rounded-xl border border-neutral-200 py-3 text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile || !editName.trim()}
                    className="flex-1 rounded-xl bg-[var(--brand-green,#236B34)] text-white py-3 text-xs font-bold hover:bg-[var(--brand-green-dark,#1B5128)] disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    {savingProfile ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {showGstModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowGstModal(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-500 ease-out">
            <div className="bg-white rounded-t-[32px] border-t border-[var(--brand-border,#E9E2D3)] shadow-2xl max-w-lg mx-auto p-6 pt-10 relative">
              <button onClick={() => setShowGstModal(false)} className="absolute -top-12 right-4 w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
              <div className="text-center">
                <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-[var(--brand-leaf-tint,#EAF5E0)] border border-[var(--brand-border,#E9E2D3)] flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-10 h-10 text-[var(--brand-green,#236B34)]" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="3" width="14" height="18" rx="2" ry="2" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></svg>
                </div>
                <h3 className="font-display text-xl font-bold text-[var(--brand-ink,#1C2B20)] mb-2">Add GST Details</h3>
                <p className="text-[13px] text-[var(--brand-ink-muted,#5B6B60)] mb-8 px-4">Identify your business to get a GST invoice on your business purchases.</p>
                <form onSubmit={handleGstSubmit} className="space-y-4">
                  <input type="text" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} placeholder="Enter GST Number" className="w-full rounded-xl border border-[var(--brand-border,#E9E2D3)] px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-leaf,#5FA82E)]/30 focus:border-[var(--brand-green,#236B34)] transition-all" />
                  <button type="submit" disabled={!gstNumber.trim()} className="w-full rounded-xl bg-[var(--brand-green,#236B34)] text-white font-bold py-4 hover:bg-[var(--brand-green-dark,#1B5128)] disabled:opacity-50 transition-colors shadow-lg shadow-[var(--brand-green,#236B34)]/20 uppercase tracking-wider text-sm">Save Details</button>
                </form>
                <p className="mt-6 text-[11px] text-neutral-400">By continuing, you agree to our <span className="underline">Terms & Conditions</span></p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
