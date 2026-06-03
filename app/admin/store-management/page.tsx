"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SiteLoader } from "@/components/ui/site-loader"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ShoppingBag, Tag, Package, Plus, Trash2, Image as ImageIcon, X, Lock, Unlock } from "lucide-react";
import { useAdminAuth } from "@/hooks/use-admin-auth"

type StoreAddDialogView = "product" | "category" | null

export function StoreManagementContent({
  displayMode = "page",
  onInlineActionsChange,
}: {
  displayMode?: "page" | "inline"
  onInlineActionsChange?: (actions: { openOrders: () => void; openAddProduct: () => void; openAddCategory: () => void }) => void
}) {
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("إدارة المتجر");
  const searchParams = useSearchParams();
  const isEmbedded = displayMode === "inline" || searchParams.get("embedded") === "1";

  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [addDialogView, setAddDialogView] = useState<StoreAddDialogView>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);
  const [isStoreOpen, setIsStoreOpen] = useState(true)
  const [isStoreStatusLoading, setIsStoreStatusLoading] = useState(true)
  const [isSavingStoreStatus, setIsSavingStoreStatus] = useState(false)

  function showConfirm(msg: string, cb: () => void) {
    setConfirmMessage(msg);
    setConfirmCallback(() => cb);
    setConfirmOpen(true);
  }
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!onInlineActionsChange) {
      return
    }

    onInlineActionsChange({
      openOrders: () => {},
      openAddProduct: () => setAddDialogView("product"),
      openAddCategory: () => setAddDialogView("category"),
    })

    return () => {
      onInlineActionsChange({
        openOrders: () => {},
        openAddProduct: () => {},
        openAddCategory: () => {},
      })
    }
  }, [onInlineActionsChange, router])

  useEffect(() => {
    void Promise.all([fetchData(), fetchStoreStatus()]);
  }, []);

  async function fetchData() {
    setLoading(true);
    const supabase = getSupabase();
    const { data: productsData } = await supabase.from("store_products").select("*").order('created_at', { ascending: false });
    const { data: categoriesData } = await supabase.from("store_categories").select("*");
    setProducts(productsData || []);
    setCategories(categoriesData || []);
    setLoading(false);
  }

  async function fetchStoreStatus() {
    setIsStoreStatusLoading(true)
    try {
      const response = await fetch("/api/store/status", { cache: "no-store" })
      const data = response.ok ? await response.json().catch(() => null) : null
      setIsStoreOpen(data?.isOpen !== false)
    } catch {
      setIsStoreOpen(true)
    } finally {
      setIsStoreStatusLoading(false)
    }
  }

  async function handleToggleStoreStatus() {
    setIsSavingStoreStatus(true)
    try {
      const response = await fetch("/api/store/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: !isStoreOpen }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        alert(data?.error || "تعذر تحديث حالة المتجر")
        return
      }

      setIsStoreOpen(data?.value?.isOpen !== false)
    } catch {
      alert("حدث خطأ أثناء تحديث حالة المتجر")
    } finally {
      setIsSavingStoreStatus(false)
    }
  }

  async function handleAddProduct(e: any) {
    e.preventDefault();
    if (!name || !price || !selectedCategoryId) {
      alert("يرجى تعبئة جميع الحقول واختيار الفئة");
      return;
    }
    setLoading(true);
    let imageUrl = null;
    try {
      if (imageFile) {
        const supabase = getSupabase();
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        const { error } = await supabase.storage.from("store-products").upload(fileName, imageFile);
        if (error) {
          alert("فشل رفع الصورة: " + error.message);
          setLoading(false);
          return;
        }
        imageUrl = supabase.storage.from("store-products").getPublicUrl(fileName).data.publicUrl;
      }
      const supabase = getSupabase();
      const { error: insertError } = await supabase.from("store_products").insert({
          name,
          price: Number(price),
          category_id: selectedCategoryId,
          image_url: imageUrl,
        });
      if (insertError) {
        alert("فشل إضافة المنتج: " + insertError.message);
        setLoading(false);
        return;
      }
      alert("تمت إضافة المنتج بنجاح");
      setName("");
      setPrice("");
      setSelectedCategoryId("");
      setImageFile(null);
      setAddDialogView(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchData();
    } catch (err) {
      alert("حدث خطأ غير متوقع");
    }
    setLoading(false);
  }

  async function handleAddCategory(e: any) {
    e.preventDefault();
    if (!newCategory) return;
    setLoading(true);
    const supabase = getSupabase();
    await supabase.from("store_categories").insert({ name: newCategory });
    setNewCategory("");
    setAddDialogView(null);
    fetchData();
  }

  async function handleDeleteProduct(id: string) {
    showConfirm("هل أنت متأكد من حذف هذا المنتج؟", async () => {
      setLoading(true);
      const supabase = getSupabase();
      await supabase.from("store_products").delete().eq("id", id);
      fetchData();
    });
  }

  async function handleDeleteCategory(id: string) {
    const category = categories.find(c => c.id === id);
    if (category?.name === "المظاهر") {
      alert("لا يمكن حذف فئة المظاهر الأساسية");
      return;
    }
    showConfirm("سيتم حذف الفئة وكل المنتجات المرتبطة بها. هل أنت متأكد؟", async () => {
      setLoading(true);
      const supabase = getSupabase();
      await supabase.from("store_categories").delete().eq("id", id);
      fetchData();
    });
  }

    if (authLoading || !authVerified) return <SiteLoader fullScreen />;

  const visibleProducts = products.filter((product) => !product.theme_key)

  const content = (
    <div className="container mx-auto max-w-5xl space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-[#e5edf8] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${isStoreOpen ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-red-200 bg-red-50 text-red-600"}`}>
                {isStoreStatusLoading ? "جاري التحقق..." : isStoreOpen ? "المتجر مفتوح" : "المتجر مغلق"}
              </span>
              <h2 className="text-lg font-black text-[#1a2332]">حالة المتجر</h2>
            </div>
            <p className="mt-2 text-sm text-[#6c7d95]">عند إغلاق المتجر يختفي زر المتجر من الطلاب وتُمنع صفحة المتجر وطلبات الشراء.</p>
          </div>
          <Button
            type="button"
            onClick={handleToggleStoreStatus}
            disabled={isStoreStatusLoading || isSavingStoreStatus}
            className={`h-11 rounded-2xl px-6 text-sm font-black text-white ${isStoreOpen ? "bg-red-500 hover:bg-red-600" : "bg-[#3453a7] hover:bg-[#24428f]"}`}
          >
            {isSavingStoreStatus ? "جاري الحفظ..." : isStoreOpen ? (
              <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4" />إغلاق المتجر</span>
            ) : (
              <span className="inline-flex items-center gap-2"><Unlock className="h-4 w-4" />فتح المتجر</span>
            )}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-[#e5edf8] bg-white shadow-[0_20px_55px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between border-b border-[#e7eef8] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3453a7]/30 bg-[#3453a7]/10">
              <Package className="h-5 w-5 text-[#3453a7]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1a2332]">قائمة المنتجات</h2>
            </div>
          </div>
          <span className="rounded-full border border-[#3453a7]/30 bg-[#3453a7]/8 px-3 py-1 text-sm font-semibold text-[#4f73d1]">
            {visibleProducts.length} منتج
          </span>
        </div>

        <div className="p-6">
          {visibleProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[#3453a7]/30 bg-[#3453a7]/10 text-[#3453a7]">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <p className="font-medium text-neutral-500">لا توجد منتجات بعد</p>
              <p className="mt-1 text-sm text-neutral-400">أضف منتجًا جديدًا من زر إضافة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleProducts.map((prod) => (
                <div key={prod.id} className="flex items-center gap-4 rounded-[1.5rem] border border-[#edf2fb] bg-[#fbfcff] p-4 transition-colors hover:bg-white">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#dbe6f7] bg-white">
                    {prod.image_url ? (
                      <img src={prod.image_url} alt={prod.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-[#3453a7]/35" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-[#3453a7]/20 bg-[#3453a7]/8 px-2.5 py-1 text-xs font-bold text-[#4f73d1]">
                        {categories.find((category) => category.id === prod.category_id)?.name || "عام"}
                      </span>
                      <h3 className="truncate text-base font-bold text-[#1a2332]">{prod.name}</h3>
                    </div>
                    <div className="mt-2 text-sm font-bold text-[#4f73d1]">
                      {prod.price} <span className="font-normal text-neutral-400">نقطة</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(prod.id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const confirmDialog = confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
          <div className="bg-white rounded-2xl border border-[#3453a7]/40 shadow-xl p-6 w-full max-w-sm mx-4 space-y-5">
            <p className="text-base font-semibold text-[#1a2332] text-center">{confirmMessage}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-neutral-500 hover:bg-neutral-50 text-sm font-semibold transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => { setConfirmOpen(false); confirmCallback?.(); }}
                className="flex-1 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 text-sm font-semibold transition-colors"
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      ) : null;

  const addProductDialog = addDialogView === "product" ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="mx-4 w-full max-w-md space-y-5 rounded-[1.75rem] border border-[#3453a7]/30 bg-white p-6 shadow-[0_25px_70px_rgba(15,23,42,0.18)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3453a7]/30 bg-[#3453a7]/10">
            <Package className="h-5 w-5 text-[#3453a7]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#1a2332]">إضافة منتج</h2>
            <p className="text-sm text-[#6c7d95]">أدخل بيانات المنتج الجديد</p>
          </div>
        </div>
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-[1.25rem] border-2 border-dashed border-[#3453a7]/25 bg-[#fafcff] p-5 text-center transition-all hover:border-[#3453a7]/50 hover:bg-[#f7faff]"
          >
            <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)} className="hidden" />
            {imageFile ? (
              <div>
                <p className="truncate text-sm font-bold text-[#1a2332]">{imageFile.name}</p>
                <p className="mt-1 text-xs text-[#4f73d1]">اضغط لتغيير الصورة</p>
              </div>
            ) : (
              <div>
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-[#3453a7]/25 bg-[#3453a7]/10 text-[#3453a7]">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-neutral-500">اضغط لرفع صورة</p>
              </div>
            )}
          </div>
          <Input placeholder="اسم المنتج" value={name} onChange={(e) => setName(e.target.value)} className="border-[#3453a7]/30 focus-visible:ring-[#3453a7]/30" />
          <Input placeholder="السعر (نقطة)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="border-[#3453a7]/30 focus-visible:ring-[#3453a7]/30" />
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-[#3453a7]/30 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#3453a7]/30"
          >
            <option value="">اختر الفئة...</option>
            {categories.filter((cat) => cat.name !== "المظاهر").map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setAddDialogView(null)} className="border-[#d8e5fb] bg-white text-[#1a2332] hover:bg-[#f8fbff]">إلغاء</Button>
            <Button type="submit" disabled={loading} className="bg-[#3453a7] text-white hover:bg-[#24428f] disabled:opacity-50">{loading ? "جاري الإضافة..." : "حفظ المنتج"}</Button>
          </div>
        </form>
      </div>
    </div>
  ) : null

  const addCategoryDialog = addDialogView === "category" ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="mx-4 w-full max-w-md space-y-5 rounded-[1.75rem] border border-[#3453a7]/30 bg-white p-6 shadow-[0_25px_70px_rgba(15,23,42,0.18)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3453a7]/30 bg-[#3453a7]/10">
            <Tag className="h-5 w-5 text-[#3453a7]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#1a2332]">إضافة فئة</h2>
            <p className="text-sm text-[#6c7d95]">أدخل اسم الفئة الجديدة</p>
          </div>
        </div>
        <form onSubmit={handleAddCategory} className="space-y-4">
          <Input placeholder="اسم الفئة" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="border-[#3453a7]/30 focus-visible:ring-[#3453a7]/30" />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setAddDialogView(null)} className="border-[#d8e5fb] bg-white text-[#1a2332] hover:bg-[#f8fbff]">إلغاء</Button>
            <Button type="submit" disabled={loading || !newCategory} className="bg-[#3453a7] text-white hover:bg-[#24428f] disabled:opacity-50">{loading ? "جاري الإضافة..." : "حفظ الفئة"}</Button>
          </div>
        </form>
      </div>
    </div>
  ) : null

  if (isEmbedded) {
    return (
      <div dir="rtl" className="min-h-full bg-[#fafaf9] px-1 py-1">
        <div className="py-10 px-4">{content}</div>
        {confirmDialog}
        {addProductDialog}
        {addCategoryDialog}
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[#fafaf9]">
      <Header />
      <main className="flex-1 py-10 px-4">{content}</main>
      <Footer />
      {confirmDialog}
      {addProductDialog}
      {addCategoryDialog}
    </div>
  );
}

export default function StoreManagementPage() {
  return <StoreManagementContent displayMode="page" />;
}
