import { useNavigate, Link } from 'react-router-dom';
import { useLayoutEffect, useRef, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getTheme } from '../../../utils/themes';
import { useLocation } from '../../../hooks/useLocation';
import { getCategories } from '../../../services/api/customerProductService';
import { Category } from '../../../types/domain';
import { getCachedHeaderCategoriesPublic, getHeaderCategoriesPublic } from '../../../services/api/headerCategoryService';
import { getIconByName, ICON_LIBRARY, IconDef } from '../../../utils/iconLibrary';
import { useThemeContext } from '../../../context/ThemeContext';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';

gsap.registerPlugin(ScrollTrigger);

interface HomeHeroProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

interface Tab {
  id: string;
  label: string;
  theme?: string;
  icon: React.ReactNode;
}

const getCategoryTabIcon = (c: any) => {
  // 1. If explicit custom image exists and is non-empty, render image
  if (c.image && typeof c.image === 'string' && c.image.trim()) {
    return <img src={c.image} alt={c.name || 'Category'} className="w-full h-full object-contain rounded-md" />;
  }

  // 2. If explicit iconName is set, render SVG from iconLibrary
  if (c.iconName && typeof c.iconName === 'string' && c.iconName.trim()) {
    return (
      <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">
        {getIconByName(c.iconName)}
      </div>
    );
  }

  // 3. Fallback matching by slug/name in ICON_LIBRARY
  const slug = (c.slug || c.id || c.name || '').toLowerCase();
  const matched = ICON_LIBRARY.find(
    (icon: IconDef) => icon.name === slug || icon.tags.some((tag: string) => slug.includes(tag))
  );
  if (matched) {
    return (
      <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">
        {matched.svg}
      </div>
    );
  }

  // 4. Default fallback icon
  return (
    <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">
      {getIconByName('grocery-basket')}
    </div>
  );
};

const ALL_TAB: Tab = {
  id: 'all',
  label: 'All',
  theme: 'all',
  icon: (
    <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">
      {getIconByName('home')}
    </div>
  ),
};

const DEFAULT_HEADER_TABS: Tab[] = [
  ALL_TAB,
  { id: 'grocery', label: 'Grocery', theme: 'grocery', icon: <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">{getIconByName('grocery-basket')}</div> },
  { id: 'winter', label: 'Winter', theme: 'winter', icon: <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">{getIconByName('winter')}</div> },
  { id: 'fashion', label: 'Fashion', theme: 'fashion', icon: <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">{getIconByName('fashion')}</div> },
  { id: 'women', label: 'Women', theme: 'fashion', icon: <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">{getIconByName('womens-wear')}</div> },
  { id: 'beauty', label: 'Beauty', theme: 'beauty', icon: <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">{getIconByName('beauty')}</div> },
  { id: 'household', label: 'Household', theme: 'home', icon: <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">{getIconByName('home')}</div> },
  { id: 'electronics', label: 'Electronics', theme: 'electronics', icon: <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">{getIconByName('electronics')}</div> },
  { id: 'sports', label: 'Sports', theme: 'sports', icon: <div className="w-full h-full flex items-center justify-center text-current [&>svg]:w-7 [&>svg]:h-7 md:[&>svg]:w-9 md:[&>svg]:h-9">{getIconByName('sports')}</div> }
];

interface LanguageDropdownProps {
  language: string;
  setLanguage: (lang: string) => void;
  isSticky: boolean;
  themeKey: string; // Added themeKey prop
}

const LanguageDropdown = ({ language, setLanguage, isSticky, themeKey }: LanguageDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const theme = getTheme(themeKey || 'all'); // Use themeKey here

  // Extract primary color for active state
  // Theme usually returns colors like '#HEX' or 'rgb(...)'.
  // We'll use a fallback or try to use the theme's primary color.
  const activeColor = theme.primary && theme.primary[0] ? theme.primary[0] : '#0d9488'; // Defaulting to teal-like if fail

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const options = [
    { value: 'EN', label: 'English' },
    { value: 'HI', label: 'Hindi' }
  ];

  return (
    <div
      ref={dropdownRef}
      className="relative flex items-center h-full"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 outline-none transition-colors border-r border-gray-300 mr-2 h-5"
      >
        <span
          className="text-xs font-bold leading-none"
          style={{ color: isSticky ? '#6b7280' : '#4b5563' }}
        >
          {language}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isSticky ? "#9ca3af" : "#6b7280"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-lg shadow-xl border border-neutral-100 overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
          <div className="py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setLanguage(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors hover:bg-neutral-50 flex items-center justify-between group`}
                style={{
                  color: language === opt.value ? activeColor : '#374151',
                  backgroundColor: language === opt.value ? 'rgba(0,0,0,0.02)' : 'transparent'
                }}
              >
                <span>{opt.label}</span>
                {language === opt.value && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function HomeHero({ activeTab = 'all', onTabChange }: HomeHeroProps) {
  const { config } = useAppContext();
  const { cart } = useCart();
  const cartItemsCount = cart?.itemCount || 0;
  const cachedHeaderCategories = getCachedHeaderCategoriesPublic() || [];
  const [headerCategories, setHeaderCategories] = useState<any[]>(cachedHeaderCategories);
  const [tabs, setTabs] = useState<Tab[]>(() => {
    if (!cachedHeaderCategories.length) {
      return DEFAULT_HEADER_TABS;
    }

    const mapped = cachedHeaderCategories.map((c) => ({
      id: c.slug,
      label: c.name,
      theme: c.theme || c.slug,
      icon: getCategoryTabIcon(c)
    }));

    const hasAllTab = mapped.some((tab) => tab.id === 'all');
    if (hasAllTab) {
      const allTabIndex = mapped.findIndex((tab) => tab.id === 'all');
      const allTab = mapped[allTabIndex];
      const otherTabs = mapped.filter((_, i) => i !== allTabIndex);
      return [allTab, ...otherTabs];
    }

    return [ALL_TAB, ...mapped];
  });

  useEffect(() => {
    const fetchHeaderCategories = async (force = false) => {
      try {
        const cats = await getHeaderCategoriesPublic(true, force);
        if (cats && cats.length > 0) {
          setHeaderCategories(cats);
          const mapped = cats.map(c => ({
            id: c.slug,
            label: c.name,
            theme: c.theme || c.slug,
            icon: getCategoryTabIcon(c)
          }));

          // Check if a tab with id 'all' is already provided by the API
          const hasAllTab = mapped.some(tab => tab.id === 'all');

          if (hasAllTab) {
            // Find the 'all' tab and ensure it's at the beginning
            const allTabIndex = mapped.findIndex(tab => tab.id === 'all');
            const allTab = mapped[allTabIndex];
            const otherTabs = mapped.filter((_, i) => i !== allTabIndex);
            setTabs([allTab, ...otherTabs]);
          } else {
            setTabs([ALL_TAB, ...mapped]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch header categories', error);
      }
    };
    fetchHeaderCategories(true);

    const handleUpdate = () => fetchHeaderCategories(true);
    window.addEventListener('focus', handleUpdate);
    window.addEventListener('header_categories_updated', handleUpdate);
    return () => {
      window.removeEventListener('focus', handleUpdate);
      window.removeEventListener('header_categories_updated', handleUpdate);
    };
  }, []);

  const { themeKey: currentThemeKey } = useThemeContext();

  const navigate = useNavigate();
  const { location: userLocation, requestLocation, isLocationLoading } = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  const topSectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isSticky, setIsSticky] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [language, setLanguage] = useState('EN');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollLimits = () => {
    const container = tabsContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollLimits, { passive: true });
      checkScrollLimits();
      const timers = [
        setTimeout(checkScrollLimits, 100),
        setTimeout(checkScrollLimits, 300),
        setTimeout(checkScrollLimits, 500),
        setTimeout(checkScrollLimits, 1000),
      ];
      window.addEventListener('resize', checkScrollLimits);
      return () => {
        container.removeEventListener('scroll', checkScrollLimits);
        window.removeEventListener('resize', checkScrollLimits);
        timers.forEach(t => clearTimeout(t));
      };
    }
  }, [tabs]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const container = tabsContainerRef.current;
    if (container) {
      const scrollAmount = container.clientWidth * 0.6;
      const targetScroll = container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      container.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  };

  // Format location display text
  const locationDisplayText = useMemo(() => {
    if (userLocation) {
      if (userLocation.address) {
        const parts = userLocation.address.split(',');
        // Extract the main part of the address (e.g., building, shop, or locality name)
        let mainAddr = parts[0]?.trim() || '';
        // If it's too short (like a building/room number), append the second part
        if (mainAddr.length < 6 && parts[1]) {
          mainAddr = `${mainAddr}, ${parts[1].trim()}`;
        }
        return mainAddr;
      } else if (userLocation.city && userLocation.state) {
        return `${userLocation.city}, ${userLocation.state}`;
      } else if (userLocation.city) {
        return userLocation.city;
      }
      return '';
    }
    return '';
  }, [userLocation]);

  const [categories, setCategories] = useState<Category[]>([]);

  // Fetch categories for search suggestions
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await getCategories();
        let apiCategories = [];
        if (response.success && response.data) {
          apiCategories = response.data.map((c: any) => ({
            ...c,
            id: c._id || c.id
          }));
        }

        // Merge with Seller Categories from localStorage. Only Active
        // seller-own categories feed customer search suggestions — Inactive
        // ones must stay hidden from the storefront. Missing `status` is
        // treated as Active for back-compat.
        const sellerPermissions = JSON.parse(localStorage.getItem('seller_category_permissions') || '{}');
        const sellerCatsStorage = localStorage.getItem('seller_own_categories'); // Using simplified key for demo
        let sellerCategories: any[] = [];

        if (sellerCatsStorage) {
             const parsed = JSON.parse(sellerCatsStorage) as any[];
             sellerCategories = parsed.filter(
                 (c) => c && (c.status === undefined || c.status === 'Active')
             );
        }

        // In a real scenario we would filter by permission, but for demo we just show created ones
        // const allowedSellerCategories = sellerCategories.filter(...)

        setCategories([...apiCategories, ...sellerCategories]);
      } catch (error) {
        console.error("Error fetching categories for suggestions:", error);
      }
    };
    fetchCategories();
  }, []);

  // Search suggestions
  const searchSuggestions = useMemo(() => {
    if (activeTab === 'all' && categories.length > 0) {
      return categories.slice(0, 8).map(c => c.name.toLowerCase());
    }
    switch (activeTab) {
      case 'wedding': return ['gift packs', 'dry fruits', 'sweets', 'decorative items', 'wedding cards', 'return gifts'];
      case 'winter': return ['woolen clothes', 'caps', 'gloves', 'blankets', 'heater', 'winter wear'];
      case 'electronics': return ['chargers', 'cables', 'power banks', 'earphones', 'phone cases', 'screen guards'];
      case 'beauty': return ['lipstick', 'makeup', 'skincare', 'kajal', 'face wash', 'moisturizer'];
      case 'grocery': return ['atta', 'milk', 'dal', 'rice', 'oil', 'vegetables'];
      case 'fashion': return ['clothing', 'shoes', 'accessories', 'watches', 'bags', 'jewelry'];
      case 'sports': return ['cricket bat', 'football', 'badminton', 'fitness equipment', 'sports shoes', 'gym wear'];
      default: return ['atta', 'milk', 'dal', 'coke', 'bread', 'eggs', 'rice', 'oil'];
    }
  }, [activeTab, categories]);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(hero, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
    }, hero);
    return () => ctx.revert();
  }, []);

  // Animate search suggestions
  useEffect(() => {
    setCurrentSearchIndex(0);
    const interval = setInterval(() => {
      setCurrentSearchIndex((prev) => (prev + 1) % searchSuggestions.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [searchSuggestions.length, activeTab]);

  // Handle scroll for sticky behavior using Intersection detection via BoundingRect
  useEffect(() => {
    const handleScroll = () => {
      if (topSectionRef.current) {
        // We check the bottom position of the top section (Logo).
        // When it moves out of view (becomes <= 0 or small offset), we stick the header.
        const topSectionBottom = topSectionRef.current.getBoundingClientRect().bottom;
        // e.g. if section height is ~60px, transition as it scrolls
        const threshold = 10; // slightly before full exit

        setIsSticky(topSectionBottom <= threshold);

        // Optional: Progress logic if you want gradient transition
        const topSectionHeight = topSectionRef.current.offsetHeight || 60;
        const p = Math.min(Math.max(1 - (topSectionBottom / topSectionHeight), 0), 1);
        setScrollProgress(p);
      }
    };

    // Attach to MAIN container because that is what scrolls
    const main = document.querySelector('main');
    if (main) {
      main.addEventListener('scroll', handleScroll, { passive: true });
    }
    // Also attach to window just in case usage changes
    window.addEventListener('scroll', handleScroll, { passive: true });

    handleScroll(); // Initial check

    return () => {
      if (main) main.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Update sliding indicator
  useEffect(() => {
    const updateIndicator = (shouldScroll = true) => {
      const activeTabButton = tabRefs.current.get(activeTab);
      const container = tabsContainerRef.current;
      if (activeTabButton && container) {
        try {
          const left = activeTabButton.offsetLeft;
          const width = activeTabButton.offsetWidth;
          if (width > 0) setIndicatorStyle({ left, width });

          if (shouldScroll) {
            const containerScrollLeft = container.scrollLeft;
            const containerWidth = container.offsetWidth;
            const buttonRight = left + width;
            const scrollPadding = 20;
            let targetScrollLeft = containerScrollLeft;

            if (left < containerScrollLeft + scrollPadding) {
              targetScrollLeft = left - scrollPadding;
            } else if (buttonRight > containerScrollLeft + containerWidth - scrollPadding) {
              targetScrollLeft = buttonRight - containerWidth + scrollPadding;
            }

            if (targetScrollLeft !== containerScrollLeft) {
              container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' });
            }
          }
        } catch (error) { console.warn(error); }
      }
    };
    updateIndicator(true);
    const t1 = setTimeout(() => updateIndicator(true), 50);
    const t2 = setTimeout(() => updateIndicator(true), 150);
    const t3 = setTimeout(() => updateIndicator(false), 300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [activeTab]);

  const handleTabClick = (tabId: string) => {
    const mainElement = document.querySelector('main');
    if (mainElement instanceof HTMLElement) {
      mainElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    onTabChange?.(tabId);
  };

  const theme = getTheme(currentThemeKey);
  const heroGradient = `linear-gradient(to bottom right, ${theme.primary[0]}, ${theme.primary[1]}, ${theme.primary[2]})`;

  // Render the sticky content (Search + Tabs)
  const renderStickyContent = () => (
    <div
      ref={stickyRef}
      className={isSticky ? 'sticky top-0 md:top-[56px] left-0 right-0 z-[99] shadow-sm pb-0 animate-fade-in' : 'relative z-50'}
      style={{
        backgroundColor: '#ffffff',
        transition: 'background-color 0.3s ease',
      }}
    >


      <div className={`${isSticky ? 'pt-3 pb-1 md:pt-4' : 'border-b border-neutral-200 mt-0.5 md:mt-0 pt-3 pb-1.5 md:pt-4'} w-full flex items-center justify-center`}>
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto px-4 md:px-6 gap-1 md:gap-2">
          {/* Left Arrow Button */}
          <div
            className="hidden md:flex flex-shrink-0 items-center justify-center transition-all duration-300"
          >
            <button
              onClick={() => scrollTabs('left')}
              className="w-10 h-10 rounded-full bg-neutral-600/80 hover:bg-neutral-800 text-white flex items-center justify-center transition-all duration-300 shadow-md active:scale-95"
              type="button"
              aria-label="Scroll left"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          </div>

          <div
            ref={tabsContainerRef}
            className="relative flex-1 flex items-center gap-2.5 md:gap-3.5 overflow-x-auto scrollbar-hide scroll-smooth py-1 px-0.5"
            onWheel={(e) => {
              // Web view: mouse wheel is vertical; use it to scroll categories horizontally.
              if (window.innerWidth >= 768 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const themeObj = tab.theme ? getTheme(tab.theme) : null;
              const activeColor = tab.theme?.startsWith('#') 
                ? tab.theme 
                : (themeObj?.primary?.[0] || '#163F2E');

              return (
                <button
                  key={tab.id}
                  ref={(el) => { if (el) tabRefs.current.set(tab.id, el); else tabRefs.current.delete(tab.id); }}
                  onClick={() => handleTabClick(tab.id)}
                  style={isActive && tab.theme?.startsWith('#') ? { borderColor: activeColor } : undefined}
                  className={`flex-shrink-0 flex flex-col items-center justify-between w-[68px] h-[78px] md:w-[96px] md:h-[104px] p-1 md:p-2 rounded-xl transition-all duration-200 group border cursor-pointer ${
                    isActive
                      ? 'border-[#163F2E] md:border-[#34d399] bg-[#e6f7f2] shadow-sm text-[#059669]'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 shadow-[0_1px_2px_rgba(0,0,0,0.03)] text-neutral-600 hover:text-neutral-900'
                  }`}
                  type="button"
                >
                  <div className="w-full flex-1 flex items-center justify-center overflow-hidden p-0">
                    <div 
                      style={isActive && tab.theme?.startsWith('#') ? { color: activeColor } : undefined}
                      className="w-[48px] h-[48px] md:w-[68px] md:h-[68px] flex items-center justify-center flex-shrink-0 [&>svg]:w-full [&>svg]:h-full [&>img]:w-full [&>img]:h-full [&>img]:object-contain transition-transform duration-200 group-hover:scale-105"
                    >
                      {tab.icon}
                    </div>
                  </div>
                  <span
                    style={isActive && tab.theme?.startsWith('#') ? { color: activeColor } : undefined}
                    className={`text-[9.5px] md:text-[12.5px] leading-tight text-center font-sans truncate w-full px-0.5 ${
                      isActive ? 'font-bold text-[#059669]' : 'font-medium text-neutral-600 group-hover:text-neutral-900'
                    }`}
                  >
                    {tab.label.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Right Arrow Button */}
          <div
            className="hidden md:flex flex-shrink-0 items-center justify-center transition-all duration-300"
          >
            <button
              onClick={() => scrollTabs('right')}
              className="w-10 h-10 rounded-full bg-[#1e3a8a]/80 hover:bg-[#1e3a8a] text-white flex items-center justify-center transition-all duration-300 shadow-md active:scale-95"
              type="button"
              aria-label="Scroll right"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
      {isSticky && <div className="h-1.5 w-full bg-white" />}
    </div>
  );
  const { isAuthenticated, user, logout: authLogout } = useAuth();

  return (
    <div
      ref={heroRef}
      className="relative z-20"
      style={{ backgroundColor: '#ffffff', paddingBottom: 0, marginBottom: 0 }}
    >
      <div className="md:hidden bg-white pb-2 pt-2.5 px-4 flex flex-col gap-2.5 border-b border-neutral-100">
        {/* Row 1: Logo & Multivendor Text (Left) + Lang & Notif (Right) */}
        <div className="flex items-center justify-between">
          {/* Logo & Multivendor Text */}
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-full overflow-hidden border border-neutral-200 bg-white flex items-center justify-center p-0.5 shadow-sm">
              <img
                src={config?.appLogo || "/assets/unnati_logo.png"}
                alt="Multivendor"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-extrabold tracking-tight leading-none text-[#163F2E]">
                Multivendor
              </span>
              <span className="text-base font-extrabold text-[#d97706] mt-0.5 ml-2.5 opacity-90 leading-none">
                E-Commerce
              </span>
            </div>
          </div>

          {/* Lang & Notif Icons */}
          <div className="flex items-center gap-2.5">
            {/* Language / Hamburger Button */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="w-8 h-8 rounded-full border border-neutral-200/80 flex items-center justify-center hover:bg-neutral-50 active:scale-95 transition-all text-neutral-600 shadow-sm"
              aria-label="Open menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </button>

            {/* Notification Bell */}
            <Link
              to="/account"
              className="w-8 h-8 rounded-full border border-neutral-200/80 flex items-center justify-center hover:bg-neutral-50 active:scale-95 transition-all text-neutral-600 shadow-sm relative"
              aria-label="Notifications"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {/* Green notification badge as requested */}
              <span className="absolute -top-0.5 -right-1 bg-[#163F2E] text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-sm">
                3
              </span>
            </Link>
          </div>
        </div>

        {/* Row 2: Deliver To dropdown (Half Width) */}
        {locationDisplayText && (
          <div
            className="max-w-[65%] border border-neutral-100/90 rounded-2xl py-2 px-3 flex items-center justify-between bg-white cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.015)] active:bg-neutral-50 transition-colors"
            onClick={() => {
              if (!isLocationLoading) {
                requestLocation();
              }
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 text-[#d97706]">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#707c97] leading-none">
                  DELIVER TO
                </span>
                <span className="text-[12px] font-extrabold text-[#111827] truncate max-w-[150px] mt-0.5 leading-tight">
                  {isLocationLoading ? 'Updating Location...' : locationDisplayText}
                </span>
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 text-neutral-400 ml-2">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Row 3: Capsule Search Bar (Less Compact / More Spaced out) */}
        <div
          onClick={() => navigate('/search')}
          className="w-full rounded-full py-2 px-3.5 flex items-center justify-between cursor-pointer border border-[#163F2E] bg-white shadow-[0_2px_8px_rgba(22,63,46,0.06)] active:scale-[0.99] transition-all overflow-hidden box-border"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <div className="flex-1 relative h-4 overflow-hidden min-w-0">
              {searchSuggestions.map((suggestion, index) => {
                const isActive = index === currentSearchIndex;
                const prevIndex = (currentSearchIndex - 1 + searchSuggestions.length) % searchSuggestions.length;
                const isPrev = index === prevIndex;
                return (
                  <div
                    key={suggestion}
                    className={`absolute inset-0 flex items-center transition-all duration-500 ${isActive ? 'translate-y-0 opacity-100' : isPrev ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0'}`}
                  >
                    <span className="text-xs text-neutral-400 font-sans truncate">
                      Search &quot;Atta, Rice, Oil, Maggi...&quot;
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0 ml-1.5">
            {/* Mic Icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            {/* Scanner Barcode Icon (Dark Green) */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#163F2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" rx="1" />
            </svg>
          </div>
        </div>
      </div>

      {/* Hamburger Menu Drawer */}
      {createPortal(
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 220 }}
              className="fixed inset-0 w-full h-full bg-white z-[1001] md:hidden flex flex-col font-sans overflow-hidden px-6 py-6"
            >
              {/* Top Header Row (Logo + Close) */}
              <div className="flex items-center justify-between pb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1">
                    <img src={config?.appLogo || "/assets/unnati_logo.png"} className="h-7 w-auto object-contain rounded-md" alt="Logo" />
                  </div>
                  <span className="text-sm font-bold text-neutral-800">{config?.appName || 'Ecommerce Stores'}</span>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors shadow-sm active:scale-90"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Eden-Style Search Bar */}
              <div className="mb-6 relative">
                <input
                  type="text"
                  readOnly
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate('/search');
                  }}
                  placeholder="Search..."
                  className="w-full bg-neutral-50/80 border border-neutral-100 rounded-xl py-2.5 pl-10 pr-4 text-sm text-neutral-500 focus:outline-none placeholder:text-neutral-400 font-medium cursor-pointer"
                />
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </div>

            {/* Eden-Style Navigation Lists */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6">

              {/* Group 1: General Navigation */}
              <div className="flex flex-col gap-1.5">
                {[
                  { to: '/', label: 'Home', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                  )},
                  { to: '/order-again', label: 'Order Again', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                    </svg>
                  )},
                  { to: '/brands', label: 'Brands', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  )},
                  { to: '/video-finds', label: 'Video Finds', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                      <line x1="7" y1="2" x2="7" y2="22"></line>
                      <line x1="17" y1="2" x2="17" y2="22"></line>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <line x1="2" y1="7" x2="7" y2="7"></line>
                      <line x1="2" y1="17" x2="7" y2="17"></line>
                      <line x1="17" y1="17" x2="22" y2="17"></line>
                      <line x1="17" y1="7" x2="22" y2="7"></line>
                    </svg>
                  )},
                  { to: '/categories', label: 'Categories', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                  )}
                ].map((item) => {
                  const isCurrent = item.to === '/' ? (window.location.pathname === '/' || window.location.pathname === '/user/home') : window.location.pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                        isCurrent
                          ? 'bg-[var(--customer-primary)] text-white shadow-sm'
                          : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Separator Line */}
              <div className="border-t border-neutral-100 my-1" />

              {/* Group 2: Account & Settings */}
              <div className="flex flex-col gap-1.5">
                {[
                  { to: '/account', label: 'Profile Settings', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  )},
                  { to: '/orders', label: 'My Order History', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                  )},
                  { to: '/wishlist', label: 'My Wishlist', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                  )},
                  { to: '/address-book', label: 'Saved Addresses', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  )}
                ].map((item) => {
                  const isCurrent = window.location.pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                        isCurrent
                          ? 'bg-[var(--customer-primary)] text-white shadow-sm'
                          : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                {isAuthenticated && (
                  <button
                    onClick={() => {
                      authLogout();
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 text-red-500 hover:bg-red-50 hover:text-red-600 text-left"
                  >
                    <span className="flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                    </span>
                    <span>Logout</span>
                  </button>
                )}
              </div>

            </div>

            {/* Eden-Style Bottom Profile Block */}
            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between gap-3 mt-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[var(--customer-primary-alpha-10)] border border-[var(--customer-primary)] flex items-center justify-center font-bold text-sm text-[var(--customer-primary-dark)] flex-shrink-0">
                  {isAuthenticated && user?.name ? user.name.charAt(0).toUpperCase() : 'G'}
                </div>
                <div className="min-w-0 text-left">
                  <span className="text-sm font-bold text-neutral-800 block truncate leading-none mb-1">
                    {isAuthenticated ? user?.name : 'Guest User'}
                  </span>
                  <span className="text-xs text-neutral-400 block truncate leading-none">
                    {isAuthenticated ? (user?.phone || user?.email) : 'Welcome to Store'}
                  </span>
                </div>
              </div>

              {isAuthenticated ? (
                <button
                  onClick={() => {
                    authLogout();
                    setIsMenuOpen(false);
                  }}
                  className="w-9 h-9 rounded-xl border border-red-100 hover:bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0 transition-colors shadow-sm active:scale-95"
                  title="Logout"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="px-4 py-2 bg-[var(--customer-primary)] hover:bg-[var(--customer-primary-dark)] text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {renderStickyContent()}
    </div>
  );
}
