"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Trash2, X, Star, Upload, Megaphone } from "lucide-react";
import { formatPrice } from "@/lib/format-price";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import styles from "./admin-dashboard.module.css";

type Tab = "stats" | "listings" | "users" | "categories" | "promotions" | "vipPurchases";
type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  location: string;
  imageUrls: string[];
  categoryId: string;
  status: string;
  isVip: boolean;
  vipAssignedAt?: string | null;
  vipExpiresAt?: string | null;
  seller: { id: string; name: string; email: string };
  category: { id: string; nameKa: string; nameEn: string; slug: string };
};
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
type VipPurchase = {
  id: string;
  amountTetri: number;
  currency: string;
  durationHours: number;
  recipientIban: string;
  paymentReference: string;
  transferReference: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  listing: { id: string; title: string; status: string } | null;
};
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
  _count: { listings: number };
};
type Category = {
  id: string;
  nameKa: string;
  nameEn: string;
  slug: string;
  parentId: string | null;
  _count?: { listings: number; children: number };
};
type Stats = { totalListings: number; totalUsers: number; activeListings: number };
type Props = { currentUserId: string; canManageSuperAdmins: boolean };
type ApiError = { error?: string };

const listingStatuses = ["ACTIVE", "PAUSED", "SOLD", "REMOVED"];
const roles = ["USER", "SUPPORT", "MODERATOR", "ADMIN", "SUPER_ADMIN"];

async function requestJson<T>(
  url: string,
  init: RequestInit | undefined,
  translateMessage: (message: string | undefined) => string | undefined,
  messages: { invalidResponse: string; emptyResponse: string; requestFailed: string }
): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: unknown = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error("Admin API returned invalid JSON", error);
      if (response.ok) throw new Error(messages.invalidResponse);
    }
  }
  if (!response.ok) {
    const rawMessage = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
      ? data.error
      : undefined;
    const message = translateMessage(rawMessage) || rawMessage || messages.requestFailed;
    throw new Error(message);
  }
  if (data === null) throw new Error(messages.emptyResponse);
  return data as T;
}

export function AdminDashboard({ currentUserId, canManageSuperAdmins }: Props) {
  const { language, t, translateServerMessage, categoryName, conditionName, statusName } = useI18n();
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<Stats>({ totalListings: 0, totalUsers: 0, activeListings: 0 });
  const [listings, setListings] = useState<Listing[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [vipPurchases, setVipPurchases] = useState<VipPurchase[]>([]);
  const [vipPurchasesLoading, setVipPurchasesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [vipManageListing, setVipManageListing] = useState<Listing | null>(null);
  const [vipDaysInput, setVipDaysInput] = useState("1");
  const [promotionImageFile, setPromotionImageFile] = useState<File | null>(null);

  const request = useCallback(<T,>(url: string, init?: RequestInit) => requestJson<T>(
      url,
      init,
      translateServerMessage,
      {
        invalidResponse: t("admin.invalidResponse"),
        emptyResponse: t("admin.emptyResponse"),
        requestFailed: t("admin.requestFailed")
      }
    ), [translateServerMessage, t]);

  const fetchDashboardData = useCallback(async () => {
    return Promise.all([
      request<Stats>("/api/admin/stats"),
      request<{ listings: Listing[] }>("/api/admin/listings"),
      request<{ users: User[] }>("/api/admin/users"),
      request<{ categories: Category[] }>("/api/admin/categories"),
      request<{ promotions: Promotion[] }>("/api/admin/promotions")
    ]);
  }, [request]);

  function applyDashboardData(
    [statsData, listingData, userData, categoryData, promotionData]: Awaited<ReturnType<typeof fetchDashboardData>>
  ) {
    setStats(statsData);
    setListings(listingData.listings);
    setUsers(userData.users);
    setCategories(categoryData.categories);
    setPromotions(promotionData.promotions);
  }

  async function loadDashboard() {
    try {
      applyDashboardData(await fetchDashboardData());
    } catch (error) {
      console.error("Admin dashboard load failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.dashboardLoadFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function loadVipPurchases() {
    setVipPurchasesLoading(true);
    try {
      const data = await request<{ purchases: VipPurchase[] }>("/api/admin/vip-purchases");
      setVipPurchases(data.purchases);
    } catch (error) {
      console.error("Pending VIP purchases could not be loaded", error);
      setNotice(error instanceof Error ? error.message : t("admin.vipRequestsLoadFailed"));
    } finally {
      setVipPurchasesLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchDashboardData()
      .then(([statsData, listingData, userData, categoryData, promotionData]) => {
        if (!active) return;
        setStats(statsData);
        setListings(listingData.listings);
        setUsers(userData.users);
        setCategories(categoryData.categories);
        setPromotions(promotionData.promotions);
      })
      .catch((error: unknown) => {
        console.error("Admin dashboard load failed", error);
        if (active) setNotice(error instanceof Error ? error.message : t("admin.dashboardLoadFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchDashboardData, t]);

  function refreshDashboard() {
    setLoading(true);
    void loadDashboard();
  }

  async function changeListingStatus(listingId: string, status: string) {
    setBusyId(listingId);
    try {
      const data = await request<{ listing: Listing }>(`/api/admin/listings/${listingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status })
      });
      setListings((current) => current.map((listing) => listing.id === listingId ? { ...listing, ...data.listing } : listing));
      setStats((current) => {
        const oldListing = listings.find((listing) => listing.id === listingId);
        const wasActive = oldListing?.status === "ACTIVE";
        const isActive = status === "ACTIVE";
        return { ...current, activeListings: current.activeListings + Number(isActive) - Number(wasActive) };
      });
      setNotice(t("admin.statusUpdated"));
    } catch (error) {
      console.error("Admin listing status update failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.statusFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function updateListingVipDuration(action: "ADD_DAYS" | "SUBTRACT_DAYS" | "SET_DAYS" | "REVOKE", requestedDays?: number) {
    const listing = vipManageListing;
    if (!listing) return;
    if (action === "REVOKE" && !window.confirm(t("admin.vipRevokeConfirm"))) return;
    if (action !== "REVOKE" && (!Number.isInteger(requestedDays) || !requestedDays || requestedDays < 1 || requestedDays > 3650)) {
      setNotice(t("admin.vipDurationInvalid"));
      return;
    }

    setBusyId(listing.id);
    try {
      const data = await request<{ listing: Listing }>(`/api/admin/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "REVOKE" ? { vipAction: action } : { vipAction: action, days: requestedDays })
      });
      const updatedListing = { ...listing, ...data.listing };
      setListings((current) => current.map((item) => item.id === listing.id ? updatedListing : item));
      setVipManageListing(updatedListing);
      setNotice(data.listing.isVip ? t("admin.vipDurationUpdated") : t("admin.vipDisabled"));
    } catch (error) {
      console.error("Admin listing VIP duration update failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.vipUpdateFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function reviewVipPurchase(purchase: VipPurchase, decision: "APPROVE" | "REJECT") {
    const confirmationKey = decision === "APPROVE" ? "admin.vipApproveConfirm" : "admin.vipRejectConfirm";
    if (!window.confirm(t(confirmationKey))) return;
    setBusyId(purchase.id);
    try {
      const data = await request<{ purchase: VipPurchase; listing: { id: string; isVip: boolean; vipAssignedAt: string | null; vipExpiresAt: string | null } | null }>(
        `/api/admin/vip-purchases/${purchase.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision })
        }
      );
      setVipPurchases((current) => current.filter((item) => item.id !== purchase.id));
      if (data.listing) {
        setListings((current) => current.map((item) => item.id === data.listing!.id
          ? { ...item, isVip: data.listing!.isVip, vipAssignedAt: data.listing!.vipAssignedAt, vipExpiresAt: data.listing!.vipExpiresAt }
          : item));
      }
      setNotice(t(decision === "APPROVE" ? "admin.vipRequestApproved" : "admin.vipRequestRejected"));
    } catch (error) {
      console.error("VIP purchase review failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.vipRequestFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function deleteListing(listing: Listing) {
    if (!window.confirm(t("profile.deleteConfirm"))) return;
    setBusyId(listing.id);
    try {
      const data = await request<{ success: boolean; warning?: string }>(`/api/admin/listings/${listing.id}`, { method: "DELETE" });
      setListings((current) => current.filter((item) => item.id !== listing.id));
      setStats((current) => ({
        ...current,
        totalListings: Math.max(0, current.totalListings - 1),
        activeListings: Math.max(0, current.activeListings - Number(listing.status === "ACTIVE"))
      }));
      setNotice(data.warning ? (translateServerMessage(data.warning) || data.warning) : t("admin.listingDeleted"));
    } catch (error) {
      console.error("Admin listing deletion failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.deleteFailed"));
    } finally {
      setBusyId("");
    }
  }

  function editListing(listing: Listing) {
    setEditingListing(listing);
  }

  async function saveListing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingListing) return;
    const form = new FormData(event.currentTarget);
    const imageUrls = String(form.get("imageUrls") || "").split(/[\n,]/).map((url) => url.trim()).filter(Boolean);
    setBusyId(editingListing.id);
    try {
      const data = await request<{ listing: Listing; warning?: string }>(`/api/admin/listings/${editingListing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          price: Number(form.get("price")),
          condition: form.get("condition"),
          location: form.get("location"),
          categoryId: form.get("categoryId"),
          status: form.get("status"),
          imageUrls
        })
      });
      setListings((current) => current.map((listing) => listing.id === data.listing.id ? data.listing : listing));
      setEditingListing(null);
      setNotice(data.warning ? (translateServerMessage(data.warning) || data.warning) : t("admin.listingUpdated"));
    } catch (error) {
      console.error("Admin listing edit failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.updateFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function updateUser(userId: string, changes: { role?: string; isBanned?: boolean }) {
    if (changes.isBanned && !window.confirm(t("admin.banConfirm"))) return;
    setBusyId(userId);
    try {
      const data = await request<{ user: User }>(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes)
      });
      setUsers((current) => current.map((user) => user.id === userId ? data.user : user));
      setNotice(changes.isBanned === undefined ? t("admin.userRoleUpdated") : data.user.isBanned ? t("admin.userBanned") : t("admin.userUnbanned"));
    } catch (error) {
      console.error("Admin user update failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.userUpdateFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const categoryInput = {
      nameKa: form.get("nameKa"),
      nameEn: form.get("nameEn"),
      slug: form.get("slug"),
      parentId: form.get("parentId") || null
    };
    const endpoint = editingCategory ? `/api/admin/categories/${editingCategory.id}` : "/api/admin/categories";
    setBusyId("category");
    try {
      await request(endpoint, {
        method: editingCategory ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(categoryInput)
      });
      setEditingCategory(null);
      setLoading(true);
      await loadDashboard();
      setNotice(editingCategory ? t("admin.categoryUpdated") : t("admin.categoryAdded"));
    } catch (error) {
      console.error("Admin category save failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.categorySaveFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(t("admin.categoryDeleteConfirm", { name: categoryName(category) }))) return;
    setBusyId(category.id);
    try {
      await request(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setNotice(t("admin.categoryDeleted"));
    } catch (error) {
      console.error("Admin category deletion failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.categoryDeleteFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function savePromotion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let imageUrl = String(form.get("imageUrl") || "").trim() || null;
    setBusyId("promotion");
    try {
      if (promotionImageFile) {
        const upload = new FormData();
        upload.append("images", promotionImageFile);
        const uploaded = await request<{ imageUrls: string[] }>("/api/uploads", { method: "POST", body: upload });
        if (!uploaded.imageUrls[0]) throw new Error(t("admin.promotionImageFailed"));
        imageUrl = uploaded.imageUrls[0];
      }
      const promotionInput = {
        kind: form.get("kind"),
        placement: form.get("placement"),
        titleKa: form.get("titleKa"),
        titleEn: form.get("titleEn"),
        titleRu: form.get("titleRu"),
        descriptionKa: form.get("descriptionKa"),
        descriptionEn: form.get("descriptionEn"),
        descriptionRu: form.get("descriptionRu"),
        ctaKa: form.get("ctaKa"),
        ctaEn: form.get("ctaEn"),
        ctaRu: form.get("ctaRu"),
        imageUrl,
        targetUrl: form.get("targetUrl"),
        isActive: form.get("isActive") === "on",
        sortOrder: Number(form.get("sortOrder") || 0)
      };
      const endpoint = editingPromotion ? `/api/admin/promotions/${editingPromotion.id}` : "/api/admin/promotions";
      const data = await request<{ promotion: Promotion }>(endpoint, {
        method: editingPromotion ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(promotionInput)
      });
      setPromotions((current) => editingPromotion
        ? current.map((promotion) => promotion.id === data.promotion.id ? data.promotion : promotion).sort((a, b) => a.sortOrder - b.sortOrder)
        : [...current, data.promotion].sort((a, b) => a.sortOrder - b.sortOrder));
      setEditingPromotion(null);
      setPromotionImageFile(null);
      setNotice(editingPromotion ? t("admin.promotionUpdated") : t("admin.promotionAdded"));
    } catch (error) {
      console.error("Promotion save failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.promotionSaveFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function togglePromotion(promotion: Promotion) {
    setBusyId(promotion.id);
    try {
      const data = await request<{ promotion: Promotion }>(`/api/admin/promotions/${promotion.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !promotion.isActive })
      });
      setPromotions((current) => current.map((item) => item.id === promotion.id ? data.promotion : item));
      setNotice(data.promotion.isActive ? t("admin.promotionActivated") : t("admin.promotionDeactivated"));
    } catch (error) {
      console.error("Promotion activation update failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.promotionSaveFailed"));
    } finally {
      setBusyId("");
    }
  }

  async function deletePromotion(promotion: Promotion) {
    if (!window.confirm(t("admin.promotionDeleteConfirm"))) return;
    setBusyId(promotion.id);
    try {
      await request(`/api/admin/promotions/${promotion.id}`, { method: "DELETE" });
      setPromotions((current) => current.filter((item) => item.id !== promotion.id));
      if (editingPromotion?.id === promotion.id) setEditingPromotion(null);
      setNotice(t("admin.promotionDeleted"));
    } catch (error) {
      console.error("Promotion deletion failed", error);
      setNotice(error instanceof Error ? error.message : t("admin.promotionSaveFailed"));
    } finally {
      setBusyId("");
    }
  }

  const tabLabels: Record<Tab, string> = {
    stats: t("admin.tab.stats"),
    listings: t("admin.tab.listings"),
    users: t("admin.tab.users"),
    categories: t("admin.tab.categories"),
    promotions: t("admin.tab.promotions"),
    vipPurchases: t("admin.tab.vipPurchases")
  };
  const roleLabels: Record<string, string> = {
    USER: t("admin.role.user"),
    SUPPORT: t("admin.role.support"),
    MODERATOR: t("admin.role.moderator"),
    ADMIN: t("admin.role.admin"),
    SUPER_ADMIN: t("admin.role.superAdmin")
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/"><ArrowLeft size={16} /> {t("admin.back")}</Link>
          <h1>{t("admin.title")}</h1>
          <p>{t("admin.description")}</p>
        </div>
        <div className={styles.headerActions}>
          <LanguageSwitcher className={styles.languageSwitcher} activeClassName={styles.languageActive} />
          <button className={styles.refreshButton} onClick={refreshDashboard} disabled={loading}>{t("admin.refresh")}</button>
        </div>
      </header>

      <nav className={styles.tabs} aria-label={t("admin.tabsLabel")}>
        {(Object.keys(tabLabels) as Tab[]).map((key) => <button key={key} className={tab === key ? styles.activeTab : ""} onClick={() => { setTab(key); if (key === "vipPurchases") void loadVipPurchases(); }}>{tabLabels[key]}</button>)}
      </nav>

      {notice && <div className={styles.notice} role="status">{notice}<button onClick={() => setNotice("")} aria-label={t("admin.closeNotice")}><X size={15} /></button></div>}
      {loading ? <div className={styles.loading}>{t("admin.loading")}</div> : <>
        {tab === "stats" && <section className={styles.statsGrid} aria-label={t("admin.siteStats")}>
          <article><span>{t("admin.totalListings")}</span><strong>{stats.totalListings}</strong></article>
          <article><span>{t("admin.totalUsers")}</span><strong>{stats.totalUsers}</strong></article>
          <article><span>{t("admin.activeListings")}</span><strong>{stats.activeListings}</strong></article>
        </section>}

        {tab === "listings" && <section className={styles.panel}>
          <h2>{t("admin.totalListings")} <span>({listings.length})</span></h2>
          {listings.length === 0 ? <p className={styles.emptyState}>{t("admin.listingsEmpty")}</p> : <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>{t("admin.column.listing")}</th><th>{t("admin.column.seller")}</th><th>{t("admin.column.category")}</th><th>{t("admin.column.status")}</th><th>{t("admin.vipStatus")}</th><th>{t("admin.column.actions")}</th></tr></thead>
              <tbody>{listings.map((listing) => <tr key={listing.id}>
                <td><strong>{listing.title}</strong><small>{formatPrice(listing.price)} ₾ · {listing.location}</small></td>
                <td>{listing.seller.name}<small>{listing.seller.email}</small></td>
                <td>{categoryName(listing.category)}</td>
                <td><select value={listing.status} disabled={busyId === listing.id} onChange={(event) => void changeListingStatus(listing.id, event.target.value)}>
                  {listingStatuses.map((status) => <option value={status} key={status}>{statusName(status)}</option>)}
                </select></td>
                <td><strong className={listing.isVip ? styles.vipStatusActive : styles.vipStatusInactive}>{listing.isVip ? t("admin.vipActive") : t("admin.vipInactive")}</strong>
                  {listing.isVip && listing.vipExpiresAt && <small>{t("admin.vipExpiry", { date: new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(listing.vipExpiresAt)) })}</small>}
                  {listing.isVip && !listing.vipExpiresAt && <small>{t("admin.vipNoExpiration")}</small>}
                </td>
                <td><div className={styles.actions}>
                  <button className={listing.isVip ? styles.vipActive : styles.vipAction} onClick={() => { setVipManageListing(listing); setVipDaysInput("1"); }} aria-label={t("admin.vipManage")} aria-haspopup="dialog" disabled={busyId === listing.id}><Star size={15} fill={listing.isVip ? "currentColor" : "none"} /></button>
                  <button onClick={() => editListing(listing)} aria-label={t("admin.editListing")}><Pencil size={15} /></button>
                  <button className={styles.deleteAction} onClick={() => void deleteListing(listing)} aria-label={t("admin.deleteListing")} disabled={busyId === listing.id}><Trash2 size={15} /></button>
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>}
        </section>}

        {tab === "users" && <section className={styles.panel}>
          <h2>{t("admin.usersCount", { count: users.length })}</h2>
          <div className={styles.userList}>{users.map((user) => <article className={styles.userRow} key={user.id}>
            <div className={styles.userDetails}>
              <strong>{user.name} {user.id === currentUserId && <small>{t("admin.userSelf")}</small>}</strong>
              <span>{user.email}</span>
              <small>{t("admin.listingCount", { count: user._count.listings })} · {new Date(user.createdAt).toISOString().slice(0, 10)}</small>
            </div>
            <div className={styles.userActions}>
              <select value={user.role} disabled={busyId === user.id || user.id === currentUserId || (user.role === "SUPER_ADMIN" && !canManageSuperAdmins)} onChange={(event) => void updateUser(user.id, { role: event.target.value })} aria-label={t("admin.userRoleLabel", { name: user.name })}>
                {roles.filter((value) => value !== "SUPER_ADMIN" || canManageSuperAdmins).map((value) => <option value={value} key={value}>{roleLabels[value]}</option>)}
              </select>
              <button className={user.isBanned ? styles.unbanButton : styles.banButton} onClick={() => void updateUser(user.id, { isBanned: !user.isBanned })} disabled={busyId === user.id || user.id === currentUserId || (user.role === "SUPER_ADMIN" && !canManageSuperAdmins)}>
                {user.isBanned ? t("admin.unban") : t("admin.ban")}
              </button>
            </div>
          </article>)}</div>
        </section>}

        {tab === "categories" && <section className={styles.panel}>
          <h2>{t("admin.tab.categories")} <span>({categories.length})</span></h2>
          <form className={styles.categoryForm} key={editingCategory?.id || "new-category"} onSubmit={saveCategory}>
            <h3>{editingCategory ? t("admin.categoryEdit") : t("admin.categoryAdd")}</h3>
            <div className={styles.categoryFields}>
              <label>{t("admin.categoryNameKa")}<input name="nameKa" required minLength={2} maxLength={100} defaultValue={editingCategory?.nameKa || ""} /></label>
              <label>{t("admin.categoryNameEn")}<input name="nameEn" required minLength={2} maxLength={100} defaultValue={editingCategory?.nameEn || ""} /></label>
              <label>{t("admin.categorySlug")}<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={editingCategory?.slug || ""} /></label>
              <label>{t("admin.parentCategory")}<select name="parentId" defaultValue={editingCategory?.parentId || ""}><option value="">{t("admin.rootCategory")}</option>{categories.filter((category) => category.id !== editingCategory?.id).map((category) => <option value={category.id} key={category.id}>{categoryName(category)}</option>)}</select></label>
            </div>
            <div className={styles.actions}>
              <button className={styles.primaryButton} disabled={busyId === "category"}>{busyId === "category" ? t("admin.saving") : editingCategory ? t("admin.categorySave") : t("admin.add")}</button>
              {editingCategory && <button type="button" onClick={() => setEditingCategory(null)}>{t("common.cancel")}</button>}
            </div>
          </form>
          <div className={styles.categoryList}>{categories.map((category) => <article className={styles.categoryRow} key={category.id}>
            <div><strong>{categoryName(category)}</strong><span>{category.slug} · {t("admin.categoryListingsCount", { count: category._count?.listings || 0 })}</span></div>
            <div className={styles.actions}>
              <button onClick={() => setEditingCategory(category)} aria-label={t("admin.editCategoryAria", { name: categoryName(category) })}><Pencil size={15} /></button>
              <button className={styles.deleteAction} onClick={() => void deleteCategory(category)} aria-label={t("admin.deleteCategoryAria", { name: categoryName(category) })} disabled={busyId === category.id}><Trash2 size={15} /></button>
            </div>
          </article>)}</div>
        </section>}

        {tab === "vipPurchases" && <section className={styles.panel}>
          <div className={styles.vipRequestsHeading}>
            <h2>{t("admin.tab.vipPurchases")} <span>({vipPurchases.length})</span></h2>
            <button type="button" className={styles.refreshButton} onClick={() => void loadVipPurchases()} disabled={vipPurchasesLoading}>{t("admin.refresh")}</button>
          </div>
          {vipPurchasesLoading ? <p className={styles.emptyState}>{t("admin.loading")}</p> : vipPurchases.length === 0
            ? <p className={styles.emptyState}>{t("admin.vipRequestsEmpty")}</p>
            : <div className={styles.vipRequestList}>{vipPurchases.map((purchase) => <article className={styles.vipRequestCard} key={purchase.id}>
              <div className={styles.vipRequestDetails}>
                <strong>{purchase.listing?.title || t("admin.vipRequestListingMissing")}</strong>
                <span>{t("admin.vipRequestListing")}: {purchase.listing?.id || purchase.id}</span>
                {purchase.listing && <span>{t("admin.column.status")}: {statusName(purchase.listing.status)}</span>}
                <span>{t("admin.vipRequestUser")}: {purchase.user.name} · {purchase.user.email}</span>
                <span>{t("admin.vipRequestAmount")}: {(purchase.amountTetri / 100).toFixed(2)} {purchase.currency}</span>
                <span>{t("admin.vipRequestDuration")}: {purchase.durationHours} h</span>
                <span>{t("admin.vipRequestRecipient")}: {purchase.recipientIban}</span>
                <span>{t("admin.vipRequestPaymentReference")}: {purchase.paymentReference}</span>
                <span>{t("admin.vipRequestTransferReference")}: {purchase.transferReference}</span>
                <small>{new Date(purchase.createdAt).toLocaleString()}</small>
              </div>
              <div className={styles.vipRequestActions}>
                <button type="button" className={styles.primaryButton} onClick={() => void reviewVipPurchase(purchase, "APPROVE")} disabled={busyId === purchase.id}>{t("admin.vipApprove")}</button>
                <button type="button" className={styles.rejectButton} onClick={() => void reviewVipPurchase(purchase, "REJECT")} disabled={busyId === purchase.id}>{t("admin.vipReject")}</button>
              </div>
            </article>)}</div>}
        </section>}

        {tab === "promotions" && <section className={styles.panel}>
          <h2>{t("admin.tab.promotions")} <span>({promotions.length})</span></h2>
          <form className={styles.promotionForm} key={editingPromotion?.id || "new-promotion"} onSubmit={savePromotion}>
            <h3>{editingPromotion ? t("admin.promotionEdit") : t("admin.promotionAdd")}</h3>
            <div className={styles.promotionFields}>
              <label>{t("admin.promotionTitleKa")}<input name="titleKa" required minLength={2} maxLength={120} defaultValue={editingPromotion?.titleKa || ""} /></label>
              <label>{t("admin.promotionTitleEn")}<input name="titleEn" required minLength={2} maxLength={120} defaultValue={editingPromotion?.titleEn || ""} /></label>
              <label>{t("admin.promotionTitleRu")}<input name="titleRu" required minLength={2} maxLength={120} defaultValue={editingPromotion?.titleRu || ""} /></label>
              <label>{t("admin.promotionDescriptionKa")}<textarea name="descriptionKa" maxLength={500} defaultValue={editingPromotion?.descriptionKa || ""} /></label>
              <label>{t("admin.promotionDescriptionEn")}<textarea name="descriptionEn" maxLength={500} defaultValue={editingPromotion?.descriptionEn || ""} /></label>
              <label>{t("admin.promotionDescriptionRu")}<textarea name="descriptionRu" maxLength={500} defaultValue={editingPromotion?.descriptionRu || ""} /></label>
              <label>{t("admin.promotionCtaKa")}<input name="ctaKa" maxLength={60} defaultValue={editingPromotion?.ctaKa || ""} /></label>
              <label>{t("admin.promotionCtaEn")}<input name="ctaEn" maxLength={60} defaultValue={editingPromotion?.ctaEn || ""} /></label>
              <label>{t("admin.promotionCtaRu")}<input name="ctaRu" maxLength={60} defaultValue={editingPromotion?.ctaRu || ""} /></label>
            </div>
            <div className={styles.promotionFields}>
              <label>{t("admin.promotionKind")}<select name="kind" defaultValue={editingPromotion?.kind || "INTERNAL"}><option value="INTERNAL">{t("promotion.internalLabel")}</option><option value="PARTNER">{t("promotion.partnerLabel")}</option></select></label>
              <label>{t("admin.promotionPlacement")}<select name="placement" defaultValue={editingPromotion?.placement || "CAROUSEL"}><option value="CAROUSEL">{t("promotion.carouselSlot")}</option><option value="FEED">{t("promotion.feedSlot")}</option><option value="TICKER">{t("promotion.tickerSlot")}</option></select></label>
              <label>{t("admin.promotionSort")}<input name="sortOrder" type="number" min="-1000" max="1000" defaultValue={editingPromotion?.sortOrder ?? 0} /></label>
            </div>
            <div className={styles.promotionFields}>
              <label>{t("admin.promotionImageUrl")}<input name="imageUrl" type="url" defaultValue={editingPromotion?.imageUrl || ""} placeholder="https://example.com/banner.jpg" /></label>
              <label className={styles.promotionUpload}>{t("admin.promotionUpload")}<span><Upload size={15} />{promotionImageFile?.name || t("admin.promotionChooseImage")}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPromotionImageFile(event.target.files?.[0] || null)} /></label>
              <label>{t("admin.promotionTarget")}<input name="targetUrl" defaultValue={editingPromotion?.targetUrl || ""} placeholder="/#listings" /></label>
            </div>
            {editingPromotion?.imageUrl && <Image className={styles.promotionPreview} src={editingPromotion.imageUrl} alt={editingPromotion.titleEn} width={280} height={100} unoptimized />}
            <label className={styles.promotionActive}><input name="isActive" type="checkbox" defaultChecked={editingPromotion?.isActive ?? true} />{t("admin.promotionActive")}</label>
            <div className={styles.actions}>
              <button className={styles.primaryButton} disabled={busyId === "promotion"}>{busyId === "promotion" ? t("admin.saving") : t("admin.promotionSave")}</button>
              {editingPromotion && <button type="button" onClick={() => { setEditingPromotion(null); setPromotionImageFile(null); }}>{t("common.cancel")}</button>}
            </div>
          </form>
          {promotions.length === 0 ? <p className={styles.emptyState}>{t("admin.promotionsEmpty")}</p> : <div className={styles.promotionList}>
            {promotions.map((promotion) => <article className={styles.promotionRow} key={promotion.id}>
              <div className={styles.promotionRowInfo}>
                {promotion.imageUrl ? <Image className={styles.promotionThumb} src={promotion.imageUrl} alt="" width={100} height={62} unoptimized /> : <span className={styles.promotionThumbFallback}><Megaphone size={20} /></span>}
                <div><strong>{promotion.titleEn}</strong><span>{t(promotion.kind === "PARTNER" ? "promotion.partnerLabel" : "promotion.internalLabel")} · {t(promotion.placement === "CAROUSEL" ? "promotion.carouselSlot" : promotion.placement === "FEED" ? "promotion.feedSlot" : "promotion.tickerSlot")}</span><small>{promotion.isActive ? t("admin.promotionActive") : t("admin.promotionInactive")}</small></div>
              </div>
              <div className={styles.actions}>
                <button onClick={() => { setEditingPromotion(promotion); setPromotionImageFile(null); }} aria-label={t("admin.promotionEdit")}><Pencil size={15} /></button>
                <button onClick={() => void togglePromotion(promotion)} disabled={busyId === promotion.id} aria-label={promotion.isActive ? t("admin.promotionDeactivate") : t("admin.promotionActivate")}>{promotion.isActive ? t("admin.promotionDeactivate") : t("admin.promotionActivate")}</button>
                <button className={styles.deleteAction} onClick={() => void deletePromotion(promotion)} disabled={busyId === promotion.id} aria-label={t("admin.promotionDelete")}><Trash2 size={15} /></button>
              </div>
            </article>)}
          </div>}
        </section>}
      </>}

      {editingListing && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditingListing(null)}>
        <div className="modal sell-modal">
          <button className="modal-close" onClick={() => setEditingListing(null)} aria-label={t("notice.close")}><X size={20} /></button>
          <div className="modal-brand"><span className="brand-mark"><Pencil size={17} /></span><span>{t("admin.listingManage")}</span></div>
          <p>{editingListing.seller.name} · {editingListing.seller.email}</p>
          <form onSubmit={saveListing}>
            <label>{t("admin.listingTitle")}<input name="title" required minLength={4} maxLength={120} defaultValue={editingListing.title} /></label>
            <label>{t("admin.listingDescription")}<textarea name="description" required minLength={10} defaultValue={editingListing.description} /></label>
            <div className="form-row">
              <label>{t("admin.price")}<input name="price" type="number" min="1" max="999999" required defaultValue={editingListing.price} /></label>
              <label>{t("admin.condition")}<select name="condition" defaultValue={editingListing.condition}><option value="NEW">{conditionName("NEW")}</option><option value="LIKE_NEW">{conditionName("LIKE_NEW")}</option><option value="GOOD">{conditionName("GOOD")}</option><option value="FAIR">{conditionName("FAIR")}</option></select></label>
            </div>
            <div className="form-row">
              <label>{t("admin.city")}<input name="location" required defaultValue={editingListing.location} /></label>
              <label>{t("admin.column.category")}<select name="categoryId" defaultValue={editingListing.categoryId}>{categories.map((category) => <option value={category.id} key={category.id}>{categoryName(category)}</option>)}</select></label>
            </div>
            <label>{t("admin.status")}<select name="status" defaultValue={editingListing.status}>{listingStatuses.map((status) => <option value={status} key={status}>{statusName(status)}</option>)}</select></label>
            <label>{t("admin.imageUrls")}<textarea name="imageUrls" defaultValue={editingListing.imageUrls.join("\n")} /></label>
            <button className={styles.primaryButton} disabled={busyId === editingListing.id}>{busyId === editingListing.id ? t("admin.saving") : t("admin.categorySave")}</button>
          </form>
        </div>
      </div>}
      {vipManageListing && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setVipManageListing(null)}>
        <section className={`modal ${styles.vipDurationModal}`} role="dialog" aria-modal="true" aria-labelledby="vip-duration-title">
          <button className="modal-close" onClick={() => setVipManageListing(null)} aria-label={t("notice.close")}><X size={20} /></button>
          <div className="modal-brand"><span className="brand-mark"><Star size={17} /></span><span id="vip-duration-title">{t("admin.vipManage")}</span></div>
          <p>{vipManageListing.title}</p>
          <div className={styles.vipDurationStatus}>
            <strong className={vipManageListing.isVip ? styles.vipStatusActive : styles.vipStatusInactive}>{vipManageListing.isVip ? t("admin.vipActive") : t("admin.vipInactive")}</strong>
            {vipManageListing.isVip && vipManageListing.vipExpiresAt
              ? <span>{t("admin.vipExpiry", { date: new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(vipManageListing.vipExpiresAt)) })}</span>
              : vipManageListing.isVip && <span>{t("admin.vipNoExpiration")}</span>}
          </div>
          <div className={styles.vipQuickActions}>
            <button type="button" onClick={() => void updateListingVipDuration("ADD_DAYS", 1)} disabled={busyId === vipManageListing.id}>+1 {t("admin.day")}</button>
            <button type="button" onClick={() => void updateListingVipDuration("ADD_DAYS", 7)} disabled={busyId === vipManageListing.id}>+7 {t("admin.days")}</button>
          </div>
          <label className={styles.vipDaysField}>{t("admin.vipCustomDays")}
            <input type="number" min="1" max="3650" step="1" value={vipDaysInput} onChange={(event) => setVipDaysInput(event.target.value)} />
          </label>
          <div className={styles.vipDurationActions}>
            <button type="button" onClick={() => void updateListingVipDuration("ADD_DAYS", Number(vipDaysInput))} disabled={busyId === vipManageListing.id}>{t("admin.vipAddDays")}</button>
            <button type="button" onClick={() => void updateListingVipDuration("SUBTRACT_DAYS", Number(vipDaysInput))} disabled={busyId === vipManageListing.id}>{t("admin.vipSubtractDays")}</button>
            <button type="button" className={styles.primaryButton} onClick={() => void updateListingVipDuration("SET_DAYS", Number(vipDaysInput))} disabled={busyId === vipManageListing.id}>{t("admin.vipSetDays")}</button>
            {vipManageListing.isVip && <button type="button" className={styles.deleteAction} onClick={() => void updateListingVipDuration("REVOKE")} disabled={busyId === vipManageListing.id}>{t("admin.vipRevoke")}</button>}
          </div>
        </section>
      </div>}
    </main>
  );
}
