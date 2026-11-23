"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CarFront, Heart, Search, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, BadgeCheck, ShieldCheck, Truck, Tag, Sparkles, Plus, UserRound, LogOut, X, Menu, ShoppingBag, Check, LoaderCircle, House, Laptop, Shirt, Smartphone, Upload, Pencil, Trash2, MessageCircle, Star, Megaphone, ExternalLink, Snowflake, Copy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES, MAX_LISTING_IMAGES } from "@/lib/image-constraints";
import { uploadListingImages } from "@/lib/client-image-upload";
import { formatPrice } from "@/lib/format-price";
import { getWhatsAppSupportUrl, useI18n } from "@/lib/i18n";
import { compareListings } from "@/lib/listing-sort";
import type { VipRejectionNotification } from "@/lib/message-notifications";
import { VIP_DURATION_HOURS, VIP_PRICE_TETRI, VIP_RECIPIENT_IBAN } from "@/lib/vip";
import { LanguageSwitcher } from "@/components/language-switcher";
import styles from "./marketplace.module.css";

type Listing = {
  id: string; title: string; description: string; price: number; currency: string; location: string; imageUrls: string[];
  condition: string; status: string; categoryId: string; createdAt: string; isVip: boolean; vipAssignedAt?: string | null; vipExpiresAt?: string | null; vipPurchasePending?: boolean; seller: { id: string; name: string }; category: { id: string; nameKa: string; nameEn: string };
};
type OrderRecord = {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string;
  deliveryMethod: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  deliveryAddress: string | null;
  note: string | null;
  createdAt: string;
  isNew?: boolean;
  listing: { id: string; title: string; imageUrls: string[] };
  seller?: { id: string; name: string };
  buyer?: { id: string; name: string };
};
type Category = { id: string; nameKa: string; nameEn: string; slug: string };
type SessionUser = { id: string; name: string; email: string; role: string };
type OwnerListingStatus = "ACTIVE" | "PAUSED" | "RESERVED" | "SOLD";
type CategoryIcon = "laptop" | "smartphone" | "car" | "house" | "shirt";
type CategoryTile = { name: string; slug: string; icon: CategoryIcon; tone: string };
type Promotion = {
  id: string;
  kind: "INTERNAL" | "PARTNER";
  placement: "CAROUSEL" | "FEED" | "TICKER";
  titleKa: string;
  titleEn: string;
  titleRu: string;
  descriptionKa: string;
  descriptionEn: string;
  descriptionRu: string;
  ctaKa: string;
  ctaEn: string;
  ctaRu: string;
  imageUrl: string | null;
  targetUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};
const sampleCarouselPromotions: Promotion[] = [
  {
    id: "sample-vip-promo",
    kind: "INTERNAL",
    placement: "CAROUSEL",
    titleKa: "გახადე შენი განცხადება VIP",
    titleEn: "Give your listing VIP visibility",
    titleRu: "Выделите объявление с VIP",
    descriptionKa: "გამოაჩინე შენი ნივთი სხვებზე ადრე და დაეხმარე ახალ მფლობელს მის პოვნაში.",
    descriptionEn: "Put your item in the spotlight and help its next owner find it sooner.",
    descriptionRu: "Выделите свою вещь и помогите новому владельцу быстрее её найти.",
    ctaKa: "განცხადებების ნახვა",
    ctaEn: "Explore listings",
    ctaRu: "Смотреть объявления",
    imageUrl: null,
    targetUrl: "#listings",
    isActive: true,
    sortOrder: 0
  },
  {
    id: "sample-seasonal-promo",
    kind: "INTERNAL",
    placement: "CAROUSEL",
    titleKa: "სეზონის ახალი აღმოჩენები",
    titleEn: "Fresh finds for the season",
    titleRu: "Новые находки сезона",
    descriptionKa: "იპოვე ნივთები, რომლებსაც ახალი ისტორიის დაწყება შეუძლიათ.",
    descriptionEn: "Find thoughtful pre-loved pieces ready for a new story.",
    descriptionRu: "Найдите вещи, готовые начать новую историю.",
    ctaKa: "კატეგორიების ნახვა",
    ctaEn: "Browse categories",
    ctaRu: "Смотреть категории",
    imageUrl: null,
    targetUrl: "#categories",
    isActive: true,
    sortOrder: 1
  },
  {
    id: "sample-partner-promo",
    kind: "PARTNER",
    placement: "CAROUSEL",
    titleKa: "პარტნიორული რეკლამის სლოტი",
    titleEn: "Partner promotion slot",
    titleRu: "Место для рекламы партнёра",
    descriptionKa: "ეს სარეკლამო სივრცე პარტნიორის აქტიური ბანერისთვისაა განკუთვნილი.",
    descriptionEn: "This clearly labeled space is ready for an active partner banner.",
    descriptionRu: "Это место с пометкой «Реклама» предназначено для баннера партнёра.",
    ctaKa: "",
    ctaEn: "",
    ctaRu: "",
    imageUrl: null,
    targetUrl: null,
    isActive: true,
    sortOrder: 2
  }
];
type SelectedImage = { file: File; previewUrl: string };
type InboxMessage = { id: string; body: string; notification?: VipRejectionNotification | null; createdAt: string; direction: "sent" | "received"; isNew: boolean; contact: { id: string; name: string }; listing: { id: string; title: string } };
type Props = { initialListings: Listing[]; initialPromotions: Promotion[]; categoryOptions: Category[]; categoryTiles: readonly CategoryTile[] };
type FilterOption = { value: string; label: string; icon?: LucideIcon };
type FilterDropdownProps = {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  align?: "start" | "end";
  searchPlaceholder?: string;
  noMatchesText?: string;
};

const GUEST_FAVORITES_KEY = "world-market-guest-favorites";

function isListing(value: unknown): value is Listing {
  if (typeof value !== "object" || value === null) return false;
  const listing = value as Record<string, unknown>;
  const seller = listing.seller;
  const category = listing.category;
  return typeof listing.id === "string"
    && typeof listing.title === "string"
    && typeof listing.description === "string"
    && typeof listing.price === "number"
    && typeof listing.currency === "string"
    && typeof listing.location === "string"
    && Array.isArray(listing.imageUrls)
    && listing.imageUrls.every((url) => typeof url === "string")
    && typeof listing.condition === "string"
    && typeof listing.status === "string"
    && typeof listing.categoryId === "string"
    && typeof listing.createdAt === "string"
    && (listing.isVip === undefined || typeof listing.isVip === "boolean")
    && (listing.vipAssignedAt === undefined || listing.vipAssignedAt === null || typeof listing.vipAssignedAt === "string")
    && (listing.vipExpiresAt === undefined || listing.vipExpiresAt === null || typeof listing.vipExpiresAt === "string")
    && (listing.vipPurchasePending === undefined || typeof listing.vipPurchasePending === "boolean")
    && typeof seller === "object"
    && seller !== null
    && typeof (seller as Record<string, unknown>).id === "string"
    && typeof (seller as Record<string, unknown>).name === "string"
    && typeof category === "object"
    && category !== null
    && typeof (category as Record<string, unknown>).id === "string"
    && typeof (category as Record<string, unknown>).nameKa === "string"
    && typeof (category as Record<string, unknown>).nameEn === "string";
}

function hasListings(value: unknown): value is { items: Listing[] } {
  if (typeof value !== "object" || value === null || !("items" in value)) return false;
  const items = (value as { items: unknown }).items;
  return Array.isArray(items) && items.every(isListing);
}

function isOwnerListingStatus(value: string): value is OwnerListingStatus {
  return value === "ACTIVE" || value === "PAUSED" || value === "RESERVED" || value === "SOLD";
}

function isListingAvailable(status: string) {
  return status === "ACTIVE" || status === "RESERVED";
}

function copyWithTemporaryTextarea(text: string) {
  let textarea: HTMLTextAreaElement | null = null;
  try {
    if (typeof document.execCommand !== "function") return false;
    textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea?.remove();
  }
}

function readGuestFavorites() {
  const stored = localStorage.getItem(GUEST_FAVORITES_KEY);
  if (!stored) return [] as Listing[];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Stored favorites are not a list");
    return parsed.filter(isListing).map((listing) => ({
      ...listing,
      isVip: listing.isVip ?? false,
      vipAssignedAt: listing.vipAssignedAt ?? null
    }));
  } catch (error) {
    console.error("Saved guest favorites could not be read", error);
    localStorage.removeItem(GUEST_FAVORITES_KEY);
    return [] as Listing[];
  }
}

const categoryIcons: Record<CategoryIcon, LucideIcon> = {
  laptop: Laptop,
  smartphone: Smartphone,
  car: CarFront,
  house: House,
  shirt: Shirt
};

const categoryFilterIcons: Record<string, LucideIcon> = {
  electronics: Laptop,
  "phones-accessories": Smartphone,
  "computers-laptops": Laptop,
  "cars-vehicles": CarFront,
  "real-estate": House,
  fashion: Shirt,
  "shoes-accessories": Shirt,
  "home-furniture": House,
  "home-appliances": Truck,
  "sports-fitness": Sparkles,
  gaming: Laptop,
  children: UserRound,
  "beauty-health": Sparkles,
  "tools-equipment": Tag,
  pets: Heart,
  services: MessageCircle,
  other: ShoppingBag
};

function FilterDropdown({ label, value, options, onChange, align = "start", searchPlaceholder, noMatchesText }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const [searchText, setSearchText] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const visibleOptions = useMemo(() => {
    const term = searchText.trim().toLocaleLowerCase();
    return term ? options.filter((option) => option.label.toLocaleLowerCase().includes(term)) : options;
  }, [options, searchText]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearchText("");
  }, []);

  const toggleDropdown = useCallback(() => {
    if (open) {
      closeDropdown();
      return;
    }
    const bounds = rootRef.current?.getBoundingClientRect();
    const expectedHeight = searchPlaceholder ? Math.min(370, window.innerHeight * 0.55) : Math.min(220, window.innerHeight * 0.4);
    if (bounds) {
      const roomBelow = window.innerHeight - bounds.bottom;
      setOpenAbove(roomBelow < expectedHeight && bounds.top > roomBelow);
    }
    setOpen(true);
  }, [closeDropdown, open, searchPlaceholder]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) closeDropdown();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDropdown, open]);

  useEffect(() => {
    if (!open) return;
    const repositionIfNeeded = () => {
      const bounds = rootRef.current?.getBoundingClientRect();
      const menuBounds = menuRef.current?.getBoundingClientRect();
      if (!bounds || !menuBounds) return;
      const roomBelow = window.innerHeight - bounds.bottom;
      const roomAbove = bounds.top;
      const shouldOpenAbove = menuBounds.height > roomBelow && roomAbove > roomBelow;
      setOpenAbove((current) => current === shouldOpenAbove ? current : shouldOpenAbove);
    };
    const frame = window.requestAnimationFrame(repositionIfNeeded);
    window.addEventListener("resize", repositionIfNeeded);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", repositionIfNeeded);
    };
  }, [open]);

  return <div ref={rootRef} className={`${styles.filterDropdown} ${align === "end" ? styles.filterDropdownEnd : ""} ${openAbove ? styles.filterDropdownAbove : ""}`}>
    <button
      ref={triggerRef}
      type="button"
      className={styles.filterDropdownTrigger}
      aria-label={label}
      aria-expanded={open}
      aria-controls={menuId}
      onClick={toggleDropdown}
    >
      <span>{selectedOption?.label ?? options[0]?.label ?? label}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div ref={menuRef} id={menuId} className={styles.filterDropdownMenu} aria-label={label}>
      {searchPlaceholder && <div className={styles.filterDropdownSearch}>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </div>}
      <div className={styles.filterDropdownOptions}>
        {visibleOptions.length ? visibleOptions.map((option) => {
          const Icon = option.icon;
          const selected = option.value === value;
          return <button
            type="button"
            key={option.value}
            className={`${styles.filterDropdownOption} ${selected ? styles.filterDropdownOptionSelected : ""}`}
            aria-pressed={selected}
            onClick={() => {
              onChange(option.value);
              closeDropdown();
              triggerRef.current?.focus();
            }}
          >
            {Icon && <Icon size={18} className={styles.filterDropdownOptionIcon} aria-hidden="true" />}
            <span className={styles.filterDropdownOptionLabel}>{option.label}</span>
            {selected && <Check size={17} className={styles.filterDropdownCheck} aria-hidden="true" />}
          </button>;
        }) : <p className={styles.filterDropdownEmpty}>{noMatchesText}</p>}
      </div>
    </div>}
  </div>;
}

function localizedPromotion(promotion: Promotion, language: "ka" | "en" | "ru") {
  if (language === "en") return { title: promotion.titleEn, description: promotion.descriptionEn, cta: promotion.ctaEn };
  if (language === "ru") return { title: promotion.titleRu, description: promotion.descriptionRu, cta: promotion.ctaRu };
  return { title: promotion.titleKa, description: promotion.descriptionKa, cta: promotion.ctaKa };
}

function PromotionCarousel({ promotions }: { promotions: Promotion[] }) {
  const { language, t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (promotions.length < 2) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const syncTimer = () => {
      if (timer !== undefined) window.clearInterval(timer);
      if (paused || motionPreference.matches) return;
      timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % promotions.length), 5000);
    };
    syncTimer();
    motionPreference.addEventListener("change", syncTimer);
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      motionPreference.removeEventListener("change", syncTimer);
    };
  }, [paused, promotions.length]);

  if (promotions.length === 0) return null;
  const currentIndex = activeIndex % promotions.length;
  const moveBy = (delta: number) => setActiveIndex((index) => (index + delta + promotions.length) % promotions.length);

  return <section className={styles.promoCarouselSection} aria-label={t("promotion.carouselLabel")}>
    <div
      className={styles.promoCarousel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div
        className={styles.promoViewport}
        onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const delta = event.changedTouches[0]?.clientX;
          if (delta !== undefined && Math.abs(delta - touchStart.current) > 40) moveBy(delta < touchStart.current ? 1 : -1);
          touchStart.current = null;
        }}
      >
        <div className={styles.promoTrack} style={{ transform: `translate3d(-${currentIndex * 100}%, 0, 0)` }}>
          {promotions.map((promotion, index) => {
            const copy = localizedPromotion(promotion, language);
            const external = Boolean(promotion.targetUrl && /^https?:\/\//i.test(promotion.targetUrl));
            const href = promotion.targetUrl || (promotion.kind === "INTERNAL" ? "#listings" : undefined);
            return <article className={`${styles.promoSlide} ${index === currentIndex ? styles.promoSlideActive : ""}`} key={promotion.id} aria-hidden={index !== currentIndex}>
              <div className={styles.promoCopy}>
                {promotion.kind === "PARTNER" && <span className={styles.promoAdBadge}><Megaphone size={13} />{t("promotion.adLabel")}</span>}
                {promotion.kind === "INTERNAL" && <span className={styles.promoInternalBadge}><Sparkles size={13} />{t("promotion.internalLabel")}</span>}
                <h2>{copy.title}</h2>
                {copy.description && <p>{copy.description}</p>}
                {copy.cta && href && <a className={styles.promoCta} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} tabIndex={index === activeIndex ? 0 : -1}>
                  {copy.cta}{external ? <ExternalLink size={16} /> : <ArrowRight size={17} />}
                </a>}
              </div>
              {promotion.imageUrl && <div className={styles.promoImage}><Image src={promotion.imageUrl} alt="" fill sizes="(max-width: 760px) 90vw, 42vw" unoptimized /></div>}
              <Sparkles className={styles.promoSparkle} size={23} aria-hidden="true" />
            </article>;
          })}
        </div>
      </div>
      {promotions.length > 1 && <div className={styles.promoControls}>
        <button type="button" className={styles.promoArrow} onClick={() => moveBy(-1)} aria-label={t("promotion.previous")}><ArrowLeft size={17} /></button>
        <div className={styles.promoDots}>
          {promotions.map((promotion, index) => <button
            type="button"
            className={`${styles.promoDot} ${index === currentIndex ? styles.promoDotActive : ""} ${paused ? styles.promoPaused : ""}`}
            key={promotion.id}
            onClick={() => setActiveIndex(index)}
            aria-label={t("promotion.goToSlide", { index: index + 1 })}
            aria-current={index === currentIndex}
          ><span /></button>)}
        </div>
        <button type="button" className={styles.promoArrow} onClick={() => moveBy(1)} aria-label={t("promotion.next")}><ChevronRight size={17} /></button>
      </div>}
    </div>
  </section>;
}

function PromotionTicker({ promotions, listings, onOpenListing }: { promotions: Promotion[]; listings: Listing[]; onOpenListing: (listing: Listing) => void }) {
  const { language, t } = useI18n();
  const tickerPromotions = promotions.filter((promotion) => promotion.placement === "TICKER");
  const vipListings = listings.filter((listing) => listing.isVip);
  if (!tickerPromotions.length && !vipListings.length) return null;

  const items = [
    ...vipListings.map((listing) => ({ id: `vip-${listing.id}`, title: `${listing.title} · ${formatPrice(listing.price)} ₾`, listing })),
    ...tickerPromotions.map((promotion) => ({ id: promotion.id, title: localizedPromotion(promotion, language).title, promotion }))
  ];
  const renderItem = (item: typeof items[number], duplicate = false) => {
    if ("listing" in item) return <button type="button" className={styles.tickerItem} key={`${item.id}-${duplicate}`} onClick={() => onOpenListing(item.listing)} tabIndex={duplicate ? -1 : 0}>
      <Star size={14} fill="currentColor" />{item.title}<span className={styles.tickerVip}>{t("promotion.vipLabel")}</span>
    </button>;
    const isPartner = item.promotion.kind === "PARTNER";
    const external = Boolean(item.promotion.targetUrl && /^https?:\/\//i.test(item.promotion.targetUrl));
    const href = item.promotion.targetUrl || "#listings";
    return <a className={styles.tickerItem} key={`${item.id}-${duplicate}`} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} tabIndex={duplicate ? -1 : 0}>
      {isPartner ? <Megaphone size={14} /> : <Sparkles size={14} />}{item.title}{isPartner && <span className={styles.tickerAd}>{t("promotion.adLabel")}</span>}
    </a>;
  };
  return <section className={styles.promoTicker} aria-label={t("promotion.tickerLabel")}>
    <span className={styles.tickerLabel}><Sparkles size={15} />{t("promotion.tickerLabel")}</span>
    <div className={styles.tickerViewport}><div className={styles.tickerTrack}>
      <div className={styles.tickerGroup}>{items.map((item) => renderItem(item))}</div>
      <div className={styles.tickerGroup} aria-hidden="true">{items.map((item) => renderItem(item, true))}</div>
    </div></div>
  </section>;
}

function ProfileLoadingSkeleton({ label }: { label: string }) {
  return <div className={styles.profileLoadingSkeleton} role="status" aria-label={label}>
    {[0, 1].map((index) => <div className={styles.profileLoadingCard} key={index}>
      <span className={styles.profileLoadingThumb} />
      <span className={styles.profileLoadingText}><i /><i /></span>
    </div>)}
  </div>;
}

export function Marketplace({ initialListings, initialPromotions, categoryOptions, categoryTiles }: Props) {
  const { language, t, translateServerMessage, categoryName, conditionName, statusName } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState(initialListings);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [heroHeadlineIndex, setHeroHeadlineIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "price-asc" | "price-desc">("newest");
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [isRefreshingListings, setIsRefreshingListings] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [sellOpen, setSellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileListings, setProfileListings] = useState<Listing[]>([]);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [vipPurchaseListing, setVipPurchaseListing] = useState<Listing | null>(null);
  const [vipTransferConfirmed, setVipTransferConfirmed] = useState(false);
  const [vipTransferReference, setVipTransferReference] = useState("");
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [editImageUrlText, setEditImageUrlText] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareFallbackUrl, setShareFallbackUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoriteListings, setFavoriteListings] = useState<Listing[]>([]);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [profileTab, setProfileTab] = useState<"listings" | "messages" | "orders">("listings");
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadOrderCount, setUnreadOrderCount] = useState(0);
  const [purchases, setPurchases] = useState<OrderRecord[]>([]);
  const [sales, setSales] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [purchaseListing, setPurchaseListing] = useState<Listing | null>(null);
  const [orderBuyerName, setOrderBuyerName] = useState("");
  const [orderPhone, setOrderPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"MEETUP" | "DELIVERY">("MEETUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");
  const [orderNote, setOrderNote] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const listingsRef = useRef<HTMLElement | null>(null);
  const sharedListingHandled = useRef(false);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const syncTimer = () => {
      if (timer !== undefined) window.clearInterval(timer);
      if (heroPaused || motionPreference.matches) return;
      timer = window.setInterval(() => setHeroHeadlineIndex((current) => (current + 1) % 4), 3800);
    };
    syncTimer();
    motionPreference.addEventListener("change", syncTimer);
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      motionPreference.removeEventListener("change", syncTimer);
    };
  }, [heroPaused]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((data) => setUser(data.user)).catch(() => setNotice(t("notice.accountLoadFailed")));
  }, [t]);
  const refreshUnreadCounts = useCallback(async () => {
    try {
      const response = await fetch("/api/account/unread", { cache: "no-store" });
      if (response.status === 401) {
        setUser(null);
        setUnreadMessageCount(0);
        setUnreadOrderCount(0);
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      if (!Number.isSafeInteger(data.messages) || !Number.isSafeInteger(data.orders)) return;
      setUnreadMessageCount(data.messages);
      setUnreadOrderCount(data.orders);
    } catch {
      return;
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        await refreshUnreadCounts();
      } finally {
        loading = false;
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const timer = window.setInterval(refreshWhenVisible, 15000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [user, refreshUnreadCounts]);
  useEffect(() => {
    if (!user) {
      try {
        const guestFavorites = readGuestFavorites();
        setFavoriteListings(guestFavorites);
        setFavoriteIds(guestFavorites.map(({ id }) => id));
      } catch (error) {
        console.error("Guest favorites could not be loaded", error);
        setNotice(t("notice.favoriteFailed"));
      }
      return;
    }

    let active = true;
    fetch("/api/favorites")
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 401) {
          setUser(null);
          return [];
        }
        if (!response.ok) throw new Error(translateServerMessage(data.error) || t("notice.favoriteFailed"));
        return Array.isArray(data.favorites) ? data.favorites.filter(isListing) : [];
      })
      .then((favorites: Listing[]) => {
        if (!active) return;
        setFavoriteListings(favorites);
        setFavoriteIds(favorites.map(({ id }) => id));
      })
      .catch((error: Error) => {
        console.error("Favorite list load failed", error);
        if (active) setNotice(translateServerMessage(error.message) || t("notice.favoriteFailed"));
      });
    return () => { active = false; };
  }, [user, t, translateServerMessage]);
  useEffect(() => () => {
    selectedImagesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, []);
  useEffect(() => {
    if (sharedListingHandled.current) return;
    const listingId = new URLSearchParams(window.location.search).get("listing");
    if (!listingId) {
      sharedListingHandled.current = true;
      return;
    }
    const listing = items.find((item) => item.id === listingId);
    if (!listing) return;
    sharedListingHandled.current = true;
    openListingDetails(listing);
    window.requestAnimationFrame(() => listingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [items]);

  const suggestions = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term.length > 1 && term !== search.trim().toLocaleLowerCase()
      ? items.filter((item) => item.title.toLocaleLowerCase().includes(term)).slice(0, 4).map((item) => item.title)
      : [];
  }, [items, query, search]);
  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const minimum = minPrice === "" ? undefined : Number(minPrice);
    const maximum = maxPrice === "" ? undefined : Number(maxPrice);
    const filtered = items.filter((item) =>
      (!term || `${item.title} ${item.description}`.toLocaleLowerCase().includes(term))
      && (!selectedCategoryId || item.categoryId === selectedCategoryId)
      && (minimum === undefined || item.price >= minimum)
      && (maximum === undefined || item.price <= maximum)
      && (!selectedCondition || item.condition === selectedCondition)
    );
    return filtered.sort((left, right) => compareListings(left, right, sortOrder));
  }, [items, search, selectedCategoryId, minPrice, maxPrice, selectedCondition, sortOrder]);
  const activeCarouselPromotions = initialPromotions.filter((promotion) => promotion.placement === "CAROUSEL");
  const carouselPromotions = activeCarouselPromotions.length ? activeCarouselPromotions : sampleCarouselPromotions;
  const feedPromotions = initialPromotions.filter((promotion) => promotion.placement === "FEED");
  const heroHeadlines = [
    [t("hero.titleFirst"), t("hero.titleSecond")],
    [t("hero.slide2First"), t("hero.slide2Second")],
    [t("hero.slide3First"), t("hero.slide3Second")],
    [t("hero.slide4First"), t("hero.slide4Second")]
  ] as const;
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const unreadActivityCount = user ? unreadMessageCount + unreadOrderCount : 0;
  const unreadBadgeText = unreadActivityCount > 99 ? "99+" : String(unreadActivityCount);

  function openListingDetails(listing: Listing) {
    setSelectedListing(listing);
    setDetailImageIndex(0);
    setMessageText("");
  }

  async function shareListing(listing: Listing) {
    try {
      const url = new URL("/", window.location.origin);
      url.searchParams.set("listing", listing.id);
      const shareUrl = url.toString();
      let copied = false;
      try {
        if (document.hasFocus() && typeof navigator.clipboard?.writeText === "function") {
          await navigator.clipboard.writeText(shareUrl);
          copied = true;
        }
      } catch {
        copied = false;
      }
      if (!copied) copied = copyWithTemporaryTextarea(shareUrl);
      if (copied) {
        setShareFallbackUrl("");
        setNotice(t("listing.linkCopied"));
        return;
      }
      setShareFallbackUrl(shareUrl);
      setNotice(t("listing.copyManually"));
    } catch {
      setNotice(t("listing.shareFailed"));
    }
  }

  async function retryShareCopy() {
    if (!shareFallbackUrl) return;
    try {
      if (document.hasFocus() && typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(shareFallbackUrl);
        setShareFallbackUrl("");
        setNotice(t("listing.linkCopied"));
        return;
      }
    } catch {
      // Fall through to the legacy copy method and keep the manual link available.
    }
    if (copyWithTemporaryTextarea(shareFallbackUrl)) {
      setShareFallbackUrl("");
      setNotice(t("listing.linkCopied"));
    } else {
      setNotice(t("listing.shareFailed"));
    }
  }

  async function refreshListingState(listingId: string) {
    try {
      const response = await fetch("/api/listings", { cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok || !hasListings(data)) throw new Error("Listings refresh returned an invalid response");
      const refreshedListing = data.items.find((item) => item.id === listingId);
      setItems(data.items);
      setSelectedListing((current) => current?.id === listingId ? refreshedListing || null : current);
      setPurchaseListing((current) => current?.id === listingId && (!refreshedListing || !isListingAvailable(refreshedListing.status)) ? null : current);
    } catch {
      setNotice(t("notice.listingsRefreshFailed"));
    }
  }

  async function sendListingMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedListing) return;
    if (!user) {
      setNotice(t("listing.messageLoginRequired"));
      setAuthOpen(true);
      return;
    }
    if (selectedListing.seller.id === user.id) {
      setNotice(t("listing.messageSelf"));
      return;
    }
    if (!isListingAvailable(selectedListing.status)) {
      setNotice(t("server.listingUnavailable"));
      return;
    }
    setMessageSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId: selectedListing.id, body: messageText })
      });
      const responseBody: unknown = await response.json().catch(() => null);
      const data = typeof responseBody === "object" && responseBody !== null
        ? responseBody as { error?: string; code?: string }
        : {};
      if (response.status === 401) {
        setUser(null);
        setAuthOpen(true);
        setNotice(t("listing.messageLoginRequired"));
        return;
      }
      if (!response.ok) {
        console.warn("Listing message request rejected", {
          status: response.status,
          error: data.error || "No error message returned",
          code: data.code || "No error code returned"
        });
        setNotice(translateServerMessage(data.error) || t("listing.messageFailed"));
        if (data.code === "LISTING_MISSING" || data.code === "LISTING_UNAVAILABLE") {
          setNotice(translateServerMessage(data.error) || t("server.listingUnavailable"));
          await refreshListingState(selectedListing.id);
        }
        return;
      }
      setMessageText("");
      setNotice(t("listing.messageSent"));
    } catch (error) {
      console.warn("Listing message request failed before a successful response", {
        error: error instanceof Error ? error.message : String(error)
      });
      setNotice(t("listing.messageFailed"));
    } finally {
      setMessageSending(false);
    }
  }

  async function loadInbox() {
    setProfileTab("messages");
    setInboxLoading(true);
    try {
      const response = await fetch("/api/messages");
      const data = await response.json();
      if (response.status === 401) {
        setUser(null);
        setProfileOpen(false);
        setAuthOpen(true);
        return;
      }
      if (!response.ok) {
        setNotice(translateServerMessage(data.error) || t("notice.profileLoadFailed"));
        return;
      }
      setInboxMessages(data.messages);
      const readResponse = await fetch("/api/messages", { method: "PATCH" });
      if (!readResponse.ok) {
        const readData = await readResponse.json();
        setNotice(translateServerMessage(readData.error) || t("profile.unreadMarkFailed"));
        return;
      }
      await refreshUnreadCounts();
    } catch {
      setNotice(t("notice.profileLoadFailed"));
    } finally {
      setInboxLoading(false);
    }
  }

  async function loadOrders() {
    setProfileTab("orders");
    setOrdersLoading(true);
    try {
      const response = await fetch("/api/orders");
      const data = await response.json();
      if (response.status === 401) {
        setUser(null);
        setProfileOpen(false);
        setAuthOpen(true);
        return;
      }
      if (!response.ok) {
        setNotice(translateServerMessage(data.error) || t("order.failed"));
        return;
      }
      setPurchases(data.purchases);
      setSales(data.sales);
      const readResponse = await fetch("/api/orders", { method: "PATCH" });
      if (!readResponse.ok) {
        const readData = await readResponse.json();
        setNotice(translateServerMessage(readData.error) || t("profile.unreadMarkFailed"));
        return;
      }
      await refreshUnreadCounts();
    } catch {
      setNotice(t("order.failed"));
    } finally {
      setOrdersLoading(false);
    }
  }

  async function deleteInboxMessage(message: InboxMessage) {
    try {
      const response = await fetch(`/api/messages/${message.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setUser(null);
        setProfileOpen(false);
        setAuthOpen(true);
        return;
      }
      if (!response.ok) {
        setNotice(translateServerMessage(data.error) || t("profile.activityDeleteFailed"));
        return;
      }
      setInboxMessages((current) => current.filter((item) => item.id !== message.id));
      if (message.direction === "received" && message.isNew) {
        setUnreadMessageCount((count) => Math.max(0, count - 1));
      }
      void refreshUnreadCounts();
      setNotice(t("profile.activityDeleted"));
    } catch {
      setNotice(t("profile.activityDeleteFailed"));
    }
  }

  async function deleteOrderRecord(order: OrderRecord, direction: "purchase" | "sale") {
    try {
      const response = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setUser(null);
        setProfileOpen(false);
        setAuthOpen(true);
        return;
      }
      if (!response.ok) {
        setNotice(translateServerMessage(data.error) || t("profile.activityDeleteFailed"));
        return;
      }
      if (direction === "purchase") {
        setPurchases((current) => current.filter((item) => item.id !== order.id));
      } else {
        setSales((current) => current.filter((item) => item.id !== order.id));
        if (order.isNew) setUnreadOrderCount((count) => Math.max(0, count - 1));
      }
      void refreshUnreadCounts();
      setNotice(t("profile.activityDeleted"));
    } catch {
      setNotice(t("profile.activityDeleteFailed"));
    }
  }

  function startPurchase(listing: Listing) {
    if (user?.id === listing.seller.id) {
      setNotice(t("listing.ownListing"));
      return;
    }
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setOrderBuyerName(user.name);
    setOrderPhone("");
    setDeliveryMethod("MEETUP");
    setDeliveryAddress("");
    setPaymentMethod("CASH");
    setOrderNote("");
    setPurchaseListing(listing);
  }

  async function submitPurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchaseListing || !user) return;
    if (purchaseListing.seller.id === user.id) {
      setNotice(t("listing.ownListing"));
      return;
    }
    setOrderBusy(true);
    const body = {
      listingId: purchaseListing.id,
      buyerName: orderBuyerName.trim(),
      buyerPhone: orderPhone.trim(),
      deliveryMethod,
      deliveryAddress: deliveryMethod === "DELIVERY" ? deliveryAddress.trim() : undefined,
      note: orderNote.trim() || undefined
    };
    try {
      const endpoint = paymentMethod === "CARD" ? "/api/checkout" : "/api/orders";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const responseBody: unknown = await response.json().catch(() => null);
      const data = typeof responseBody === "object" && responseBody !== null
        ? responseBody as { error?: string; code?: string; url?: string }
        : {};
      if (response.status === 401) {
        setUser(null);
        setPurchaseListing(null);
        setAuthOpen(true);
        return;
      }
      if (!response.ok) {
        console.warn("Order request rejected", {
          endpoint,
          status: response.status,
          error: data.error || "No error message returned",
          code: data.code || "No error code returned"
        });
        if (data.code === "SELLER_PAYMENTS_UNAVAILABLE") {
          setPaymentMethod("CASH");
          setNotice(t("notice.sellerPaymentsUnavailable"));
          return;
        }
        setNotice(translateServerMessage(data.error) || t("order.failed"));
        if (data.code === "LISTING_UNAVAILABLE") {
          setNotice(translateServerMessage(data.error) || t("server.listingUnavailable"));
          await refreshListingState(purchaseListing.id);
        }
        return;
      }
      if (paymentMethod === "CARD") {
        if (typeof data.url !== "string") {
          setNotice(t("order.failed"));
          return;
        }
        window.location.assign(data.url);
        return;
      }
      setPurchaseListing(null);
      setOrderConfirmation(true);
    } catch (error) {
      console.warn("Order request failed before a successful response", {
        error: error instanceof Error ? error.message : String(error)
      });
      setNotice(t("order.failed"));
    } finally {
      setOrderBusy(false);
    }
  }

  function submitSearch(value: string) {
    const term = value.trim();
    setQuery(value);
    listingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSearch(term);
  }

  function selectImages(event: React.ChangeEvent<HTMLInputElement>, reservedCount = 0) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    const validTypes = new Set<string>(ALLOWED_IMAGE_TYPES);
    const supportedFiles = files.filter((file) => validTypes.has(file.type));
    const validFiles = supportedFiles.filter((file) => file.size <= MAX_IMAGE_SIZE_BYTES);
    const availableSlots = Math.max(0, MAX_LISTING_IMAGES - reservedCount - selectedImagesRef.current.length);
    const chosenFiles = validFiles.slice(0, availableSlots);
    const nextImages = [
      ...selectedImagesRef.current,
      ...chosenFiles.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    ];
    selectedImagesRef.current = nextImages;
    setSelectedImages(nextImages);

    const messages = [];
    if (supportedFiles.length !== files.length) messages.push(t("sell.imageTypeError"));
    if (validFiles.length !== supportedFiles.length) messages.push(t("sell.imageSizeError"));
    if (chosenFiles.length !== validFiles.length) messages.push(t("notice.imageLimit", { limit: MAX_LISTING_IMAGES }));
    if (messages.length) setNotice(messages.join(" "));
  }

  function removeSelectedImage(index: number) {
    const removedImage = selectedImagesRef.current[index];
    if (!removedImage) return;
    URL.revokeObjectURL(removedImage.previewUrl);
    const nextImages = selectedImagesRef.current.filter((_, imageIndex) => imageIndex !== index);
    selectedImagesRef.current = nextImages;
    setSelectedImages(nextImages);
  }

  function clearSelectedImages() {
    selectedImagesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
    selectedImagesRef.current = [];
    setSelectedImages([]);
  }

  function closeSellModal() {
    setSellOpen(false);
    clearSelectedImages();
  }

  async function uploadSelectedImages() {
    if (selectedImagesRef.current.length === 0) return [];
    try {
      return await uploadListingImages(selectedImagesRef.current.map(({ file }) => file));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("notice.imageUploadFailed");
      throw new Error(translateServerMessage(message) || message);
    }
  }

  async function openProfile() {
    setProfileTab("listings");
    setProfileOpen(true);
    setProfileLoading(true);
    try {
      const response = await fetch("/api/profile/listings");
      const data = await response.json();
      if (response.status === 401) {
        setUser(null);
        setProfileOpen(false);
        setAuthOpen(true);
        return;
      }
      if (!response.ok) throw new Error(translateServerMessage(data.error) || t("notice.profileLoadFailed"));
      setProfileListings(data.listings);
    } catch (error) {
      console.error("Profile listings load failed", error);
      setProfileOpen(false);
      setNotice(error instanceof Error ? (translateServerMessage(error.message) || t("notice.profileLoadFailed")) : t("notice.profileLoadFailed"));
    } finally {
      setProfileLoading(false);
    }
  }

  function startEditing(listing: Listing) {
    clearSelectedImages();
    setEditImageUrls([...listing.imageUrls]);
    setEditImageUrlText("");
    setEditingListing(listing);
    setProfileOpen(false);
  }

  function closeEditModal() {
    setEditingListing(null);
    setEditImageUrls([]);
    setEditImageUrlText("");
    clearSelectedImages();
    setProfileOpen(true);
  }

  function removeEditImage(index: number) {
    setEditImageUrls((current) => current.filter((_, imageIndex) => imageIndex !== index));
  }

  async function deleteOwnListing(listing: Listing) {
    if (!window.confirm(t("profile.deleteConfirm"))) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/listings/${listing.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setNotice(translateServerMessage(data.error) || t("profile.deleteFailed"));
        return;
      }
      setProfileListings((current) => current.filter((item) => item.id !== listing.id));
      setItems((current) => current.filter((item) => item.id !== listing.id));
      setFavoriteListings((current) => current.filter((item) => item.id !== listing.id));
      setFavoriteIds((current) => current.filter((id) => id !== listing.id));
      setNotice(data.warning ? (translateServerMessage(data.warning) || data.warning) : t("profile.deleteSuccess"));
    } catch (error) {
      console.error("Listing deletion failed", error);
      setNotice(t("profile.deleteFailed") + " " + t("notice.connectionRetry"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleOwnListingVip(listing: Listing) {
    if (!user || listing.seller.id !== user.id) return;
    if (!listing.isVip) {
      setVipPurchaseListing(listing);
      setVipTransferConfirmed(false);
      setVipTransferReference("");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isVip: false })
      });
      const data = await response.json();
      if (response.status === 401) {
        setUser(null);
        setAuthOpen(true);
        return;
      }
      if (!response.ok) {
        setNotice(translateServerMessage(data.error) || t("profile.vipUpdateFailed"));
        return;
      }
      const isVip = Boolean(data.listing?.isVip);
      const vipAssignedAt = typeof data.listing?.vipAssignedAt === "string" ? data.listing.vipAssignedAt : null;
      const vipExpiresAt = typeof data.listing?.vipExpiresAt === "string" ? data.listing.vipExpiresAt : null;
      setItems((current) => current.map((item) => item.id === listing.id ? { ...item, isVip, vipAssignedAt, vipExpiresAt } : item));
      setProfileListings((current) => current.map((item) => item.id === listing.id ? { ...item, isVip, vipAssignedAt, vipExpiresAt } : item));
      setNotice(isVip ? t("profile.vipEnabled") : t("profile.vipDisabled"));
    } catch (error) {
      console.error("Owner VIP update failed", error);
      setNotice(t("profile.vipUpdateFailed") + " " + t("notice.connectionRetry"));
    } finally {
      setBusy(false);
    }
  }

  async function copyVipAccount() {
    let copied = false;
    if (document.hasFocus() && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(VIP_RECIPIENT_IBAN);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) copied = copyWithTemporaryTextarea(VIP_RECIPIENT_IBAN);
    setNotice(t(copied ? "vip.accountCopied" : "vip.accountCopyFailed"));
  }

  async function confirmVipPurchase() {
    const listing = vipPurchaseListing;
    if (!listing) return;
    if (!vipTransferConfirmed || !vipTransferReference.trim()) {
      setNotice(t("vip.confirmTransferRequired"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/listings/${listing.id}/vip-purchase`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmTransfer: true, transferReference: vipTransferReference.trim() })
      });
      const data = await response.json();
      if (response.status === 401) {
        setVipPurchaseListing(null);
        setUser(null);
        setAuthOpen(true);
        return;
      }
      if (!response.ok) {
        setNotice(translateServerMessage(data.error) || t("vip.purchaseFailed"));
        return;
      }
      if (data.purchase?.status !== "PENDING") {
        setNotice(t("vip.purchaseFailed"));
        return;
      }
      setProfileListings((current) => current.map((item) => item.id === listing.id ? { ...item, vipPurchasePending: true } : item));
      setVipPurchaseListing(null);
      setVipTransferConfirmed(false);
      setVipTransferReference("");
      setNotice(t("vip.requestPending"));
    } catch (error) {
      console.error("VIP purchase request failed", error);
      setNotice(t("vip.purchaseFailed") + " " + t("notice.connectionRetry"));
    } finally {
      setBusy(false);
    }
  }

  async function updateOwnListingStatus(listing: Listing, status: OwnerListingStatus) {
    if (!user || listing.seller.id !== user.id || listing.status === status) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (response.status === 401) {
        setUser(null);
        setAuthOpen(true);
        return;
      }
      if (!response.ok) {
        setNotice(translateServerMessage(data.error) || t("profile.statusUpdateFailed"));
        return;
      }
      setItems((current) => current.map((item) => item.id === listing.id ? { ...item, status } : item));
      setProfileListings((current) => current.map((item) => item.id === listing.id ? { ...item, status } : item));
      if (!isListingAvailable(status)) {
        setFavoriteIds((current) => current.filter((id) => id !== listing.id));
        setFavoriteListings((current) => current.filter((item) => item.id !== listing.id));
      }
      setNotice(t("profile.statusUpdated", { status: statusName(status) }));
    } catch (error) {
      console.error("Owner listing status update failed", error);
      setNotice(t("profile.statusUpdateFailed") + " " + t("notice.connectionRetry"));
    } finally {
      setBusy(false);
    }
  }

  async function updateOwnListing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingListing) return;
    const form = new FormData(event.currentTarget);
    const additionalUrls = editImageUrlText.split(",").map((url) => url.trim()).filter(Boolean);
    const imageCount = editImageUrls.length + selectedImagesRef.current.length + additionalUrls.length;
    if (imageCount === 0) {
      setNotice(t("notice.imageRequiredApi"));
      return;
    }
    if (imageCount > MAX_LISTING_IMAGES) {
      setNotice(t("notice.imageLimit", { limit: MAX_LISTING_IMAGES }));
      return;
    }

    const formElement = event.currentTarget;
    setBusy(true);
    try {
      const uploadedUrls = await uploadSelectedImages();
      const response = await fetch(`/api/listings/${editingListing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          price: Number(form.get("price")),
          condition: form.get("condition"),
          location: form.get("location"),
          categoryId: form.get("categoryId"),
          imageUrls: [...editImageUrls, ...uploadedUrls, ...additionalUrls]
        })
      });
      const data = await response.json().catch((error: unknown) => {
        console.error("Listing update API returned invalid JSON", { status: response.status, error });
        return null;
      });
      if (!response.ok) {
        const errorMessage = typeof data?.error === "string" ? data.error : undefined;
        console.warn("Listing update rejected", { status: response.status, error: errorMessage, field: data?.field });
        setNotice(translateServerMessage(errorMessage) || errorMessage || t("profile.updateFailed"));
        return;
      }
      if (!data || !isListing(data.listing)) {
        console.error("Listing update API returned an invalid listing", { status: response.status, data });
        setNotice(t("notice.badListingResponse"));
        return;
      }
      setItems((current) => {
        const remaining = current.filter((item) => item.id !== data.listing.id);
        return isListingAvailable(data.listing.status)
          ? [data.listing, ...remaining].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
          : remaining;
      });
      setFavoriteListings((current) => isListingAvailable(data.listing.status)
        ? current.map((item) => item.id === data.listing.id ? data.listing : item)
        : current.filter((item) => item.id !== data.listing.id));
      if (!isListingAvailable(data.listing.status)) setFavoriteIds((current) => current.filter((id) => id !== data.listing.id));
      setProfileListings((current) => current.map((item) => item.id === data.listing.id ? data.listing : item));
      formElement.reset();
      setEditingListing(null);
      setEditImageUrls([]);
      setEditImageUrlText("");
      clearSelectedImages();
      setProfileOpen(true);
      setNotice(data.warning ? (translateServerMessage(data.warning) || data.warning) : t("profile.updateSuccess"));
    } catch (error) {
      console.error("Listing update failed", error);
      setNotice(error instanceof Error ? (translateServerMessage(error.message) || t("profile.updateFailed")) : t("profile.updateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite(listing: Listing) {
    const listingId = listing.id;
    if (!user) {
      const alreadyFavorite = favoriteIds.includes(listingId);
      const nextFavorites = alreadyFavorite
        ? favoriteListings.filter(({ id }) => id !== listingId)
        : [listing, ...favoriteListings.filter(({ id }) => id !== listingId)];
      setFavoriteListings(nextFavorites);
      setFavoriteIds(nextFavorites.map(({ id }) => id));
      try {
        localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(nextFavorites));
      } catch (error) {
        console.error("Guest favorites could not be saved", error);
        setNotice(t("notice.favoriteFailed"));
      }
      return;
    }

    let response: Response;
    try {
      response = await fetch("/api/favorites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId }) });
    } catch (error) {
      console.error("Favorite request failed", error);
      setNotice(`${t("notice.favoriteFailed")} ${t("notice.connectionRetry")}`);
      return;
    }

    const responseText = await response.text();
    if (response.status === 401) {
      setAuthOpen(true);
      return;
    }

    let data: { favorited?: boolean; error?: string } | null = null;
    if (responseText.trim()) {
      try {
        const parsed: unknown = JSON.parse(responseText);
        if (typeof parsed === "object" && parsed !== null) data = parsed as { favorited?: boolean; error?: string };
      } catch (error) {
        console.error("Favorite response contained invalid JSON", error);
      }
    }
    if (!response.ok) {
      setNotice(translateServerMessage(data?.error) || t("notice.favoriteFailed"));
      return;
    }
    if (typeof data?.favorited !== "boolean") {
      setNotice(t("notice.favoriteInvalidResponse"));
      return;
    }
    const favorited = data.favorited;
    setFavoriteIds((ids) => favorited ? [...ids, listingId] : ids.filter((id) => id !== listingId));
    setFavoriteListings((current) => favorited
      ? [listing, ...current.filter(({ id }) => id !== listingId)]
      : current.filter(({ id }) => id !== listingId));
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const fallbackImageUrls = String(form.get("imageUrl") || "").split(",").map((url) => url.trim()).filter(Boolean);
    const selectedCount = selectedImagesRef.current.length;
    if (selectedCount + fallbackImageUrls.length === 0) {
      setNotice(t("notice.imageRequired"));
      return;
    }
    if (selectedCount + fallbackImageUrls.length > MAX_LISTING_IMAGES) {
      setNotice(t("notice.imageLimit", { limit: MAX_LISTING_IMAGES }));
      return;
    }

    setBusy(true);
    try {
      let imageUrls = fallbackImageUrls;
      if (selectedCount) {
        try {
          imageUrls = [...await uploadListingImages(selectedImagesRef.current.map(({ file }) => file)), ...fallbackImageUrls];
        } catch (error) {
          console.error("Listing image upload failed", error);
          const errorMessage = error instanceof Error ? error.message : undefined;
          setNotice(translateServerMessage(errorMessage) || errorMessage || t("notice.imageUploadFailed"));
          return;
        }
      }

      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"), description: form.get("description"), price: Number(form.get("price")),
          condition: form.get("condition"), location: form.get("location"), imageUrls,
          categoryId: form.get("categoryId")
        })
      });
      const data = await response.json().catch((error: unknown) => {
        console.error("Listing creation API returned invalid JSON", { status: response.status, error });
        return null;
      });
      if (!response.ok) {
        const errorMessage = typeof data?.error === "string" ? data.error : undefined;
        console.warn("Listing creation rejected", { status: response.status, error: errorMessage, field: data?.field });
        setNotice(translateServerMessage(errorMessage) || errorMessage || t("notice.listingPublishFailed"));
        return;
      }
      if (!data || !isListing(data.listing)) {
        console.error("Listing creation API returned an invalid listing", { status: response.status, data });
        setNotice(t("notice.badListingResponse"));
        return;
      }
      setItems((current) => [data.listing, ...current.filter((item) => item.id !== data.listing.id)]
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)));
      setQuery("");
      setSearch("");
      setSelectedCategoryId("");
      setMinPrice("");
      setMaxPrice("");
      setSelectedCondition("");
      setSortOrder("newest");
      formElement.reset();
      closeSellModal();
      setNotice(t("notice.listingPublished"));
    } catch (error) {
      console.error("Listing submission failed", error);
      setNotice(`${t("notice.listingPublishFailed")} ${t("notice.connectionRetry")}`);
    } finally {
      setBusy(false);
    }
  }

  async function connectPayments() {
    setBusy(true);
    try {
      const response = await fetch("/api/connect/onboard", { method: "POST" });
      const data = await response.json();
      if (!response.ok) { setNotice(translateServerMessage(data.error) || t("notice.paymentSetupFailed")); return; }
      window.location.assign(data.url);
    } catch (error) {
      console.error("Payment onboarding request failed", error);
      setNotice(`${t("notice.paymentSetupFailed")} ${t("notice.connectionRetry")}`);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) { setNotice(t("notice.logoutFailed")); return; }
    setUser(null);
    setUnreadMessageCount(0);
    setUnreadOrderCount(0);
    setProfileOpen(false);
    setEditingListing(null);
    clearSelectedImages();
    setNotice(t("notice.loggedOut"));
  }

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: authMode === "register" ? form.get("name") : undefined,
          email: form.get("email"),
          password: form.get("password")
        })
      });
      const data = await response.json();
      if (!response.ok) {
        const message = translateServerMessage(data.error) || t("notice.loginFailed");
        setAuthError(message);
        setNotice(message);
        return;
      }
      setAuthError("");
      setUnreadMessageCount(0);
      setUnreadOrderCount(0);
      setUser(data.user);
      setAuthOpen(false);
      setNotice(t("auth.greeting", { name: data.user.name }));
    } catch {
      const message = t("notice.loginFailed");
      setAuthError(message);
      setNotice(message);
    } finally {
      setBusy(false);
    }
  }

  function handleHomeClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setQuery("");
    setSearch("");
    setSelectedCategoryId("");
    setMinPrice("");
    setMaxPrice("");
    setSelectedCondition("");
    setSortOrder("newest");
    setFilterResetKey((current) => current + 1);
    setHeroHeadlineIndex(0);
    setMobileOpen(false);
    setAuthOpen(false);
    setSellOpen(false);
    setProfileOpen(false);
    setFavoritesOpen(false);
    setSelectedListing(null);
    setPurchaseListing(null);
    setOrderConfirmation(false);
    setEditingListing(null);
    setEditImageUrls([]);
    setEditImageUrlText("");
    setProfileLoading(false);
    setInboxLoading(false);
    setOrdersLoading(false);
    setMessageText("");
    setShareFallbackUrl("");
    setOrderBuyerName("");
    setOrderPhone("");
    setDeliveryMethod("MEETUP");
    setDeliveryAddress("");
    setPaymentMethod("CASH");
    setOrderNote("");
    setNotice("");
    setBusy(false);
    clearSelectedImages();
    sharedListingHandled.current = true;
    router.replace("/", { scroll: false });
    router.refresh();
    setIsRefreshingListings(true);
    void fetch("/api/listings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Listings refresh failed with status ${response.status}`);
        const data: unknown = await response.json();
        if (!hasListings(data)) throw new Error("Listings refresh returned an invalid response");
        setItems(data.items);
      })
      .catch((error: unknown) => {
        console.error("Homepage listings refresh failed", error);
        setNotice(t("notice.listingsRefreshFailed"));
      })
      .finally(() => setIsRefreshingListings(false));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main>
      <div className="topline"><Snowflake className="topline-sparkle topline-sparkle-left" aria-hidden="true" /><span>{t("header.season")}</span><span className="topline-right"><ShieldCheck size={14} /> {t("header.safeTrading")}</span><Snowflake className="topline-sparkle topline-sparkle-right" aria-hidden="true" /></div>
      <header className="header">
        <Link href="/" onClick={handleHomeClick} className="brand" aria-label={t("common.home")}><span className="brand-mark-wrap"><span className="brand-mark">W</span></span><span className="brand-name">World Market<svg className="brand-emblem" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1.5 2.1 6.1 6.3-2.3-2.6 6.1 4.7.7-6.1 2.2 2.5 6.2-6-2.6-.9 4.6-2.1-6.1-6.2 2.5 2.5-6.1-4.6-.8 6.1-2.1-2.5-6.2 6.1 2.5L12 1.5Z" fill="currentColor" /><circle cx="12" cy="12" r="2.1" fill="#285541" /></svg></span></Link>
        <nav className={mobileOpen ? "nav nav-open" : "nav"}>
          <a href="#categories">{t("header.categories")}</a><a href="#listings">{t("header.discover")}</a><a href="#how">{t("header.how")}</a>
          <a className={`${styles.navSupport} nav-support-link`} href={getWhatsAppSupportUrl(language)} target="_blank" rel="noopener noreferrer">{t("support.label")}</a>
          <button type="button" className={styles.navAction} onClick={() => setFavoritesOpen(true)}>{t("header.favorites")} <span className={styles.navCount}>{favoriteIds.length}</span></button>
          {user ? <button type="button" className={styles.navAction} onClick={openProfile} aria-label={`${t("header.myListings")}${unreadActivityCount ? ` (${unreadActivityCount})` : ""}`}>{t("header.myListings")}{unreadActivityCount > 0 && <span className={styles.unreadBadge}>{unreadBadgeText}</span>}</button> : <button type="button" className={styles.navAction} onClick={() => setAuthOpen(true)}>{t("header.login")}</button>}
          {isAdmin && <Link className={styles.navAction} href="/admin">{t("header.admin")}</Link>}
          {user && <button type="button" className={styles.navAction} onClick={logout}>{t("header.logout")}</button>}
        </nav>
        <div className="header-actions">
          <LanguageSwitcher className={styles.languageSwitcher} activeClassName={styles.languageActive} />
          <a className={`${styles.supportLink} support-link`} href={getWhatsAppSupportUrl(language)} target="_blank" rel="noopener noreferrer" aria-label={t("support.label")} title={t("support.label")}><MessageCircle size={17} /><span>{t("support.label")}</span></a>
          <button className="icon-btn favorites-link" aria-label={`${t("header.favorites")} (${favoriteIds.length})`} onClick={() => setFavoritesOpen(true)}><span className="favorites-icon-wrap"><Heart size={19} /><span className="favorites-count">{favoriteIds.length}</span></span></button>
          {user && <button className="login-btn" onClick={openProfile} aria-label={`${t("header.myListings")}${unreadActivityCount ? ` (${unreadActivityCount})` : ""}`}>{t("header.myListings")}{unreadActivityCount > 0 && <span className={styles.unreadBadge}>{unreadBadgeText}</span>}</button>}
          {isAdmin && <Link className="login-btn" href="/admin"><ShieldCheck size={17} />{t("header.admin")}</Link>}
          <button className="login-btn" onClick={() => user ? logout() : setAuthOpen(true)} title={user ? `${t("header.logout")} — ${user.name}` : t("header.login")}>{user ? <LogOut size={17} /> : <UserRound size={17} />}{user ? t("header.logout") : t("header.login")}</button>
          <button className="sell-btn" aria-label={t("header.sell")} onClick={() => user ? setSellOpen(true) : setAuthOpen(true)}><Plus size={18} /><span className={styles.sellText}>{t("header.sell")}</span></button>
          <button className="icon-btn menu-button" aria-label={t("header.menu")} onClick={() => setMobileOpen(!mobileOpen)}><Menu size={21} /></button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-snow" aria-hidden="true"><Snowflake className="hero-snowflake hero-snowflake-one" /><Snowflake className="hero-snowflake hero-snowflake-two" /><Snowflake className="hero-snowflake hero-snowflake-three" /><Snowflake className="hero-snowflake hero-snowflake-four" /><Snowflake className="hero-snowflake hero-snowflake-five" /></div>
        <div className="hero-content" onMouseEnter={() => setHeroPaused(true)} onMouseLeave={() => setHeroPaused(false)}>
          <div className="eyebrow"><Sparkles size={15} /> {t("hero.eyebrow")}</div>
          <h1
            className="hero-headline"
            tabIndex={0}
            onFocus={() => setHeroPaused(true)}
            onBlur={() => setHeroPaused(false)}
          >
            {heroHeadlines.map(([first, second], index) => <span
              key={index}
              className={`hero-headline-phrase ${index === heroHeadlineIndex ? "hero-headline-active" : ""}`}
              aria-hidden={index !== heroHeadlineIndex}
            >
              {first}<br /><span className="hero-headline-highlight">{second}</span>.
            </span>)}
          </h1>
          <p>{t("hero.description")}</p>
          <form className="search-wrap" onSubmit={(event) => { event.preventDefault(); submitSearch(query); }}>
            <Search size={20} className="search-icon" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("hero.searchPlaceholder")} aria-label={t("common.productSearch")} />
            <button type="submit">{t("hero.search")} <ArrowRight size={17} /></button>
            {!!suggestions.length && query && <div className="suggestions">{suggestions.map((text) => <button type="button" key={text} onClick={() => submitSearch(text)}>{text}</button>)}</div>}
          </form>
          <div className="trending"><span>{t("hero.popular")}</span><button type="button" onClick={() => submitSearch("iPhone")}>iPhone</button><button type="button" onClick={() => submitSearch(t("hero.bicycleSearch"))}>{t("hero.bicycle")}</button><button type="button" onClick={() => submitSearch(t("hero.furniture"))}>{t("hero.furniture")}</button></div>
        </div>
        <div className="hero-art">
          <div className="hero-circle" aria-hidden="true"></div><div className="hero-image"><Image src="https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1000&q=85" alt="" fill priority sizes="(max-width: 760px) 0vw, 48vw" /></div>
          <button type="button" className="floating-note" onClick={() => user ? setSellOpen(true) : setAuthOpen(true)} aria-haspopup="dialog"><span className="note-icon"><Tag size={18} /></span><span><b>{t("hero.sellNote")}</b><small>{t("hero.sellEasy")}</small></span></button>
          <div className="floating-stamp" aria-hidden="true">{t("hero.discoverStyle")} <span>✳</span></div>
        </div>
        <div className="hero-scribble">find · love · relove</div>
      </section>

      <section className="category-section section" id="categories">
        <div className="section-heading"><div><span className="section-kicker">{t("category.kicker")}</span><h2>{t("category.heading")}</h2></div><a href="#listings" className="text-link">{t("category.all")} <ChevronRight size={17} /></a></div>
        <div className="category-grid">{categoryTiles.map(({ name, slug, icon, tone }) => {
          const category = categoryOptions.find((entry) => entry.slug === slug);
          const Icon = categoryIcons[icon];
          return <button className="category-tile" key={name} onClick={() => { if (category) setSelectedCategoryId(category.id); listingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            <span className={`category-icon ${tone}`}><Icon size={24} /></span><span>{category ? categoryName(category) : name}</span><ChevronRight size={16} className="category-arrow" />
          </button>;
        })}</div>
      </section>

      {isRefreshingListings && (carouselPromotions.length > 0 || initialPromotions.length > 0 || items.some((item) => item.isVip))
        ? <section className={styles.promotionLoadingSkeleton} role="status" aria-label={t("promotion.loading")}><span /><span /></section>
        : <><PromotionCarousel promotions={carouselPromotions} /><PromotionTicker promotions={initialPromotions} listings={items} onOpenListing={openListingDetails} /></>}

      <section className="section listings-section" id="listings" ref={listingsRef}>
        <div className="section-heading"><div><span className="section-kicker">{search ? t("listings.searchKicker") : t("listings.kicker")}</span><h2>{search ? `“${search}”` : t("listings.heading")}</h2></div></div>
        <div className="listing-filters" aria-label={t("filters.title")}>
          <div className="filter-field"><span>{t("filters.category")}</span><FilterDropdown
            key={`category-filter-${filterResetKey}`}
            label={t("filters.category")}
            value={selectedCategoryId}
            onChange={setSelectedCategoryId}
            searchPlaceholder={t("filters.searchCategory")}
            noMatchesText={t("filters.noCategories")}
            options={[
              { value: "", label: t("filters.allCategories"), icon: Tag },
              ...categoryOptions.map((category) => ({
                value: category.id,
                label: categoryName(category),
                icon: categoryFilterIcons[category.slug] ?? Tag
              }))
            ]}
          /></div>
          <label><span>{t("filters.minPrice")}</span><input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} /></label>
          <label><span>{t("filters.maxPrice")}</span><input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></label>
          <div className="filter-field"><span>{t("filters.condition")}</span><FilterDropdown
            key={`condition-filter-${filterResetKey}`}
            label={t("filters.condition")}
            value={selectedCondition}
            align="end"
            onChange={setSelectedCondition}
            options={[
              { value: "", label: t("filters.allConditions") },
              ...["NEW", "LIKE_NEW", "GOOD", "FAIR"].map((condition) => ({
                value: condition,
                label: conditionName(condition)
              }))
            ]}
          /></div>
          <div className="filter-field"><span>{t("filters.sort")}</span><FilterDropdown
            key={`sort-filter-${filterResetKey}`}
            label={t("filters.sort")}
            value={sortOrder}
            align="end"
            onChange={(value) => setSortOrder(value as typeof sortOrder)}
            options={[
              { value: "newest", label: t("filters.newest") },
              { value: "price-asc", label: t("filters.priceAscending") },
              { value: "price-desc", label: t("filters.priceDescending") }
            ]}
          /></div>
          {(search || selectedCategoryId || minPrice || maxPrice || selectedCondition || sortOrder !== "newest") && <button type="button" className="filter-clear" onClick={() => { setQuery(""); setSearch(""); setSelectedCategoryId(""); setMinPrice(""); setMaxPrice(""); setSelectedCondition(""); setSortOrder("newest"); }}>{t("filters.clear")}</button>}
        </div>
        {isRefreshingListings
          ? <div className="product-grid" role="status" aria-label={t("listings.loading")}>{Array.from({ length: 4 }, (_, index) => <div className={styles.listingSkeleton} key={index}><span className={styles.listingSkeletonImage} /><span className={styles.listingSkeletonLine} /><span className={styles.listingSkeletonLineShort} /><span className={styles.listingSkeletonLine} /></div>)}</div>
          : visibleItems.length ? <div className="product-grid">{visibleItems.map((item, index) => <Fragment key={item.id}><article className={`product-card ${item.isVip ? styles.vipListingCard : ""}`} style={{ animationDelay: `${index * 55}ms` }}>
          <button type="button" className={styles.cardOpen} onClick={() => openListingDetails(item)} aria-label={t("listing.detailsOpen", { title: item.title })} />
          <div className="product-image">
            {item.imageUrls[0] ? <Image src={item.imageUrls[0]} alt={item.title} fill sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 23vw" /> : <div className="image-fallback"><ShoppingBag size={36} /></div>}
            {isListingAvailable(item.status) && <button className={`heart-button ${favoriteIds.includes(item.id) ? "hearted" : ""}`} onClick={(event) => { event.stopPropagation(); void toggleFavorite(item); }} aria-label={favoriteIds.includes(item.id) ? t("listing.favoriteRemove") : t("listing.favoriteAdd")}><Heart size={18} fill={favoriteIds.includes(item.id) ? "currentColor" : "none"} /></button>}
            {item.isVip && <span className={styles.vipListingBadge}><Star size={12} fill="currentColor" />VIP</span>}
            {item.status === "SOLD" && <span className={`${styles.listingStatusBadge} ${styles.soldBadge}`}>{statusName(item.status)}</span>}
            {isListingAvailable(item.status) && item.condition === "NEW" && <span className="condition-tag">{conditionName(item.condition)}</span>}
          </div>
          <div className="product-info"><span className="product-category">{categoryName(item.category)}</span><h3>{item.title}</h3><div className="product-price">{formatPrice(item.price)} <small>₾</small></div><div className="product-meta"><span>{item.location}</span>          <span className="seller"><BadgeCheck size={14} /> {item.seller.name}</span></div><button className="buy-btn" disabled={busy || !isListingAvailable(item.status) || user?.id === item.seller.id} onClick={(event) => { event.stopPropagation(); startPurchase(item); }}>{busy ? <LoaderCircle size={16} className="spin" /> : t("listing.buy")} <ArrowRight size={16} /></button>{user?.id === item.seller.id && <small className="own-listing-note">{t("listing.ownListing")}</small>}</div>
        </article>{(index + 1) % 6 === 0 && feedPromotions.length > 0 && (() => {
          const promotion = feedPromotions[(Math.floor(index / 6)) % feedPromotions.length];
          const copy = localizedPromotion(promotion, language);
          const external = Boolean(promotion.targetUrl && /^https?:\/\//i.test(promotion.targetUrl));
          return <a className={styles.feedPromotion} key={`feed-${item.id}`} href={promotion.targetUrl || "#listings"} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
            {promotion.imageUrl && <Image src={promotion.imageUrl} alt="" fill sizes="(max-width: 640px) 48vw, 23vw" unoptimized />}
            <span className={styles.feedPromotionShade} />
            <span className={styles.feedPromotionCopy}>
              {promotion.kind === "PARTNER" && <span className={styles.promoAdBadge}><Megaphone size={12} />{t("promotion.adLabel")}</span>}
              <strong>{copy.title}</strong>{copy.description && <small>{copy.description}</small>}
            </span>
          </a>;
        })()}</Fragment>)}</div> : <div className="empty-state"><Search size={27} /><h3>{t("listings.emptyTitle")}</h3><p>{t("listings.emptyDescription")}</p><button className="sell-btn" onClick={() => user ? setSellOpen(true) : setAuthOpen(true)}><Plus size={17} /> {t("header.sell")}</button></div>}
      </section>

      <section className="trust-band" id="how">
        <div><span className="trust-icon"><ShieldCheck size={23} /></span><span><b>{t("trust.payments")}</b><small>{t("trust.paymentsDescription")}</small></span></div>
        <div><span className="trust-icon"><Truck size={23} /></span><span><b>{t("trust.agree")}</b><small>{t("trust.agreeDescription")}</small></span></div>
        <div><span className="trust-icon"><Check size={23} /></span><span><b>{t("trust.sustainable")}</b><small>{t("trust.sustainableDescription")}</small></span></div>
      </section>

      <footer className="footer">
        <Link href="/" onClick={handleHomeClick} className="brand" aria-label={t("common.home")}><span className="brand-mark">W</span><span>World Market</span></Link>
        <p>{t("footer.tagline")}</p>
        <div className="footer-links">
          <a href="#categories">{t("header.categories")}</a>
          <a href="#how">{t("header.how")}</a>
          <a href={getWhatsAppSupportUrl(language)} target="_blank" rel="noopener noreferrer">{t("support.label")}</a>
          <Link href="/terms">{t("legal.terms.title")}</Link>
          <Link href="/privacy">{t("legal.privacy.title")}</Link>
          <LanguageSwitcher className={styles.languageSwitcher} activeClassName={styles.languageActive} />
          <span>© {new Date().getFullYear()} World Market</span>
        </div>
      </footer>

      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label={t("notice.close")}><X size={15} /></button></div>}
      {favoritesOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setFavoritesOpen(false)}>
        <div className={`modal ${styles.favoritesModal}`} role="dialog" aria-modal="true" aria-labelledby="favorites-modal-title">
          <button className="modal-close" onClick={() => setFavoritesOpen(false)} aria-label={t("notice.close")}><X size={20} /></button>
          <div className="modal-brand"><span className="brand-mark"><Heart size={18} /></span><span id="favorites-modal-title">{t("favorites.title")} ({favoriteIds.length})</span></div>
          {favoriteListings.length === 0
            ? <div className={styles.emptyProfile}><p>{t("favorites.empty")}</p><button className="sell-btn" onClick={() => { setFavoritesOpen(false); listingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{t("header.discover")} <ArrowRight size={16} /></button></div>
            : <div className={styles.favoriteList}>{favoriteListings.map((listing) => <article className={styles.favoriteRow} key={listing.id}>
              {listing.imageUrls[0] ? <Image className={styles.favoriteThumb} src={listing.imageUrls[0]} alt={listing.title} width={64} height={64} unoptimized /> : <div className={styles.favoriteThumb}><ShoppingBag size={22} /></div>}
              <div className={styles.favoriteInfo}><strong>{listing.title}</strong><span>{categoryName(listing.category)} · {formatPrice(listing.price)} ₾</span></div>
              <div className={styles.favoriteActions}>
                <button type="button" className="connect-btn" onClick={() => { setFavoritesOpen(false); openListingDetails(listing); }}>{t("favorites.view")}</button>
                <button type="button" className={styles.favoriteRemove} onClick={() => void toggleFavorite(listing)}><Trash2 size={14} />{t("favorites.remove")}</button>
              </div>
            </article>)}</div>}
        </div>
      </div>}
      {selectedListing && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedListing(null)}>
        <div className={`modal ${styles.listingDetailModal}`} role="dialog" aria-modal="true" aria-labelledby="listing-detail-title">
          <button className="modal-close" onClick={() => setSelectedListing(null)} aria-label={t("notice.close")}><X size={20} /></button>
          <div className={styles.detailLayout}>
            <div className={styles.detailGallery}>
              <div className={styles.detailMainImage}>
                {selectedListing.imageUrls[detailImageIndex]
                  ? <Image src={selectedListing.imageUrls[detailImageIndex]} alt={selectedListing.title} fill sizes="(max-width: 600px) 90vw, 45vw" />
                  : <div className="image-fallback"><ShoppingBag size={38} /></div>}
                {selectedListing.imageUrls.length > 1 && <>
                  <button type="button" className={`${styles.detailImageNav} ${styles.detailImageNavPrev}`} onClick={() => setDetailImageIndex((index) => (index - 1 + selectedListing.imageUrls.length) % selectedListing.imageUrls.length)} aria-label={t("listing.previousImage")}><ChevronLeft size={22} /></button>
                  <button type="button" className={`${styles.detailImageNav} ${styles.detailImageNavNext}`} onClick={() => setDetailImageIndex((index) => (index + 1) % selectedListing.imageUrls.length)} aria-label={t("listing.nextImage")}><ChevronRight size={22} /></button>
                  <span className={styles.detailImageCounter} aria-live="polite">{detailImageIndex + 1} / {selectedListing.imageUrls.length}</span>
                </>}
              </div>
              {selectedListing.imageUrls.length > 1 && <div className={styles.detailThumbs}>{selectedListing.imageUrls.map((url, index) => <button type="button" key={`${url}-${index}`} className={`${styles.detailThumbButton} ${index === detailImageIndex ? styles.detailThumbActive : ""}`} onClick={() => setDetailImageIndex(index)} aria-label={t("common.listingImage", { index: index + 1 })} aria-pressed={index === detailImageIndex}><Image src={url} alt="" width={62} height={58} unoptimized /></button>)}</div>}
            </div>
            <div className={styles.detailContent}>
              <span className="product-category">{categoryName(selectedListing.category)}</span>
              <h2 id="listing-detail-title">{selectedListing.title}</h2>
              <strong className={styles.detailPrice}>{formatPrice(selectedListing.price)} ₾</strong>
              <button type="button" className={styles.detailShareButton} onClick={() => void shareListing(selectedListing)}><ExternalLink size={15} />{t("listing.share")}</button>
              <div className={styles.detailMeta}><span>{conditionName(selectedListing.condition)}</span><span>{selectedListing.location}</span><span>{t("listing.seller")}: {selectedListing.seller.name}</span></div>
              <p className={styles.detailDescription}>{selectedListing.description}</p>
              {user?.id === selectedListing.seller.id
                ? <p className={styles.emptyProfile}>{t("listing.messageSelf")}</p>
                : !isListingAvailable(selectedListing.status)
                  ? <p className={styles.emptyProfile}>{t("server.listingUnavailable")}</p>
                  : user
                  ? <form className={styles.detailMessageForm} onSubmit={sendListingMessage}>
                    <strong>{t("listing.contactSeller")}</strong>
                    <textarea required maxLength={2000} value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder={t("listing.messagePlaceholder")} />
                    <button className="sell-btn" disabled={messageSending}>{messageSending ? t("sell.uploading") : t("listing.messageSend")} <MessageCircle size={16} /></button>
                  </form>
                  : <button type="button" className="connect-btn" onClick={() => { setNotice(t("listing.messageLoginRequired")); setAuthOpen(true); }}>{t("listing.messageLoginRequired")}</button>}
            </div>
          </div>
        </div>
      </div>}
      {shareFallbackUrl && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShareFallbackUrl("")}>
        <div className={`modal ${styles.shareFallbackModal}`} role="dialog" aria-modal="true" aria-labelledby="share-fallback-title">
          <button className="modal-close" onClick={() => setShareFallbackUrl("")} aria-label={t("notice.close")}><X size={20} /></button>
          <div className="modal-brand"><span className="brand-mark"><ExternalLink size={17} /></span><span id="share-fallback-title">{t("listing.share")}</span></div>
          <p>{t("listing.copyInstructions")}</p>
          <label>{t("listing.shareLinkLabel")}<input type="text" readOnly value={shareFallbackUrl} onFocus={(event) => event.currentTarget.select()} /></label>
          <div className={styles.shareFallbackActions}>
            <button type="button" className="sell-btn" onClick={() => void retryShareCopy()}>{t("listing.retryCopy")}</button>
            <button type="button" className="connect-btn" onClick={() => setShareFallbackUrl("")}>{t("notice.close")}</button>
          </div>
        </div>
      </div>}
      {purchaseListing && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !orderBusy && setPurchaseListing(null)}>
        <div className="modal sell-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-modal-title">
          <button className="modal-close" onClick={() => !orderBusy && setPurchaseListing(null)} aria-label={t("notice.close")} disabled={orderBusy}><X size={20} /></button>
          <div className="modal-brand"><span className="brand-mark"><ShoppingBag size={18} /></span><span id="purchase-modal-title">{t("order.title")}</span></div>
          <div className="order-summary">
            {purchaseListing.imageUrls[0] ? <Image src={purchaseListing.imageUrls[0]} alt={purchaseListing.title} width={68} height={64} unoptimized /> : <div className="order-summary-fallback"><ShoppingBag size={22} /></div>}
            <div className="order-summary-info"><strong>{purchaseListing.title}</strong><span>{formatPrice(purchaseListing.price)} ₾ · {purchaseListing.seller.name}</span></div>
          </div>
          <form onSubmit={submitPurchase}>
            <label>{t("order.buyerName")}<input required maxLength={100} value={orderBuyerName} onChange={(event) => setOrderBuyerName(event.target.value)} /></label>
            <label>{t("order.phone")}<input required type="tel" minLength={5} maxLength={40} value={orderPhone} onChange={(event) => setOrderPhone(event.target.value)} /></label>
            <label>{t("order.delivery")}<select value={deliveryMethod} onChange={(event) => setDeliveryMethod(event.target.value as typeof deliveryMethod)}><option value="MEETUP">{t("order.meetup")}</option><option value="DELIVERY">{t("order.deliveryService")}</option></select></label>
            {deliveryMethod === "DELIVERY" && <label>{t("order.address")}<input required maxLength={500} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder={t("order.addressPlaceholder")} /></label>}
            <label>{t("order.payment")}<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}><option value="CASH">{t("order.cash")}</option><option value="CARD">{t("order.card")}</option></select></label>
            <label>{t("order.note")}<textarea maxLength={1000} value={orderNote} onChange={(event) => setOrderNote(event.target.value)} placeholder={t("order.notePlaceholder")} /></label>
            <button className="sell-btn modal-submit" disabled={orderBusy}>{orderBusy ? t("order.submitting") : t("order.submit")} <ArrowRight size={17} /></button>
          </form>
        </div>
      </div>}
      {orderConfirmation && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOrderConfirmation(false)}>
        <div className="modal order-success" role="dialog" aria-modal="true" aria-labelledby="order-success-title">
          <span className="order-success-check" aria-hidden="true"><Check size={26} strokeWidth={2.5} /></span>
          <h2 id="order-success-title">{t("order.successTitle")}</h2>
          <p>{t("order.successDescription")}</p>
          <button className="sell-btn modal-submit" onClick={() => { setOrderConfirmation(false); setProfileOpen(true); void loadOrders(); }}>{t("order.purchases")} <ArrowRight size={16} /></button>
          <button className="connect-btn" onClick={() => setOrderConfirmation(false)}>{t("order.closeConfirmation")}</button>
        </div>
      </div>}
      {authOpen && <div className="modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setAuthOpen(false);
          setAuthError("");
        }
      }}>
        <div className="modal">
          <button className="modal-close" onClick={() => { setAuthOpen(false); setAuthError(""); }} aria-label={t("notice.close")}><X size={20} /></button>
          <div className="modal-brand"><span className="brand-mark">W</span><span>{t("auth.join")}</span></div>
          <p>{t("auth.description")}</p>
          <div className={styles.authTabs} role="tablist" aria-label={t("auth.mode")}>
            <button type="button" role="tab" aria-selected={authMode === "login"} className={authMode === "login" ? styles.authTabActive : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }}>{t("header.login")}</button>
            <button type="button" role="tab" aria-selected={authMode === "register"} className={authMode === "register" ? styles.authTabActive : ""} onClick={() => { setAuthMode("register"); setAuthError(""); }}>{t("auth.register")}</button>
          </div>
          {authError && <p className={styles.authError} role="alert">{authError}</p>}
          <form onSubmit={authenticate}>
            {authMode === "register" && <label>{t("auth.name")}<input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder={t("auth.namePlaceholder")} /></label>}
            <label>{t("auth.email")}<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="name@example.com" /></label>
            <label>{t("auth.password")}<input name="password" type="password" required minLength={authMode === "register" ? 10 : 1} maxLength={72} autoComplete={authMode === "register" ? "new-password" : "current-password"} placeholder={authMode === "register" ? t("auth.passwordPlaceholder") : t("auth.loginPasswordPlaceholder")} /></label>
            <button className="sell-btn modal-submit" disabled={busy}>{busy ? t("auth.wait") : authMode === "login" ? t("header.login") : t("auth.register")} <ArrowRight size={17} /></button>
          </form>
          <p className={styles.authModePrompt}>
            {authMode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}
            <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}>
              {authMode === "login" ? t("auth.register") : t("header.login")}
            </button>
          </p>
        </div>
      </div>}
      {sellOpen && <div className="modal-backdrop" onMouseDown={(event) => !busy && event.target === event.currentTarget && closeSellModal()}>
        <div className="modal sell-modal">
          <button className="modal-close" onClick={closeSellModal} aria-label={t("notice.close")} disabled={busy}><X size={20} /></button>
          <div className="modal-brand"><span className="brand-mark"><Plus size={20} /></span><span>{t("sell.title")}</span></div>
          <p>{t("sell.description")}</p>
          <form onSubmit={publish}>
            <label>{t("sell.titleLabel")}<input name="title" required minLength={4} maxLength={120} placeholder={t("sell.titlePlaceholder")} /></label>
            <label>{t("sell.descriptionLabel")}<textarea name="description" required minLength={10} maxLength={5000} placeholder={t("sell.descriptionPlaceholder")} /></label>
            <div className="form-row">
              <label>{t("sell.price")}<input name="price" type="number" min="1" max="999999" step="1" required /></label>
              <label>{t("sell.condition")}<select name="condition"><option value="GOOD">{conditionName("GOOD")}</option><option value="NEW">{conditionName("NEW")}</option><option value="LIKE_NEW">{conditionName("LIKE_NEW")}</option><option value="FAIR">{conditionName("FAIR")}</option></select></label>
            </div>
            <div className="form-row">
              <label>{t("sell.city")}<input name="location" required minLength={2} maxLength={100} placeholder={t("sell.cityPlaceholder")} /></label>
              <label>{t("sell.category")}<select name="categoryId" required defaultValue=""><option value="" disabled>{t("sell.choose")}</option>{categoryOptions.map((category) => <option value={category.id} key={category.id}>{categoryName(category)}</option>)}</select></label>
            </div>
            <label>{t("sell.images", { limit: MAX_LISTING_IMAGES })}
              <input className={styles.fileInput} name="images" type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} multiple onChange={selectImages} disabled={busy} />
              <small className={styles.uploadHelp}>{t("sell.imageHelp")}</small>
            </label>
            {selectedImages.length > 0 && <div className={styles.uploadPreviews} aria-label={t("common.preview")}>
              {selectedImages.map(({ file, previewUrl }, index) => <div className={styles.uploadPreview} key={`${file.name}-${file.lastModified}-${index}`}>
                <Image src={previewUrl} alt={t("sell.previewAlt", { index: index + 1 })} width={88} height={72} unoptimized />
                <button type="button" className={styles.removeUpload} onClick={() => removeSelectedImage(index)} aria-label={t("common.removeImage", { index: index + 1 })} disabled={busy}><X size={15} /></button>
              </div>)}
            </div>}
            <label>{t("sell.imageUrls")}
              <input name="imageUrl" type="text" placeholder={t("sell.imageUrlPlaceholder")} />
              <small className={styles.uploadHelp}>{t("sell.imageUrlHelp")}</small>
            </label>
            <button className="sell-btn modal-submit" disabled={busy}>{busy ? t("sell.uploading") : t("sell.publish")} <ArrowRight size={17} /></button>
            <button type="button" className="connect-btn" disabled={busy} onClick={connectPayments}>{t("sell.payments")}</button>
          </form>
        </div>
      </div>}
      {profileOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setProfileOpen(false)}>
        <div className={`modal ${styles.profileModal}`}>
          <button className="modal-close" onClick={() => setProfileOpen(false)} aria-label={t("notice.close")}><X size={20} /></button>
          <div className="modal-brand"><span className="brand-mark"><UserRound size={18} /></span><span>{t("profile.title")}</span></div>
          <p>{t("profile.description", { name: user?.name || "" })}</p>
          <div className={styles.profileTabs}>
            <button type="button" className={`${styles.profileTab} ${profileTab === "listings" ? styles.profileTabActive : ""}`} onClick={() => { setProfileTab("listings"); void openProfile(); }}>{t("profile.listingsTab")}</button>
            <button type="button" className={`${styles.profileTab} ${profileTab === "messages" ? styles.profileTabActive : ""}`} onClick={() => { void loadInbox(); }}>{t("profile.inboxTab")}{unreadMessageCount > 0 && <span className={styles.tabUnreadBadge} aria-label={t("profile.unreadCount", { count: unreadMessageCount })}>{unreadMessageCount > 99 ? "99+" : unreadMessageCount}</span>}</button>
            <button type="button" className={`${styles.profileTab} ${profileTab === "orders" ? styles.profileTabActive : ""}`} onClick={() => { void loadOrders(); }}>{t("profile.ordersTab")}{unreadOrderCount > 0 && <span className={styles.tabUnreadBadge} aria-label={t("profile.unreadCount", { count: unreadOrderCount })}>{unreadOrderCount > 99 ? "99+" : unreadOrderCount}</span>}</button>
          </div>
          {profileTab === "listings" && (profileLoading ? <ProfileLoadingSkeleton label={t("profile.loading")} /> : profileListings.length === 0
            ? <div className={styles.emptyProfile}>{t("profile.empty")}</div>
            : <div className={styles.profileListings}>
              {profileListings.map((listing) => {
                const canEdit = isListingAvailable(listing.status) || listing.status === "PAUSED";
                const canDelete = listing.status !== "SOLD";
                return <article className={styles.profileListing} key={listing.id}>
                  <div className={styles.profileListingInfo}>
                    {listing.imageUrls[0]
                      ? <Image className={styles.profileThumb} src={listing.imageUrls[0]} alt={listing.title} width={70} height={64} unoptimized />
                      : <div className={styles.profileThumbFallback}><ShoppingBag size={24} /></div>}
                    <div className={styles.profileListingText}>
                      <strong>{listing.title}</strong>
                      <span>{categoryName(listing.category)}</span>
                      {listing.vipPurchasePending && <small className={styles.vipPendingStatus}>{t("vip.pendingStatus")}</small>}
                      <div className={styles.profileListingMeta}><span>{formatPrice(listing.price)} ₾</span><select className={styles.profileStatusSelect} aria-label={t("profile.changeStatus")} value={listing.status === "RESERVED" ? "ACTIVE" : listing.status} disabled={busy} onChange={(event) => { const status = event.currentTarget.value; if (isOwnerListingStatus(status)) void updateOwnListingStatus(listing, status); }}>
                        <option value="ACTIVE">{statusName("ACTIVE")}</option>
                        <option value="SOLD">{statusName("SOLD")}</option>
                        {listing.status === "PAUSED" && <option value="PAUSED">{statusName("PAUSED")}</option>}
                      </select></div>
                    </div>
                  </div>
                  <div className={styles.profileListingActions}>
                    <button type="button" className="connect-btn" onClick={() => void toggleOwnListingVip(listing)} disabled={!canEdit || busy || (listing.vipPurchasePending && !listing.isVip)} aria-pressed={listing.isVip}><Star size={14} fill={listing.isVip ? "currentColor" : "none"} /> {listing.vipPurchasePending && !listing.isVip ? t("vip.pendingBadge") : listing.isVip ? t("profile.vipDisable") : t("profile.vipEnable")}</button>
                    <button type="button" className="connect-btn" onClick={() => startEditing(listing)} disabled={!canEdit || busy}><Pencil size={14} /> {t("profile.edit")}</button>
                    <button type="button" className={styles.deleteButton} onClick={() => deleteOwnListing(listing)} disabled={!canDelete || busy}><Trash2 size={14} /> {t("profile.delete")}</button>
                  </div>
                </article>;
              })}
            </div>)}
          {profileTab === "messages" && (inboxLoading
            ? <ProfileLoadingSkeleton label={t("profile.inboxLoading")} />
            : inboxMessages.length === 0
              ? <div className={styles.emptyProfile}>{t("profile.inboxEmpty")}</div>
              : <div className={styles.inboxList}>{inboxMessages.map((message) => <article className={`${styles.inboxCard} ${message.isNew ? styles.unreadActivityCard : ""}`} key={message.id}>
                <strong>{t(message.direction === "sent" ? "profile.messageTo" : "profile.messageFrom", { name: message.contact.name })}{message.isNew && <span className={styles.newActivityBadge}>{t("profile.new")}</span>}</strong>
                <span>{t("profile.messageListing", { title: message.listing.title })}</span>
                <p>{message.notification?.type === "VIP_REQUEST_REJECTED"
                  ? t("profile.vipRequestRejectedMessage", { title: message.notification.listingTitle, id: message.notification.listingId })
                  : message.body}</p>
                <small>{new Date(message.createdAt).toLocaleDateString(language)}</small>
                <button type="button" className={styles.activityDeleteButton} onClick={() => void deleteInboxMessage(message)} aria-label={`${t("profile.delete")} — ${message.listing.title}`}><Trash2 size={14} />{t("profile.delete")}</button>
              </article>)}</div>)}
          {profileTab === "orders" && (ordersLoading
            ? <ProfileLoadingSkeleton label={t("profile.loading")} />
            : purchases.length === 0 && sales.length === 0
              ? <div className={styles.emptyProfile}>{t("order.empty")}</div>
              : <div className={styles.ordersList}>
                <h3>{t("order.purchases")}</h3>
                {purchases.length === 0 ? <div className={styles.emptyProfile}>{t("order.empty")}</div> : purchases.map((order) => <article className={styles.orderCard} key={order.id}>
                  <strong>{order.listing.title} · {formatPrice(order.amount / 100)} ₾</strong>
                  {order.seller && <p>{t("listing.seller")}: {order.seller.name}</p>}
                  <p>{t("order.paymentLabel", { method: order.paymentMethod === "CARD" ? t("order.card") : t("order.cash") })}</p>
                  <p>{t("order.deliveryLabel", { method: order.deliveryMethod === "DELIVERY" ? t("order.deliveryService") : t("order.meetup") })}</p>
                  <button type="button" className={styles.activityDeleteButton} onClick={() => void deleteOrderRecord(order, "purchase")} aria-label={`${t("profile.delete")} — ${order.listing.title}`}><Trash2 size={14} />{t("profile.delete")}</button>
                </article>)}
                <h3>{t("order.incoming")}</h3>
                {sales.length === 0 ? <div className={styles.emptyProfile}>{t("order.empty")}</div> : sales.map((order) => <article className={`${styles.orderCard} ${order.isNew ? styles.unreadActivityCard : ""}`} key={order.id}>
                  <strong>{order.listing.title} · {formatPrice(order.amount / 100)} ₾{order.isNew && <span className={styles.newActivityBadge}>{t("profile.new")}</span>}</strong>
                  <p>{t("order.buyerLabel", { name: order.buyerName || order.buyer?.name || "" })}</p>
                  {order.buyerPhone && <p>{t("order.phoneLabel", { phone: order.buyerPhone })}</p>}
                  <p>{t("order.deliveryLabel", { method: order.deliveryMethod === "DELIVERY" ? t("order.deliveryService") : t("order.meetup") })}</p>
                  {order.deliveryAddress && <p>{t("order.addressLabel", { address: order.deliveryAddress })}</p>}
                  <p>{t("order.paymentLabel", { method: order.paymentMethod === "CARD" ? t("order.card") : t("order.cash") })}</p>
                  {order.note && <p>{t("order.noteLabel", { note: order.note })}</p>}
                  <button type="button" className={styles.activityDeleteButton} onClick={() => void deleteOrderRecord(order, "sale")} aria-label={`${t("profile.delete")} — ${order.listing.title}`}><Trash2 size={14} />{t("profile.delete")}</button>
                </article>)}
              </div>)}
        </div>
      </div>}
      {vipPurchaseListing && <div className="modal-backdrop" onMouseDown={(event) => !busy && event.target === event.currentTarget && setVipPurchaseListing(null)}>
        <div className={`modal ${styles.vipPurchaseModal}`} role="dialog" aria-modal="true" aria-labelledby="vip-purchase-modal-title">
          <button className="modal-close" onClick={() => setVipPurchaseListing(null)} aria-label={t("notice.close")} disabled={busy}><X size={20} /></button>
          <div className="modal-brand"><span className="brand-mark"><Star size={18} /></span><span id="vip-purchase-modal-title">{t("vip.purchaseTitle")}</span></div>
          <div className={styles.vipListingPreview}>
            {vipPurchaseListing.imageUrls[0]
              ? <Image className={styles.vipListingThumb} src={vipPurchaseListing.imageUrls[0]} alt={vipPurchaseListing.title} width={72} height={64} unoptimized />
              : <div className={styles.vipListingThumb}><ShoppingBag size={24} /></div>}
            <div><strong>{vipPurchaseListing.title}</strong><span>{formatPrice(vipPurchaseListing.price)} ₾ · {vipPurchaseListing.location}</span></div>
          </div>
          <div className={styles.vipPlanDetails}>
            <strong>{t("vip.duration", { days: VIP_DURATION_HOURS / 24 })}</strong>
            <strong>{t("vip.price", { tetri: VIP_PRICE_TETRI, lari: (VIP_PRICE_TETRI / 100).toFixed(2) })}</strong>
          </div>
          <p className={styles.vipInstruction}>{t("vip.transferInstruction")}</p>
          <div className={styles.vipAccountBlock}>
            <span>{t("vip.recipient")}</span>
            <div><strong dir="ltr">{VIP_RECIPIENT_IBAN}</strong><button type="button" onClick={() => void copyVipAccount()} aria-label={t("vip.copyAccount")}><Copy size={15} />{t("vip.copyAccount")}</button></div>
          </div>
          <p className={styles.vipPaymentReference}>{t("vip.paymentReference", { reference: `${vipPurchaseListing.title} — ${vipPurchaseListing.id}` })}</p>
          <label className={styles.vipTransferReference}>{t("vip.transferReferenceLabel")}
            <input value={vipTransferReference} onChange={(event) => setVipTransferReference(event.currentTarget.value)} maxLength={200} required disabled={busy} placeholder={t("vip.transferReferencePlaceholder")} />
          </label>
          <label className={styles.vipTransferCheck}>
            <input type="checkbox" checked={vipTransferConfirmed} onChange={(event) => setVipTransferConfirmed(event.currentTarget.checked)} disabled={busy} />
            <span>{t("vip.transferConfirm")}</span>
          </label>
          <div className={styles.vipModalActions}>
            <button type="button" className="connect-btn" onClick={() => { setVipPurchaseListing(null); setVipTransferConfirmed(false); setVipTransferReference(""); }} disabled={busy}>{t("vip.cancel")}</button>
            <button type="button" className="sell-btn" onClick={() => void confirmVipPurchase()} disabled={busy || !vipTransferConfirmed || !vipTransferReference.trim()}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{t("vip.submitRequest")}</button>
          </div>
        </div>
      </div>}
      {editingListing && <div className="modal-backdrop" onMouseDown={(event) => !busy && event.target === event.currentTarget && closeEditModal()}>
        <div className="modal sell-modal">
          <button className="modal-close" onClick={closeEditModal} aria-label={t("notice.close")} disabled={busy}><X size={20} /></button>
          <div className="modal-brand"><span className="brand-mark"><Pencil size={17} /></span><span>{t("profile.editTitle")}</span></div>
          <p>{t("profile.editDescription")}</p>
          <form onSubmit={updateOwnListing}>
            <label>{t("sell.titleLabel")}<input name="title" required minLength={4} maxLength={120} defaultValue={editingListing.title} /></label>
            <label>{t("sell.descriptionLabel")}<textarea name="description" required minLength={10} maxLength={5000} defaultValue={editingListing.description} /></label>
            <div className="form-row">
              <label>{t("sell.price")}<input name="price" type="number" min="1" max="999999" step="1" required defaultValue={editingListing.price} /></label>
              <label>{t("sell.condition")}<select name="condition" defaultValue={editingListing.condition}><option value="GOOD">{conditionName("GOOD")}</option><option value="NEW">{conditionName("NEW")}</option><option value="LIKE_NEW">{conditionName("LIKE_NEW")}</option><option value="FAIR">{conditionName("FAIR")}</option></select></label>
            </div>
            <div className="form-row">
              <label>{t("sell.city")}<input name="location" required minLength={2} maxLength={100} defaultValue={editingListing.location} /></label>
              <label>{t("sell.category")}<select name="categoryId" required defaultValue={editingListing.categoryId}>{categoryOptions.map((category) => <option value={category.id} key={category.id}>{categoryName(category)}</option>)}</select></label>
            </div>
            <span className={styles.imageSectionLabel}>{t("profile.images", { count: editImageUrls.length + selectedImages.length, limit: MAX_LISTING_IMAGES })}</span>
            {(editImageUrls.length > 0 || selectedImages.length > 0) && <div className={styles.uploadPreviews} aria-label={t("common.listingImages")}>
              {editImageUrls.map((url, index) => <div className={styles.uploadPreview} key={`${url}-${index}`}>
                <Image src={url} alt={t("common.listingImage", { index: index + 1 })} width={88} height={72} unoptimized />
                <button type="button" className={styles.removeUpload} onClick={() => removeEditImage(index)} aria-label={t("common.removeImage", { index: index + 1 })} disabled={busy}><X size={15} /></button>
              </div>)}
              {selectedImages.map(({ file, previewUrl }, index) => <div className={styles.uploadPreview} key={`${file.name}-${file.lastModified}-${index}`}>
                <Image src={previewUrl} alt={t("common.newImage", { index: index + 1 })} width={88} height={72} unoptimized />
                <button type="button" className={styles.removeUpload} onClick={() => removeSelectedImage(index)} aria-label={t("common.removeNewImage", { index: index + 1 })} disabled={busy}><X size={15} /></button>
              </div>)}
            </div>}
            <label>{t("profile.addImages")}
              <input className={styles.fileInput} type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} multiple onChange={(event) => selectImages(event, editImageUrls.length)} disabled={busy} />
              <small className={styles.uploadHelp}>{t("sell.imageHelp")}</small>
            </label>
            <label>{t("profile.addImageUrls")}
              <input value={editImageUrlText} onChange={(event) => setEditImageUrlText(event.target.value)} placeholder={t("sell.imageUrlPlaceholder")} />
            </label>
            <div className={styles.profileListingActions}>
              <button type="button" className="connect-btn" onClick={closeEditModal} disabled={busy}>{t("profile.cancel")}</button>
              <button className="sell-btn modal-submit" disabled={busy}>{busy ? t("profile.saving") : t("profile.save")} <Check size={17} /></button>
            </div>
          </form>
        </div>
      </div>}
    </main>
  );
}
