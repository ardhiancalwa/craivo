'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Coffee,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Archive,
  Sliders,
  Printer,
  Download,
  ExternalLink,
  FileDown,
  ArrowUpRight,
  Flame,
  Award,
  Upload,
} from 'lucide-react'
import { formatIDR, cn } from '@/lib/utils'
import { compressImage } from '@/lib/image-compressor'
import { SkeletonCard, AdminTableRowSkeleton } from '@/components/ui/skeleton'

type AdminTab = 'overview' | 'catalog' | 'categories_modifiers' | 'quiz' | 'settings' | 'reports' | 'audit' | 'tables'

interface CategoryItem {
  id: string
  name: string
  slug: string
  sortOrder: number
  activeItemCount: number
}

interface ModifierOptionItem {
  id: string
  name: string
  price: number
  isAvailable: boolean
}

interface ModifierGroupItem {
  id: string
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number
  attachedMenuCount: number
  options: ModifierOptionItem[]
}

interface AdminMenuItem {
  id: string
  name: string
  description: string
  price: number
  image: string | null
  categoryId: string
  categoryName: string
  isAvailable: boolean
  isPopular: boolean
  soldCount: number
  isArchived: boolean
  sortOrder: number
  tags: Array<{ id: string; name: string; dimension: string }>
  modifierGroupIds: string[]
}

interface TagItem {
  id: string
  name: string
  slug: string
  dimension: 'MOOD' | 'FLAVOR' | 'FORMAT'
}

interface CafeConfigState {
  name: string
  tagline: string
  address: string
  phone: string
  openingHours: string
  productionDomain: string | null
  taxRateBps: number
  serviceRateBps: number
  isTaxInclusive: boolean
  taxPercentageFormatted: string
  servicePercentageFormatted: string
  quizVersion: number
}

interface TableItem {
  id: string
  tableNumber: string
  label: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  totalOrders?: number
  activeOrders?: number
}

interface TableEnvInfo {
  appUrl: string
  stagingUrl: string
  productionDomain: string | null
  isProductionConfigured: boolean
}

interface TurnoverReportState {
  period: { startDateJakarta: string; endDateJakarta: string }
  summary: { grossReceipts: number; totalRefunds: number; netTurnover: number; totalPaidOrders: number }
  byPaymentMethod: {
    qris: { transactionCount: number; grossAmount: number; refundAmount: number; netAmount: number }
    cash: { transactionCount: number; grossAmount: number; refundAmount: number; netAmount: number }
  }
  topSellingItems: Array<{ name: string; quantitySold: number; totalRevenue: number }>
}

interface TransactionRow {
  id: string
  orderNumber: string
  tableNumber: string
  createdAtJakarta: string
  paymentMethod: string
  paymentStatus: string
  orderStatus: string
  subtotalAmount: number
  serviceAmount: number
  taxAmount: number
  totalAmount: number
  refundAmount: number
  netAmount: number
  itemsSummary: string
  customerNotes: string | null
  refundReason: string | null
}

interface AuditLogRow {
  id: string
  action: string
  details: string | null
  ipAddress: string | null
  createdAtJakarta: string
  staffUser: { username: string; displayName: string; role: string } | null
}

interface QuizOptionConfig {
  id?: string
  label: string
  description: string
  icon: string | null
  sortOrder: number
  isActive: boolean
  tags: Array<{ tagId: string; tagName?: string; weight: number }>
}

interface QuizQuestionConfig {
  id: string
  stepNumber: number
  title: string
  description: string
  dimension: 'MOOD' | 'FLAVOR' | 'FORMAT'
  isActive: boolean
  sortOrder: number
  options: QuizOptionConfig[]
}

export function AdminClientView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = searchParams.get('tab') as AdminTab | null

  const [activeTab, setActiveTab] = React.useState<AdminTab>(() => {
    const validTabs: AdminTab[] = ['overview', 'catalog', 'categories_modifiers', 'quiz', 'settings', 'reports', 'audit', 'tables']
    if (tabParam && validTabs.includes(tabParam)) return tabParam
    return 'overview'
  })

  // Synchronize activeTab with URL query parameter
  React.useEffect(() => {
    const validTabs: AdminTab[] = ['overview', 'catalog', 'categories_modifiers', 'quiz', 'settings', 'reports', 'audit', 'tables']
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam)
    } else if (!tabParam) {
      setActiveTab('overview')
    }
  }, [tabParam])

  const switchTab = (tab: AdminTab) => {
    setActiveTab(tab)
    if (tab === 'overview') {
      router.push('/staff/admin')
    } else {
      router.push(`/staff/admin?tab=${tab}`)
    }
  }

  const [toastMessage, setToastMessage] = React.useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [createdTableSuccess, setCreatedTableSuccess] = React.useState<{
    id: string
    tableNumber: string
    label?: string | null
    qrSlug: string
  } | null>(null)

  // Data states
  const [menuItems, setMenuItems] = React.useState<AdminMenuItem[]>([])
  const [categories, setCategories] = React.useState<CategoryItem[]>([])
  const [modifierGroups, setModifierGroups] = React.useState<ModifierGroupItem[]>([])
  const [allTags, setAllTags] = React.useState<TagItem[]>([])
  const [config, setConfig] = React.useState<CafeConfigState | null>(null)
  const [turnoverReport, setTurnoverReport] = React.useState<TurnoverReportState | null>(null)
  const [transactions, setTransactions] = React.useState<TransactionRow[]>([])
  const [transPagination, setTransPagination] = React.useState({ page: 1, limit: 10, totalPages: 1, totalCount: 0 })
  const [auditLogs, setAuditLogs] = React.useState<AuditLogRow[]>([])
  const [auditPagination, setAuditPagination] = React.useState({ page: 1, limit: 20, totalPages: 1, totalCount: 0 })
  const [quizQuestions, setQuizQuestions] = React.useState<QuizQuestionConfig[]>([])
  const [quizVersion, setQuizVersion] = React.useState<number>(1)

  // Filters
  const [catalogSearch, setCatalogSearch] = React.useState('')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = React.useState('all')
  const [showArchived, setShowArchived] = React.useState(false)
  const [reportStartDate, setReportStartDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [reportEndDate, setReportEndDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [auditActionFilter, setAuditActionFilter] = React.useState('ALL')
  const [isInitialLoading, setIsInitialLoading] = React.useState(true)

  // Modals & form state
  const [isMenuModalOpen, setIsMenuModalOpen] = React.useState(false)
  const [editingMenuItem, setEditingMenuItem] = React.useState<AdminMenuItem | null>(null)
  const [archiveTarget, setArchiveTarget] = React.useState<AdminMenuItem | null>(null)
  const [isArchivingInProgress, setIsArchivingInProgress] = React.useState(false)
  const [menuFormName, setMenuFormName] = React.useState('')
  const [menuFormDescription, setMenuFormDescription] = React.useState('')
  const [menuFormPrice, setMenuFormPrice] = React.useState(28000)
  const [menuFormCategoryId, setMenuFormCategoryId] = React.useState('')
  const [menuFormImage, setMenuFormImage] = React.useState<string | null>(null)
  const [menuFormIsPopular, setMenuFormIsPopular] = React.useState(false)
  const [menuFormSortOrder, setMenuFormSortOrder] = React.useState(0)
  const [menuFormTagIds, setMenuFormTagIds] = React.useState<string[]>([])
  const [menuFormModifierGroupIds, setMenuFormModifierGroupIds] = React.useState<string[]>([])
  const [isUploadingImage, setIsUploadingImage] = React.useState(false)

  // Financial Form state
  const [finTaxPercent, setFinTaxPercent] = React.useState(0)
  const [finServicePercent, setFinServicePercent] = React.useState(0)
  const [finIsInclusive, setFinIsInclusive] = React.useState(false)

  // Identity Form state
  const [cafeName, setCafeName] = React.useState('')
  const [cafeTagline, setCafeTagline] = React.useState('')
  const [cafeAddress, setCafeAddress] = React.useState('')
  const [cafePhone, setCafePhone] = React.useState('')
  const [cafeHours, setCafeHours] = React.useState('')
  const [cafeProdDomain, setCafeProdDomain] = React.useState('')

  // Table & QR states
  const [tables, setTables] = React.useState<TableItem[]>([])
  const [tableEnvInfo, setTableEnvInfo] = React.useState<TableEnvInfo | null>(null)
  const [tableTargetEnv, setTableTargetEnv] = React.useState<'staging' | 'production'>('staging')
  const [tableSearchQuery, setTableSearchQuery] = React.useState('')
  const [tableStatusFilter, setTableStatusFilter] = React.useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [isTableModalOpen, setIsTableModalOpen] = React.useState(false)
  const [editingTable, setEditingTable] = React.useState<TableItem | null>(null)
  const [tableFormNumber, setTableFormNumber] = React.useState('')
  const [tableFormLabel, setTableFormLabel] = React.useState('')
  const [tableFormIsActive, setTableFormIsActive] = React.useState(true)
  const [isSavingTable, setIsSavingTable] = React.useState(false)

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Initial load
  const loadInitialData = React.useCallback(async () => {
    try {
      // 1. Menu items
      const menuRes = await fetch(`/api/staff/admin/menu?includeArchived=true`, { cache: 'no-store' })
      if (menuRes.ok) {
        const json = await menuRes.json()
        setMenuItems(json.data || [])
      }

      // 2. Categories
      const catRes = await fetch('/api/staff/admin/categories', { cache: 'no-store' })
      if (catRes.ok) {
        const json = await catRes.json()
        setCategories(json.data || [])
        if (json.data && json.data.length > 0 && !menuFormCategoryId) {
          setMenuFormCategoryId(json.data[0].id)
        }
      }

      // 3. Modifier Groups
      const modRes = await fetch('/api/staff/admin/modifiers', { cache: 'no-store' })
      if (modRes.ok) {
        const json = await modRes.json()
        setModifierGroups(json.data || [])
      }

      // 4. Tags
      const tagRes = await fetch('/api/staff/admin/tags', { cache: 'no-store' })
      if (tagRes.ok) {
        const json = await tagRes.json()
        setAllTags(json.data || [])
      }

      // 5. Config
      const configRes = await fetch('/api/staff/admin/config', { cache: 'no-store' })
      if (configRes.ok) {
        const json = await configRes.json()
        const cfg = json.data
        setConfig(cfg)
        setCafeName(cfg.name)
        setCafeTagline(cfg.tagline)
        setCafeAddress(cfg.address || '')
        setCafePhone(cfg.phone || '')
        setCafeHours(cfg.openingHours || '')
        setCafeProdDomain(cfg.productionDomain || '')
        setFinTaxPercent(cfg.taxRateBps / 100)
        setFinServicePercent(cfg.serviceRateBps / 100)
        setFinIsInclusive(cfg.isTaxInclusive)
        setQuizVersion(cfg.quizVersion)
      }

      // 6. Tables
      const tablesRes = await fetch('/api/staff/admin/tables', { cache: 'no-store' })
      if (tablesRes.ok) {
        const json = await tablesRes.json()
        setTables(json.data.tables || [])
        setTableEnvInfo(json.data.environment || null)
      }

      // 7. Overview Reports & Transactions
      try {
        const [turnoverRes, transRes] = await Promise.all([
          fetch(`/api/staff/admin/reports/turnover?startDate=${reportStartDate}&endDate=${reportEndDate}`),
          fetch(`/api/staff/admin/reports/transactions?startDate=${reportStartDate}&endDate=${reportEndDate}&page=1&limit=10`),
        ])
        if (turnoverRes.ok) {
          const json = await turnoverRes.json()
          setTurnoverReport(json.data)
        }
        if (transRes.ok) {
          const json = await transRes.json()
          setTransactions(json.data.transactions || [])
          setTransPagination(json.data.pagination)
        }
      } catch {
        // Non-blocking
      }
    } catch (err) {
      console.error('Error loading admin data:', err)
      showToast('Gagal memuat data dari server.', 'error')
    } finally {
      setIsInitialLoading(false)
    }
  }, [menuFormCategoryId, reportStartDate, reportEndDate])

  React.useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Load Tables
  const loadTables = React.useCallback(async () => {
    try {
      const res = await fetch('/api/staff/admin/tables', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setTables(json.data.tables || [])
        setTableEnvInfo(json.data.environment || null)
      }
    } catch (err) {
      console.error('Failed to load tables:', err)
      showToast('Gagal memuat data meja.', 'error')
    }
  }, [])

  // Load Reports
  const loadReports = React.useCallback(async () => {
    try {
      const [turnoverRes, transRes] = await Promise.all([
        fetch(`/api/staff/admin/reports/turnover?startDate=${reportStartDate}&endDate=${reportEndDate}`),
        fetch(`/api/staff/admin/reports/transactions?startDate=${reportStartDate}&endDate=${reportEndDate}&page=${transPagination.page}&limit=10`),
      ])

      if (turnoverRes.ok) {
        const json = await turnoverRes.json()
        setTurnoverReport(json.data)
      }
      if (transRes.ok) {
        const json = await transRes.json()
        setTransactions(json.data.transactions || [])
        setTransPagination(json.data.pagination)
      }
    } catch (err) {
      console.error('Failed to load reports:', err)
      showToast('Gagal memuat laporan penjualan.', 'error')
    }
  }, [reportStartDate, reportEndDate, transPagination.page])

  // Load Audit Logs
  const loadAuditLogs = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/staff/admin/audit-logs?page=${auditPagination.page}&limit=20&action=${auditActionFilter}`)
      if (res.ok) {
        const json = await res.json()
        setAuditLogs(json.data.logs || [])
        setAuditPagination(json.data.pagination)
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    }
  }, [auditPagination.page, auditActionFilter])

  // Load Quiz Config
  const loadQuizConfig = React.useCallback(async () => {
    try {
      const res = await fetch('/api/staff/admin/quiz', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setQuizQuestions(json.data.questions || [])
        setQuizVersion(json.data.quizVersion || 1)
      }
    } catch (err) {
      console.error('Failed to load quiz config:', err)
    }
  }, [])

  React.useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'reports') loadReports()
    if (activeTab === 'audit') loadAuditLogs()
    if (activeTab === 'quiz') loadQuizConfig()
    if (activeTab === 'tables' || activeTab === 'overview') loadTables()
  }, [activeTab, loadReports, loadAuditLogs, loadQuizConfig, loadTables])

  // Handlers for Menu
  const handleOpenAddMenu = () => {
    setEditingMenuItem(null)
    setMenuFormName('')
    setMenuFormDescription('')
    setMenuFormPrice(28000)
    setMenuFormCategoryId(categories[0]?.id || '')
    setMenuFormImage(null)
    setMenuFormIsPopular(false)
    setMenuFormSortOrder(0)
    setMenuFormTagIds([])
    setMenuFormModifierGroupIds([])
    setIsMenuModalOpen(true)
  }

  const handleOpenEditMenu = (item: AdminMenuItem) => {
    setEditingMenuItem(item)
    setMenuFormName(item.name)
    setMenuFormDescription(item.description)
    setMenuFormPrice(item.price)
    setMenuFormCategoryId(item.categoryId)
    setMenuFormImage(item.image)
    setMenuFormIsPopular(item.isPopular)
    setMenuFormSortOrder(item.sortOrder)
    setMenuFormTagIds(item.tags.map((t) => t.id))
    setMenuFormModifierGroupIds(item.modifierGroupIds)
    setIsMenuModalOpen(true)
  }

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return

    // Batas pengaman awal: 20 MB (mendukung foto kamera ponsel resolusi tinggi)
    if (rawFile.size > 20 * 1024 * 1024) {
      showToast('Ukuran foto terlalu besar (maksimal 20 MB).', 'error')
      return
    }

    setIsUploadingImage(true)
    try {
      // Kompresi otomatis di sisi browser menjadi WebP (~60-150 KB)
      const file = await compressImage(rawFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.82 })

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/staff/admin/upload', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Gagal mengunggah foto.')
      }
      setMenuFormImage(json.data.url)
      showToast('Foto berhasil dikompresi dan diunggah.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unggah foto gagal.'
      showToast(msg, 'error')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!menuFormName.trim() || !menuFormCategoryId) {
      showToast('Nama menu dan kategori wajib diisi.', 'error')
      return
    }

    const payload = {
      name: menuFormName,
      description: menuFormDescription,
      price: menuFormPrice,
      categoryId: menuFormCategoryId,
      image: menuFormImage,
      isPopular: menuFormIsPopular,
      sortOrder: menuFormSortOrder,
      tagIds: menuFormTagIds,
      modifierGroupIds: menuFormModifierGroupIds,
    }

    try {
      const url = editingMenuItem ? `/api/staff/admin/menu/${editingMenuItem.id}` : '/api/staff/admin/menu'
      const method = editingMenuItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Gagal menyimpan menu.')
      }

      showToast(editingMenuItem ? 'Menu berhasil diperbarui.' : 'Menu baru berhasil ditambahkan.')
      setIsMenuModalOpen(false)
      loadInitialData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan.'
      showToast(msg, 'error')
    }
  }

  // Quick Toggle Stock with Optimistic Rollback
  const handleToggleStock = async (item: AdminMenuItem) => {
    const previousState = item.isAvailable
    const newState = !previousState

    // Optimistic UI Update
    setMenuItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, isAvailable: newState } : m)))

    try {
      const res = await fetch(`/api/staff/menu/${item.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: newState }),
      })
      if (!res.ok) {
        throw new Error('Server menolak perubahan stok.')
      }
      showToast(`Stok "${item.name}" diubah: ${newState ? 'Tersedia' : 'Habis'}.`)
    } catch {
      // Rollback
      setMenuItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, isAvailable: previousState } : m)))
      showToast(`Gagal mengubah stok "${item.name}". Kembali ke status awal.`, 'error')
    }
  }

  // Quick Toggle Best Seller with Optimistic Rollback
  const handleTogglePopular = async (item: AdminMenuItem) => {
    const previousState = item.isPopular
    const newState = !previousState

    // Optimistic UI Update
    setMenuItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, isPopular: newState } : m)))

    try {
      const res = await fetch(`/api/staff/admin/menu/${item.id}/popular`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPopular: newState }),
      })
      if (!res.ok) {
        throw new Error('Server menolak perubahan status.')
      }
      showToast(`Best Seller "${item.name}": ${newState ? 'Aktif' : 'Non-aktif'}.`)
    } catch {
      // Rollback
      setMenuItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, isPopular: previousState } : m)))
      showToast(`Gagal mengubah Best Seller "${item.name}".`, 'error')
    }
  }

  // Archive / Restore - Membuka Dialog Konfirmasi Artisanal (Bukan Alert Bawaan)
  const handleArchiveToggle = (item: AdminMenuItem) => {
    setArchiveTarget(item)
  }

  const confirmArchiveToggle = async () => {
    if (!archiveTarget || isArchivingInProgress) return
    const item = archiveTarget
    const isArchiving = !item.isArchived

    setIsArchivingInProgress(true)
    try {
      const endpoint = isArchiving
        ? `/api/staff/admin/menu/${item.id}/archive`
        : `/api/staff/admin/menu/${item.id}/restore`
      const res = await fetch(endpoint, { method: 'PATCH' })
      if (!res.ok) throw new Error('Operasi arsip gagal.')

      showToast(isArchiving ? `Menu "${item.name}" berhasil diarsipkan.` : `Menu "${item.name}" berhasil dipulihkan.`)
      setArchiveTarget(null)
      loadInitialData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status arsip.'
      showToast(msg, 'error')
    } finally {
      setIsArchivingInProgress(false)
    }
  }

  // Save Financial Policy
  const handleSaveFinancialPolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/staff/admin/config/financial', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxRateBps: Math.round(finTaxPercent * 100),
          serviceRateBps: Math.round(finServicePercent * 100),
          isTaxInclusive: finIsInclusive,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Gagal menyimpan kebijakan finansial.')

      showToast('Kebijakan finansial berhasil diperbarui.')
      loadInitialData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan.'
      showToast(msg, 'error')
    }
  }

  // Save Identity Config
  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/staff/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cafeName,
          tagline: cafeTagline,
          address: cafeAddress,
          phone: cafePhone,
          openingHours: cafeHours,
          productionDomain: cafeProdDomain.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Gagal menyimpan identitas.')

      showToast('Identitas kafe berhasil diperbarui.')
      loadInitialData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan.'
      showToast(msg, 'error')
    }
  }

  // Handlers for Tables & QR
  const handleOpenAddTable = () => {
    setEditingTable(null)
    setTableFormNumber('')
    setTableFormLabel('')
    setTableFormIsActive(true)
    setIsTableModalOpen(true)
  }

  const handleOpenEditTable = (table: TableItem) => {
    setEditingTable(table)
    setTableFormNumber(table.tableNumber)
    setTableFormLabel(table.label || '')
    setTableFormIsActive(table.isActive)
    setIsTableModalOpen(true)
  }

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tableFormNumber.trim()) {
      showToast('Nomor meja wajib diisi.', 'error')
      return
    }

    setIsSavingTable(true)
    try {
      const url = editingTable ? `/api/staff/admin/tables/${editingTable.id}` : '/api/staff/admin/tables'
      const method = editingTable ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: tableFormNumber.trim(),
          label: tableFormLabel.trim() || undefined,
          isActive: tableFormIsActive,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Gagal menyimpan data meja.')
      }
      showToast(editingTable ? 'Data meja berhasil diperbarui.' : 'Meja baru berhasil ditambahkan.')
      setIsTableModalOpen(false)
      if (!editingTable && json.data) {
        setCreatedTableSuccess(json.data)
      }
      await loadTables()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan meja.'
      showToast(msg, 'error')
    } finally {
      setIsSavingTable(false)
    }
  }

  const handleToggleTableActive = async (table: TableItem) => {
    const nextStatus = !table.isActive
    try {
      const res = await fetch(`/api/staff/admin/tables/${table.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextStatus }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Gagal mengubah status meja.')
      }
      showToast(`Meja ${table.tableNumber} kini ${nextStatus ? 'AKTIF' : 'NONAKTIF'}.`)
      await loadTables()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status meja.'
      showToast(msg, 'error')
    }
  }

  // Save Quiz Config
  const handleSaveQuizConfig = async () => {
    try {
      const res = await fetch('/api/staff/admin/quiz', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: quizQuestions }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || (json.details ? json.details.join('\n') : 'Gagal menyimpan kuis.'))
      }
      showToast(`Konfigurasi kuis berhasil disimpan! Versi kuis saat ini: #${json.data.newQuizVersion}.`)
      loadQuizConfig()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi kuis.'
      showToast(msg, 'error')
    }
  }

  // Filtered menu items
  const filteredMenuItems = menuItems.filter((item) => {
    if (!showArchived && item.isArchived) return false
    if (showArchived && !item.isArchived) return false
    if (catalogCategoryFilter !== 'all' && item.categoryId !== catalogCategoryFilter) return false
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase()
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    }
    return true
  })

  // Simulated live calculation for Rp50.000 in Financial card
  const sampleSubtotal = 50000
  let sampleService = 0
  let sampleTax = 0
  let sampleTotal = sampleSubtotal
  let sampleNet = sampleSubtotal

  if (finIsInclusive) {
    const combinedRate = (finServicePercent + finTaxPercent) / 100
    sampleNet = Math.round(sampleSubtotal / (1 + combinedRate))
    sampleService = Math.round((sampleNet * finServicePercent) / 100)
    sampleTax = sampleSubtotal - sampleNet - sampleService
    sampleTotal = sampleSubtotal
  } else {
    sampleService = Math.round((sampleSubtotal * finServicePercent) / 100)
    sampleTax = Math.round(((sampleSubtotal + sampleService) * finTaxPercent) / 100)
    sampleTotal = sampleSubtotal + sampleService + sampleTax
    sampleNet = sampleSubtotal
  }

  return (
    <div className="min-h-screen bg-transparent text-on-surface font-sans pb-16">
      {/* Toast Notification (Artisanal Reference Style) */}
      {toastMessage && (
        <div
          role="status"
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl shadow-level3 border transition-all duration-200 animate-in slide-in-from-bottom-3 backdrop-blur-md max-w-sm',
            toastMessage.type === 'success' && 'bg-emerald-50/95 border-emerald-200/80 text-emerald-950',
            toastMessage.type === 'error' && 'bg-rose-50/95 border-rose-200/80 text-rose-950',
            toastMessage.type === 'info' && 'bg-sky-50/95 border-sky-200/80 text-sky-950'
          )}
        >
          <div className="flex items-center gap-3 text-xs sm:text-sm font-sans font-medium">
            {toastMessage.type === 'success' && (
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            )}
            {toastMessage.type === 'error' && (
              <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
            )}
            {toastMessage.type === 'info' && (
              <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs">
                i
              </div>
            )}
            <span className="leading-tight">{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="rounded-full p-1 text-slate-400 hover:text-slate-700 hover:bg-black/5 focus:outline-none transition-colors ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* ========================================================================= */}
        {/* TAB 0: DASHBOARD OVERVIEW (DONEZO-STYLE REFERENCE)                        */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Header: Title + Subtitle + Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-sans font-black text-on-surface tracking-tight">
                  Dashboard Kafe
                </h1>
                <p className="text-xs text-on-surface-variant font-sans mt-0.5">
                  Pantau omzet harian, status antrean kasir & KDS secara seketika.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                
                <button
                  type="button"
                  onClick={handleOpenAddMenu}
                  className="touch-target px-4 py-2 rounded-xl border border-outline-variant bg-surface-lowest text-on-surface font-sans font-bold text-xs flex items-center gap-1.5 hover:bg-surface-container transition-all shadow-2xs active:scale-95"
                >
                  <Plus className="w-4 h-4 text-primary" />
                  Tambah Menu
                </button>
                <a
                  href={`/api/staff/admin/reports/export?startDate=${reportStartDate}&endDate=${reportEndDate}`}
                  download
                  className="touch-target px-3.5 py-2 rounded-xl border border-outline-variant bg-surface-lowest text-on-surface-variant font-sans font-semibold text-xs flex items-center gap-1.5 hover:bg-surface-container transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  Unduh CSV
                </a>
              </div>
            </div>

            {/* 4 Top KPI Cards Grid (Donezo Style: 1 Dark Card + 3 White Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Omzet (Dark Espresso Card with Terracotta accent) */}
              <div
                onClick={() => switchTab('reports')}
                className="cursor-pointer group relative overflow-hidden rounded-3xl bg-inverse-surface text-inverse-on-surface p-5 border border-white/10 shadow-level2 hover:border-primary/50 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-sans font-semibold text-cream/80">
                    Total Omzet Hari Ini
                  </span>
                  <div className="h-7 w-7 rounded-full bg-white/10 group-hover:bg-primary text-white flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-sans font-black tabular-nums text-white tracking-tight">
                  {turnoverReport?.summary
                    ? formatIDR(turnoverReport.summary.netTurnover)
                    : 'Rp0'}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] font-sans text-cream/70">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                    +12%
                  </span>
                  <span>dari kemarin • Transaksi Lunas</span>
                </div>
              </div>

              {/* Card 2: Pesanan Selesai (White Card) */}
              <div
                onClick={() => switchTab('reports')}
                className="cursor-pointer group rounded-3xl bg-surface-lowest p-5 border border-outline-variant shadow-level1 hover:border-primary/40 hover:shadow-level2 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-sans font-semibold text-on-surface-variant">
                    Pesanan Selesai
                  </span>
                  <div className="h-7 w-7 rounded-full bg-surface-container group-hover:bg-primary group-hover:text-white text-on-surface-variant flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-sans font-black tabular-nums text-on-surface tracking-tight">
                  {turnoverReport?.summary?.totalPaidOrders ?? transactions.filter(t => t.orderStatus === 'COMPLETED').length}
                </div>
                <div className="mt-3 text-[11px] font-sans text-on-surface-variant/80">
                  Lunas & disajikan hari ini
                </div>
              </div>

              {/* Card 3: Antrean KDS Dapur (White Card) */}
              <Link
                href="/staff/kds"
                className="group rounded-3xl bg-surface-lowest p-5 border border-outline-variant shadow-level1 hover:border-primary/40 hover:shadow-level2 transition-all block"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-sans font-semibold text-on-surface-variant">
                    Antrean KDS Dapur
                  </span>
                  <div className="h-7 w-7 rounded-full bg-surface-container group-hover:bg-primary group-hover:text-white text-on-surface-variant flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-sans font-black tabular-nums text-primary tracking-tight">
                  {tables.reduce((acc, t) => acc + (t.activeOrders || 0), 0)}
                </div>
                <div className="mt-3 text-[11px] font-sans text-on-surface-variant/80 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-cooking animate-pulse" />
                  <span>Sedang diproses barista / koki</span>
                </div>
              </Link>

              {/* Card 4: Meja Aktif (White Card) */}
              <div
                onClick={() => switchTab('tables')}
                className="cursor-pointer group rounded-3xl bg-surface-lowest p-5 border border-outline-variant shadow-level1 hover:border-primary/40 hover:shadow-level2 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-sans font-semibold text-on-surface-variant">
                    Meja Aktif
                  </span>
                  <div className="h-7 w-7 rounded-full bg-surface-container group-hover:bg-primary group-hover:text-white text-on-surface-variant flex items-center justify-center transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-sans font-black tabular-nums text-on-surface tracking-tight">
                  {tables.filter((t) => t.isActive).length} <span className="text-sm font-sans text-on-surface-variant font-normal">/ {tables.length}</span>
                </div>
                <div className="mt-3 text-[11px] font-sans text-on-surface-variant/80">
                  Siap dipindai & dipesan pelanggan
                </div>
              </div>
            </div>

            {/* Middle Grid: Analitik 7 Hari + Status KDS Cepat + Katalog Meja Cepat */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Widget 1: Project Analytics / Tren 7 Hari (Donezo Style) */}
              <div className="rounded-3xl bg-surface-lowest p-5 border border-outline-variant shadow-level1 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-sans font-bold text-on-surface">Analitik Mingguan</h2>
                    <p className="text-[11px] text-on-surface-variant font-sans">Aktivitas volume pesanan 7 hari</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-sans font-bold">
                    78% Kapasitas
                  </span>
                </div>

                {/* 7 Vertical Bar Columns */}
                <div className="pt-4 flex items-end justify-between h-40 px-2 gap-2">
                  {[
                    { day: 'S', height: 'h-16', active: false },
                    { day: 'M', height: 'h-24', active: false },
                    { day: 'T', height: 'h-32', active: true, tag: '78%' },
                    { day: 'W', height: 'h-28', active: true },
                    { day: 'T', height: 'h-20', active: false },
                    { day: 'F', height: 'h-24', active: false },
                    { day: 'S', height: 'h-14', active: false },
                  ].map((bar, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      {bar.tag && (
                        <span className="text-[9px] font-mono font-bold text-primary mb-1">
                          {bar.tag}
                        </span>
                      )}
                      <div
                        className={cn(
                          'w-full max-w-[28px] rounded-t-xl transition-all',
                          bar.height,
                          bar.active
                            ? 'bg-primary shadow-[0_4px_12px_rgba(146,72,5,0.25)]'
                            : 'bg-surface-container hover:bg-primary/40'
                        )}
                      />
                      <span className="text-[11px] font-sans font-bold text-on-surface-variant">
                        {bar.day}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Widget 2: Pengingat Antrean KDS Cepat (Donezo Reminders) */}
              <div className="rounded-3xl bg-surface-lowest p-5 border border-outline-variant shadow-level1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-on-surface-variant/80">
                      OPERASIONAL DAPUR
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-sans font-bold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
                      Live Sync
                    </span>
                  </div>

                  <h2 className="text-lg font-sans font-black text-on-surface leading-tight">
                    Antrean Barista & KDS
                  </h2>
                  <p className="text-xs text-on-surface-variant font-sans mt-1">
                    Pesanan lunas otomatis terdistribusi ke layar staf barista & koki dapur.
                  </p>

                  <div className="mt-4 p-3 rounded-2xl bg-surface-low border border-outline-variant/60 space-y-1.5 text-xs font-sans">
                    <div className="flex items-center justify-between text-on-surface font-semibold">
                      <span>Rata-rata Waktu Masak:</span>
                      <span className="font-mono text-primary font-bold">~8.5 Menit</span>
                    </div>
                    <div className="flex items-center justify-between text-on-surface font-semibold">
                      <span>Audio Chime Notifikasi:</span>
                      <span className="text-emerald-700 font-bold">Aktif (Stereo)</span>
                    </div>
                  </div>
                </div>

                <Link
                  href="/staff/kds"
                  className="w-full py-2.5 px-4 rounded-xl bg-inverse-surface hover:bg-black text-white font-sans font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-level1 active:scale-95"
                >
                  <Coffee className="w-4 h-4 text-primary" />
                  Buka Layar KDS Dapur ↗
                </Link>
              </div>

              {/* Widget 3: Quick Tables List (Donezo Projects) */}
              <div className="rounded-3xl bg-surface-lowest p-5 border border-outline-variant shadow-level1 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-sans font-bold text-on-surface">Meja & QR Studio</h2>
                    <button
                      type="button"
                      onClick={handleOpenAddTable}
                      className="px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-sans font-bold hover:bg-primary-container transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Meja
                    </button>
                  </div>
                  <p className="text-[11px] text-on-surface-variant font-sans mb-3">
                    Daftar meja siap pakai dan status QR master
                  </p>

                  <div className="space-y-2">
                    {tables.slice(0, 4).map((table) => (
                      <div
                        key={table.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-outline-variant/60 bg-surface/50 text-xs hover:bg-surface transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary font-bold font-sans flex items-center justify-center text-xs">
                            {table.tableNumber}
                          </div>
                          <div>
                            <div className="font-sans font-bold text-on-surface leading-none">
                              {table.label || `Meja ${table.tableNumber}`}
                            </div>
                            <div className="text-[10px] font-sans text-on-surface-variant mt-0.5">
                              {table.activeOrders && table.activeOrders > 0 ? `${table.activeOrders} pesanan aktif` : 'Meja santai'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-md text-[10px] font-sans font-bold',
                              table.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            )}
                          >
                            {table.isActive ? 'Aktif' : 'Off'}
                          </span>
                          <Link
                            href={`/menu?table=${table.tableNumber}`}
                            target="_blank"
                            className="p-1 rounded text-on-surface-variant hover:text-primary"
                            title="Buka Menu Meja Ini"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => switchTab('tables')}
                  className="w-full text-center py-2 text-xs font-sans font-bold text-primary hover:underline"
                >
                  Kelola Semua Meja ({tables.length}) & Unduh QR ↗
                </button>
              </div>
            </div>

            {/* Lower Grid: Aktivitas Pesanan Terkini + Okupansi Meja + Jam Operasional Toko */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Widget 4: Transaksi Terkini (Donezo Team Collaboration) */}
              <div className="rounded-3xl bg-surface-lowest p-5 border border-outline-variant shadow-level1 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-sans font-bold text-on-surface">Transaksi Terkini</h2>
                  <button
                    type="button"
                    onClick={() => switchTab('reports')}
                    className="text-xs font-sans font-bold text-primary hover:underline"
                  >
                    Lihat Semua
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  {transactions.slice(0, 4).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-outline-variant/50 hover:bg-surface-low transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-surface-container font-sans font-bold text-xs flex items-center justify-center text-on-surface">
                          M{tx.tableNumber}
                        </div>
                        <div>
                          <div className="font-sans font-bold text-on-surface leading-tight">
                            {tx.orderNumber}
                          </div>
                          <div className="text-[10px] font-sans text-on-surface-variant">
                            {tx.createdAtJakarta} • {tx.paymentMethod}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-sans font-bold tabular-nums text-on-surface">
                          {formatIDR(tx.subtotalAmount)}
                        </div>
                        <span
                          className={cn(
                            'inline-block px-1.5 py-0.2 rounded text-[9.5px] font-sans font-bold',
                            tx.orderStatus === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          )}
                        >
                          {tx.orderStatus}
                        </span>
                      </div>
                    </div>
                  ))}

                  {transactions.length === 0 && (
                    <div className="p-4 text-center text-xs font-sans text-on-surface-variant">
                      Belum ada transaksi tercatat hari ini.
                    </div>
                  )}
                </div>
              </div>

              {/* Widget 5: Okupansi Meja (Donezo Project Progress) */}
              <div className="rounded-3xl bg-surface-lowest p-5 border border-outline-variant shadow-level1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-sans font-bold text-on-surface">Utilisasi Meja</h2>
                    <span className="text-[11px] font-mono text-on-surface-variant font-semibold">
                      {tables.filter((t) => t.isActive).length} dari {tables.length || 1} Meja
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant font-sans">
                    Persentase kapasitas meja aktif di lantai kafe
                  </p>

                  {/* Circular/Gauge visual */}
                  <div className="py-6 flex flex-col items-center justify-center">
                    <div className="relative h-28 w-28 rounded-full border-8 border-surface-container border-t-primary border-r-primary flex items-center justify-center shadow-inner">
                      <div className="text-center">
                        <div className="text-2xl font-sans font-black text-on-surface">
                          {Math.round((tables.filter((t) => t.isActive).length / (tables.length || 1)) * 100)}%
                        </div>
                        <div className="text-[9px] font-sans font-bold uppercase text-on-surface-variant">
                          Meja Siap
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-around border-t border-outline-variant/60 pt-3 text-[11px] font-sans">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span>Aktif ({tables.filter((t) => t.isActive).length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-surface-container" />
                    <span>Non-Aktif ({tables.filter((t) => !t.isActive).length})</span>
                  </div>
                </div>
              </div>

              {/* Widget 6: Jam Operasional Toko (Donezo Time Tracker) */}
              <div className="rounded-3xl bg-inverse-surface text-inverse-on-surface p-5 border border-white/10 shadow-level2 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-cream/70">
                      STATUS SISTEM
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-sans font-bold text-[10px] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Toko Buka
                    </span>
                  </div>

                  <h2 className="text-base font-sans font-bold text-white">
                    Jam Operasional & Pelayanan
                  </h2>
                  <p className="text-[11px] font-sans text-cream/70 mt-1">
                    {config?.openingHours || '08:00 - 22:00 WIB'}
                  </p>
                </div>

                <div className="py-4 text-center rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] font-sans text-cream/70 uppercase tracking-widest mb-1">
                    KONEKSI TERMINAL KASIR
                  </div>
                  <div className="text-xs font-mono font-bold text-white tracking-wider">
                    ONLINE & READY TO SERVE
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => switchTab('settings')}
                  className="w-full py-2 rounded-xl border border-white/20 text-white hover:bg-white/10 font-sans font-bold text-xs transition-colors"
                >
                  Ubah Jadwal Buka di Pengaturan ↗
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ========================================================================= */}
        {/* TAB 1: KATALOG MENU                                                       */}
        {/* ========================================================================= */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-4 rounded-2xl border border-outline-variant shadow-level1">
              <div className="flex items-center gap-3 flex-wrap flex-1">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-outline" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Cari nama menu atau deskripsi..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant text-xs bg-surface-lowest focus:outline-none focus:border-terracotta"
                  />
                </div>

                <select
                  value={catalogCategoryFilter}
                  onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-outline-variant text-xs bg-surface-lowest font-medium focus:outline-none focus:border-terracotta"
                >
                  <option value="all">Semua Kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.activeItemCount})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowArchived(!showArchived)}
                  className={cn(
                    'px-3 py-2 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5',
                    showArchived
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'border-outline-variant text-brand/70 hover:bg-surface-container'
                  )}
                >
                  <Archive className="w-3.5 h-3.5" />
                  {showArchived ? 'Menampilkan: Diarsipkan' : 'Hanya Aktif'}
                </button>
              </div>

              <button
                onClick={handleOpenAddMenu}
                className="touch-target px-4 py-2.5 rounded-xl bg-primary text-white font-sans font-bold text-xs hover:bg-primary-container transition-colors flex items-center justify-center gap-2 shadow-level1"
              >
                <Plus className="w-4 h-4" />
                Tambah Menu Baru
              </button>
            </div>

            {/* Grid Kartu Menu */}
            {isInitialLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'bg-surface rounded-2xl border p-4 flex flex-col justify-between transition-all shadow-level1',
                    item.isArchived ? 'border-amber-300 bg-amber-50/40 opacity-75' : 'border-outline-variant'
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container text-outline uppercase tracking-wider">
                            {item.categoryName}
                          </span>
                          {item.isPopular && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                              <Flame className="w-3.5 h-3.5 text-amber-600" /> Best Seller
                            </span>
                          )}
                          {item.isArchived && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                              Diarsipkan
                            </span>
                          )}
                        </div>
                        <h3 className="font-sans font-bold text-base text-brand">{item.name}</h3>
                      </div>

                      {/* Image Thumbnail */}
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-container border border-outline-variant flex-shrink-0 relative">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            unoptimized={item.image.startsWith('/api/images/')}
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-outline">
                            <Coffee className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-brand/70 line-clamp-2 mb-3">{item.description}</p>

                    <div className="text-sm font-black text-terracotta tabular-nums mb-3">
                      {formatIDR(item.price)}
                    </div>

                    {/* Tag Badges */}
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {item.tags.map((t) => (
                          <span
                            key={t.id}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-surface-lowest border border-outline-variant/60 text-brand/80"
                          >
                            #{t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      {/* Quick Stock Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleStock(item)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors',
                          item.isAvailable
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-800 border border-red-200 hover:bg-red-200'
                        )}
                      >
                        {item.isAvailable ? '✓ Tersedia' : '✕ Habis'}
                      </button>

                      {/* Quick Popular Toggle */}
                      <button
                        type="button"
                        onClick={() => handleTogglePopular(item)}
                        title="Toggle Best Seller status"
                        className={cn(
                          'p-1.5 rounded-lg border transition-colors',
                          item.isPopular
                            ? 'bg-amber-100 text-amber-700 border-amber-300'
                            : 'bg-surface-lowest text-outline border-outline-variant hover:text-brand'
                        )}
                      >
                        <Award className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMenu(item)}
                        className="px-2.5 py-1 rounded-lg border border-outline-variant text-brand hover:bg-surface-container font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchiveToggle(item)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg border font-semibold',
                          item.isArchived
                            ? 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                            : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'
                        )}
                      >
                        {item.isArchived ? 'Pulihkan' : 'Arsipkan'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}

            {!isInitialLoading && filteredMenuItems.length === 0 && (
              <div className="text-center py-12 bg-surface rounded-2xl border border-outline-variant">
                <Coffee className="w-12 h-12 text-outline mx-auto mb-2" />
                <p className="text-sm font-bold text-brand">Tidak ada menu yang sesuai dengan filter.</p>
                <p className="text-xs text-brand/60 mt-1">Coba sesuaikan pencarian atau ganti kategori.</p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: KATEGORI & MODIFIER                                                */}
        {/* ========================================================================= */}
        {activeTab === 'categories_modifiers' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Kategori Management */}
            <div className="bg-surface p-5 rounded-2xl border border-outline-variant space-y-4 shadow-level1">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-sans font-bold text-lg text-brand">Kategori Menu</h2>
                  <p className="text-xs text-brand/70">Kelola tab kategori yang tampil di navigasi pelanggan.</p>
                </div>
              </div>

              <div className="divide-y divide-outline-variant/60">
                {categories.map((c) => (
                  <div key={c.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-sm text-brand">{c.name}</span>
                      <span className="text-[10px] text-outline block">slug: /{c.slug} • Urutan: {c.sortOrder}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-surface-container font-semibold text-[11px]">
                        {c.activeItemCount} menu aktif
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modifier Groups Management */}
            <div className="bg-surface p-5 rounded-2xl border border-outline-variant space-y-4 shadow-level1">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-sans font-bold text-lg text-brand">Grup Kustomisasi & Pilihan Opsi</h2>
                  <p className="text-xs text-brand/70">Atur opsi racikan gula, es, susu, dan tambahan.</p>
                </div>
              </div>

              <div className="space-y-4">
                {modifierGroups.map((g) => (
                  <div key={g.id} className="p-3.5 rounded-xl border border-outline-variant bg-surface-lowest">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-bold text-sm text-brand">{g.name}</span>
                        <span className="text-[10px] text-outline block">
                          {g.isRequired ? 'Wajib Dipilih' : 'Opsional'} (Min {g.minSelect}, Maks {g.maxSelect})
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-container">
                        {g.attachedMenuCount} menu terkait
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {g.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="px-2.5 py-1.5 rounded-lg border border-outline-variant/60 bg-surface flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-medium text-brand">{opt.name}</span>
                            <span className="text-[10px] text-terracotta font-bold block">
                              {opt.price > 0 ? `+${formatIDR(opt.price)}` : 'Gratis'}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'text-[10px] font-bold px-1.5 py-0.5 rounded',
                              opt.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            )}
                          >
                            {opt.isAvailable ? 'Ada' : 'Habis'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: KONFIGURASI KUIS                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'quiz' && (
          <div className="bg-surface p-6 rounded-2xl border border-outline-variant space-y-6 shadow-level1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-sans font-black text-xl text-brand">Konfigurasi Kuis Preferensi SELA</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-terracotta text-white">
                    Versi Aktif: #{quizVersion}
                  </span>
                </div>
                <p className="text-xs text-brand/70 mt-1">
                  Baseline resmi 3 langkah sesuai ADR-0006. Perubahan label, tag mapping, dan bobot dievaluasi secara deterministik tanpa AI/LLM.
                </p>
              </div>

              <button
                onClick={handleSaveQuizConfig}
                className="touch-target px-5 py-2.5 rounded-xl bg-primary text-white font-sans font-bold text-xs hover:bg-primary-container transition-colors flex items-center justify-center gap-2 shadow-level1"
              >
                <CheckCircle2 className="w-4 h-4" />
                Simpan Konfigurasi Kuis
              </button>
            </div>

            {/* Questions Step List */}
            <div className="space-y-6">
              {quizQuestions.map((q, qIdx) => (
                <div key={q.id} className="p-4 rounded-2xl border border-outline-variant bg-surface-lowest space-y-4">
                  <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-terracotta text-white text-xs font-black flex items-center justify-center">
                        {q.stepNumber}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-outline">
                        Dimensi: {q.dimension}
                      </span>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.isActive}
                        onChange={(e) => {
                          const updated = [...quizQuestions]
                          const target = updated[qIdx]
                          if (target) target.isActive = e.target.checked
                          setQuizQuestions(updated)
                        }}
                        className="rounded border-outline-variant text-terracotta focus:ring-terracotta"
                      />
                      Langkah Aktif
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-1">Judul Pertanyaan:</label>
                      <input
                        type="text"
                        value={q.title}
                        onChange={(e) => {
                          const updated = [...quizQuestions]
                          const target = updated[qIdx]
                          if (target) target.title = e.target.value
                          setQuizQuestions(updated)
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-outline-variant text-xs bg-surface focus:outline-none focus:border-terracotta font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Deskripsi Tambahan:</label>
                      <input
                        type="text"
                        value={q.description}
                        onChange={(e) => {
                          const updated = [...quizQuestions]
                          const target = updated[qIdx]
                          if (target) target.description = e.target.value
                          setQuizQuestions(updated)
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-outline-variant text-xs bg-surface focus:outline-none focus:border-terracotta"
                      />
                    </div>
                  </div>

                  {/* Options List */}
                  <div>
                    <h4 className="text-xs font-bold text-brand uppercase tracking-wider mb-2">Pilihan Opsi & Bobot Tag:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt, optIdx) => (
                        <div key={opt.id || optIdx} className="p-3 rounded-xl border border-outline-variant/80 bg-surface space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-1 mr-2">
                              <span className="text-lg">{opt.icon || '☕'}</span>
                              <input
                                type="text"
                                value={opt.label}
                                onChange={(e) => {
                                  const updated = [...quizQuestions]
                                  const targetQ = updated[qIdx]
                                  if (targetQ && targetQ.options[optIdx]) {
                                    targetQ.options[optIdx].label = e.target.value
                                  }
                                  setQuizQuestions(updated)
                                }}
                                className="w-full text-xs font-bold bg-transparent border-b border-dashed border-outline-variant focus:outline-none focus:border-terracotta"
                              />
                            </div>

                            <label className="flex items-center gap-1 text-[11px] font-bold cursor-pointer">
                              <input
                                type="checkbox"
                                checked={opt.isActive}
                                onChange={(e) => {
                                  const updated = [...quizQuestions]
                                  const targetQ = updated[qIdx]
                                  if (targetQ && targetQ.options[optIdx]) {
                                    targetQ.options[optIdx].isActive = e.target.checked
                                  }
                                  setQuizQuestions(updated)
                                }}
                                className="rounded text-terracotta"
                              />
                              Aktif
                            </label>
                          </div>

                          <input
                            type="text"
                            value={opt.description}
                            placeholder="Deskripsi opsi..."
                            onChange={(e) => {
                              const updated = [...quizQuestions]
                              const targetQ = updated[qIdx]
                              if (targetQ && targetQ.options[optIdx]) {
                                targetQ.options[optIdx].description = e.target.value
                              }
                              setQuizQuestions(updated)
                            }}
                            className="w-full text-[11px] text-brand/70 bg-transparent border-b border-dashed border-outline-variant/60 focus:outline-none"
                          />

                          {/* Tag & Weight mapping */}
                          <div className="pt-2 border-t border-outline-variant/40 flex items-center justify-between text-[11px]">
                            <span className="text-outline">Pemetaan Tag:</span>
                            <div className="flex items-center gap-2">
                              {opt.tags.map((t, tIdx) => (
                                <div key={t.tagId || tIdx} className="flex items-center gap-1 bg-surface-lowest px-2 py-0.5 rounded border border-outline-variant">
                                  <span className="font-semibold text-brand">{t.tagName || 'Tag'}</span>
                                  <span className="text-terracotta font-black">×{t.weight}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PENGATURAN KAFE & PAJAK                                            */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Kebijakan Finansial Pajak & Layanan */}
            <div className="bg-surface p-6 rounded-2xl border border-outline-variant space-y-5 shadow-level1">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-terracotta">
                  REQ-ADMIN-05 • Kebijakan Keuangan
                </span>
                <h2 className="font-sans font-bold text-lg text-brand mt-0.5">
                  Pajak Restoran (PB1) & Biaya Layanan
                </h2>
                <p className="text-xs text-brand/70">
                  Default pilot SELA adalah 0% (Nett). Perubahan kebijakan di bawah akan langsung mempengaruhi kalkulasi checkout pelanggan.
                </p>
              </div>

              <form onSubmit={handleSaveFinancialPolicy} className="space-y-4">
                {/* Switcher Mode Inklusif / Eksklusif */}
                <div className="p-4 rounded-xl border border-outline-variant bg-surface-lowest space-y-2">
                  <label className="text-xs font-bold text-brand block">Mode Pengenaan Pajak & Layanan:</label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setFinIsInclusive(false)}
                      className={cn(
                        'py-2 px-3 rounded-lg border transition-all text-center',
                        !finIsInclusive ? 'bg-primary text-white border-primary shadow-xs font-bold' : 'bg-surface-lowest border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      )}
                    >
                      Eksklusif (Plus-Plus)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinIsInclusive(true)}
                      className={cn(
                        'py-2 px-3 rounded-lg border transition-all text-center',
                        finIsInclusive ? 'bg-primary text-white border-primary shadow-xs font-bold' : 'bg-surface-lowest border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      )}
                    >
                      Inklusif (Nett All-In)
                    </button>
                  </div>
                  <p className="text-[11px] text-brand/60">
                    {finIsInclusive
                      ? 'Harga di katalog sudah termasuk pajak & layanan (pelanggan membayar tepat nominal katalog).'
                      : 'Pajak & layanan ditambahkan di atas subtotal saat checkout.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">Tarif Pajak PB1 (%):</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      value={finTaxPercent}
                      onChange={(e) => setFinTaxPercent(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant text-xs bg-surface-lowest font-bold focus:outline-none focus:border-terracotta"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">Tarif Biaya Layanan (%):</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      value={finServicePercent}
                      onChange={(e) => setFinServicePercent(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant text-xs bg-surface-lowest font-bold focus:outline-none focus:border-terracotta"
                    />
                  </div>
                </div>

                {/* Simulasi Transparan */}
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2 text-xs">
                  <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-700" />
                    Simulasi Harga Contoh (Pesanan Rp50.000):
                  </span>
                  <div className="space-y-1 text-[11px] text-brand">
                    <div className="flex justify-between">
                      <span>Subtotal Katalog:</span>
                      <span className="font-semibold">{formatIDR(sampleSubtotal)}</span>
                    </div>
                    {finIsInclusive && (
                      <div className="flex justify-between text-outline">
                        <span>Dasar Pengenaan Murni (Net Base):</span>
                        <span>{formatIDR(sampleNet)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Biaya Layanan ({finServicePercent}%):</span>
                      <span className="font-semibold">{formatIDR(sampleService)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pajak Restoran PB1 ({finTaxPercent}%):</span>
                      <span className="font-semibold">{formatIDR(sampleTax)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-amber-200 font-bold text-terracotta">
                      <span>Total Tagihan Pelanggan:</span>
                      <span>{formatIDR(sampleTotal)}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="touch-target w-full py-2.5 rounded-xl bg-primary text-white font-sans font-bold text-xs hover:bg-primary-container transition-colors shadow-level1"
                >
                  Simpan Kebijakan Finansial
                </button>
              </form>
            </div>

            {/* Identitas Kafe */}
            <div className="bg-surface p-6 rounded-2xl border border-outline-variant space-y-5 shadow-level1">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-outline">
                  REQ-ADMIN-08 • Profil Kafe
                </span>
                <h2 className="font-sans font-bold text-lg text-brand mt-0.5">
                  Identitas & Kontak Resmi SELA
                </h2>
                <p className="text-xs text-brand/70">
                  Informasi ini dicetak pada struk thermal dan ditampilkan pada header pelanggan.
                </p>
              </div>

              <form onSubmit={handleSaveIdentity} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold mb-1">Nama Brand / Kafe:</label>
                  <input
                    type="text"
                    value={cafeName}
                    onChange={(e) => setCafeName(e.target.value)}
                    placeholder="Contoh: Kopi Senja / Cravio Cafe"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta font-sans font-bold text-sm"
                  />
                  <p className="text-[10px] text-brand/60 mt-1 font-sans">
                    Nama kafe ini terhubung langsung ke header pemesanan meja pelanggan (<code>/menu?table=XX</code>) dengan lencana mikro-iklan Cravio.
                  </p>
                </div>

                <div>
                  <label className="block font-bold mb-1">Tagline Kafe:</label>
                  <input
                    type="text"
                    value={cafeTagline}
                    onChange={(e) => setCafeTagline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1">Alamat Fisik Resmi:</label>
                  <textarea
                    rows={2}
                    value={cafeAddress}
                    onChange={(e) => setCafeAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Nomor Kontak / WhatsApp:</label>
                    <input
                      type="text"
                      value={cafePhone}
                      onChange={(e) => setCafePhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Jam Operasional:</label>
                    <input
                      type="text"
                      value={cafeHours}
                      onChange={(e) => setCafeHours(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1">Domain Produksi Resmi (Master QR Live):</label>
                  <input
                    type="url"
                    placeholder="https://order.selacoffee.com"
                    value={cafeProdDomain}
                    onChange={(e) => setCafeProdDomain(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta font-mono text-[11px]"
                  />
                  <p className="text-[10px] text-brand/60 mt-1">
                    Digunakan sebagai basis link QR fisik permanen untuk meja di kafe. Jika kosong, master cetak produksi berstatus BLOCKED untuk mencegah cetak massal URL sementara.
                  </p>
                </div>

                <button
                  type="submit"
                  className="touch-target w-full py-2.5 rounded-xl bg-primary text-white font-sans font-bold hover:bg-primary-container active:scale-[0.98] shadow-sm transition-all mt-2"
                >
                  Simpan Identitas Kafe
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: LAPORAN PENJUALAN & OMZET                                          */}
        {/* ========================================================================= */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-surface p-4 rounded-2xl border border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-level1">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-brand">Dari:</span>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-outline-variant bg-surface-lowest font-medium focus:outline-none focus:border-terracotta"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-brand">Sampai:</span>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-outline-variant bg-surface-lowest font-medium focus:outline-none focus:border-terracotta"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadReports}
                  className="touch-target px-3 py-1.5 rounded-xl border border-outline-variant text-xs font-bold hover:bg-surface-container flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Segarkan
                </button>
              </div>

              <a
                href={`/api/staff/admin/reports/export?startDate=${reportStartDate}&endDate=${reportEndDate}`}
                download
                className="touch-target px-4 py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 shadow-level1"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Unduh Laporan CSV
              </a>
            </div>

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-surface p-4 rounded-2xl border border-outline-variant shadow-level1">
                <span className="text-xs text-outline font-bold uppercase tracking-wider block mb-1">
                  Omzet Kotor (Gross)
                </span>
                <div className="text-xl font-sans font-black text-brand tabular-nums">
                  {formatIDR(turnoverReport?.summary.grossReceipts || 0)}
                </div>
                <span className="text-[10px] text-brand/60 block mt-1">Seluruh pesanan berstatus PAID</span>
              </div>

              <div className="bg-surface p-4 rounded-2xl border border-outline-variant shadow-level1">
                <span className="text-xs text-outline font-bold uppercase tracking-wider block mb-1">
                  Pengembalian (Refund)
                </span>
                <div className="text-xl font-sans font-black text-red-700 tabular-nums">
                  {formatIDR(turnoverReport?.summary.totalRefunds || 0)}
                </div>
                <span className="text-[10px] text-brand/60 block mt-1">Total kasir manual refund selesai</span>
              </div>

              <div className="bg-surface p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-level1">
                <span className="text-xs text-emerald-900 font-bold uppercase tracking-wider block mb-1">
                  Omzet Bersih (Net)
                </span>
                <div className="text-xl font-sans font-black text-emerald-800 tabular-nums">
                  {formatIDR(turnoverReport?.summary.netTurnover || 0)}
                </div>
                <span className="text-[10px] text-emerald-700 block mt-1">Gross dikurangi refund manual</span>
              </div>

              <div className="bg-surface p-4 rounded-2xl border border-outline-variant shadow-level1">
                <span className="text-xs text-outline font-bold uppercase tracking-wider block mb-1">
                  Transaksi Lunas
                </span>
                <div className="text-xl font-sans font-black text-brand tabular-nums">
                  {turnoverReport?.summary.totalPaidOrders || 0}
                </div>
                <span className="text-[10px] text-brand/60 block mt-1">
                  QRIS: {turnoverReport?.byPaymentMethod.qris.transactionCount || 0} • Tunai: {turnoverReport?.byPaymentMethod.cash.transactionCount || 0}
                </span>
              </div>
            </div>

            {/* Best Seller Leaderboard (Fitur Menu Terlaris) */}
            <div className="bg-surface rounded-2xl border border-outline-variant overflow-hidden shadow-level1 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-base text-on-surface">
                      Menu Terlaris & Paling Sering Dibeli
                    </h3>
                    <p className="text-xs text-on-surface-variant font-sans">
                      Peringkat makanan dan minuman dengan volume transaksi tertinggi pada rentang periode ini.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-sans font-semibold text-on-surface-variant bg-surface-container px-3 py-1 rounded-lg">
                  {turnoverReport?.topSellingItems?.length || 0} Menu Terjual
                </span>
              </div>

              {(!turnoverReport?.topSellingItems || turnoverReport.topSellingItems.length === 0) ? (
                <div className="py-8 text-center text-xs text-on-surface-variant">
                  Belum ada data penjualan menu pada rentang tanggal yang dipilih.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {turnoverReport.topSellingItems.slice(0, 10).map((item, index) => {
                    const maxQty = turnoverReport.topSellingItems[0]?.quantitySold || 1;
                    const percentage = Math.round((item.quantitySold / maxQty) * 100);
                    const rankMedal =
                      index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '#' + (index + 1);
                    
                    return (
                      <div
                        key={item.name}
                        className="p-3.5 rounded-xl border border-outline-variant/70 bg-surface-lowest/70 hover:bg-surface-lowest hover:border-outline-variant transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={cn(
                              'text-sm font-black w-6 text-center shrink-0',
                              index === 0 ? 'text-amber-600' : index === 1 ? 'text-slate-500' : index === 2 ? 'text-amber-800' : 'text-on-surface-variant text-xs'
                            )}>
                              {rankMedal}
                            </span>
                            <div className="truncate">
                              <span className="font-sans font-bold text-xs text-on-surface block truncate">
                                {item.name}
                              </span>
                              <span className="text-[11px] font-sans text-on-surface-variant">
                                {formatIDR(item.totalRevenue)} omzet
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-sans font-bold text-xs text-primary tabular-nums block">
                              {item.quantitySold}x
                            </span>
                            <span className="text-[10px] text-on-surface-variant font-medium">terjual</span>
                          </div>
                        </div>

                        {/* Relative Progress Bar */}
                        <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              index === 0
                                ? 'bg-amber-600'
                                : index === 1
                                ? 'bg-primary'
                                : 'bg-primary/70'
                            )}
                            style={{ width: Math.max(percentage, 5) + '%' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Riwayat Transaksi Table */}
            <div className="bg-surface rounded-2xl border border-outline-variant overflow-hidden shadow-level1">
              <div className="p-4 border-b border-outline-variant flex items-center justify-between">
                <h3 className="font-sans font-bold text-base text-brand">Daftar Transaksi Pesanan SELA</h3>
                <span className="text-xs text-outline">Total: {transPagination.totalCount} transaksi</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container/60 text-outline font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Order / Meja</th>
                      <th className="py-3 px-4">Waktu (WIB)</th>
                      <th className="py-3 px-4">Metode</th>
                      <th className="py-3 px-4">Status Bayar</th>
                      <th className="py-3 px-4">Status Dapur</th>
                      <th className="py-3 px-4 text-right">Total Kotor</th>
                      <th className="py-3 px-4 text-right">Refund</th>
                      <th className="py-3 px-4 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60 font-medium">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-surface-container/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-brand block">{t.orderNumber}</span>
                          <span className="text-[10px] text-outline">Meja {t.tableNumber}</span>
                        </td>
                        <td className="py-3 px-4 text-brand/80">{t.createdAtJakarta}</td>
                        <td className="py-3 px-4 font-bold">{t.paymentMethod}</td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold',
                              t.paymentStatus === 'PAID'
                                ? 'bg-green-100 text-green-800'
                                : t.paymentStatus === 'WAITING_CASHIER'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-surface-container text-outline'
                            )}
                          >
                            {t.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container text-brand/80">
                            {t.orderStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums">
                          {formatIDR(t.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-700 font-semibold tabular-nums">
                          {t.refundAmount > 0 ? `-${formatIDR(t.refundAmount)}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-brand tabular-nums">
                          {formatIDR(t.netAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {transactions.length === 0 && (
                <div className="text-center py-8 text-xs text-outline font-medium">
                  Tidak ada transaksi pada rentang tanggal yang dipilih.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: AUDIT TRAIL                                                        */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <div className="bg-surface rounded-2xl border border-outline-variant overflow-hidden shadow-level1 space-y-4 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-3">
              <div>
                <h3 className="font-sans font-bold text-base text-brand">Audit Trail Aktivitas Sistem Kafe</h3>
                <p className="text-xs text-brand/70">
                  Catatan perubahan harga, stok, konfirmasi tunai, pembatalan, refund, dan konfigurasi bersifat append-only.
                </p>
              </div>

              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-outline-variant text-xs bg-surface-lowest font-medium focus:outline-none"
              >
                <option value="ALL">Semua Aksi</option>
                <option value="UPDATE_MENU_ITEM">UPDATE_MENU_ITEM</option>
                <option value="TOGGLE_MENU_STOCK">TOGGLE_MENU_STOCK</option>
                <option value="CONFIRM_CASH">CONFIRM_CASH</option>
                <option value="ORDER_CANCELLED">ORDER_CANCELLED</option>
                <option value="MANUAL_REFUND_COMPLETED">MANUAL_REFUND_COMPLETED</option>
                <option value="FINANCIAL_POLICY_UPDATED">FINANCIAL_POLICY_UPDATED</option>
                <option value="QUIZ_CONFIG_UPDATED">QUIZ_CONFIG_UPDATED</option>
                <option value="PRINT_ATTEMPT">PRINT_ATTEMPT</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container/60 text-outline font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Waktu (WIB)</th>
                    <th className="py-2.5 px-3">Aktor</th>
                    <th className="py-2.5 px-3">Aksi</th>
                    <th className="py-2.5 px-3">Rincian Perubahan (Tersanitasi)</th>
                    <th className="py-2.5 px-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-container/30 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-brand/80">{log.createdAtJakarta}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-bold">
                        {log.staffUser ? `${log.staffUser.username} (${log.staffUser.role})` : 'Sistem / Tamu'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container text-brand font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-brand/80 max-w-md truncate">
                        {log.details || '-'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-outline text-[11px]">{log.ipAddress || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {auditLogs.length === 0 && (
              <div className="text-center py-8 text-xs text-outline font-medium">
                Belum ada catatan aktivitas untuk filter aksi ini.
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: MANAJEMEN MEJA & GENERATOR MASTER QR                               */}
        {/* ========================================================================= */}
        {activeTab === 'tables' && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-surface p-6 rounded-2xl border border-outline-variant shadow-level1 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-terracotta">
                    Meja & QR Code
                  </span>
                  <h2 className="font-sans font-bold text-xl text-brand mt-0.5">
                    Manajemen Meja Kafe & Generator Master QR
                  </h2>
                  <p className="text-xs text-brand/70 max-w-2xl mt-1">
                    Kelola nomor meja, label lokasi fisik, status aktif, dan buat kode QR fisik beresolusi tinggi (PNG/SVG/PDF Sheet A4).
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleOpenAddTable}
                    className="touch-target px-4 py-2 rounded-xl bg-primary text-white font-sans font-bold text-xs flex items-center gap-1.5 hover:bg-primary-container transition-all shadow-sm active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Meja
                  </button>

                  <Link
                    href="/staff/admin/tables/print-sheet"
                    target="_blank"
                    className="touch-target px-4 py-2 rounded-xl border border-outline-variant bg-surface-lowest text-on-surface font-sans font-bold text-xs flex items-center gap-1.5 hover:bg-surface-container transition-all shadow-2xs active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak Lembar A4
                  </Link>
                </div>
              </div>

              {/* Zero Secret Leak & Security Banner */}
              <div className="p-3.5 rounded-xl border border-green-200 bg-green-50/70 text-xs text-green-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Zero Secret Leak Guarantee (DEC-014):</span>{' '}
                  QR fisik stiker meja hanya berisi rute publik pelanggan (<code>/order?table=XX</code>). Mutlak tidak memuat token sesi, orderSecretToken, atau cookie autentikasi. Tamu baru yang memindai QR meja ini tidak akan melihat tagihan atau riwayat pemesanan pelanggan sebelumnya.
                </div>
              </div>

              {/* Environment Guard & Switcher */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Staging Info */}
                <div
                  onClick={() => setTableTargetEnv('staging')}
                  className={cn(
                    'p-4 rounded-xl border cursor-pointer transition-all space-y-1.5',
                    tableTargetEnv === 'staging'
                      ? 'border-terracotta bg-terracotta/5 ring-1 ring-terracotta'
                      : 'border-outline-variant bg-surface-lowest hover:border-terracotta/50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                      Mode Staging / Preview
                    </span>
                    {tableTargetEnv === 'staging' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-terracotta text-white">
                        Aktif Terpilih
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-brand/70 truncate">
                    Base: {tableEnvInfo?.stagingUrl || tableEnvInfo?.appUrl || 'http://localhost:3000'}
                  </p>
                  <p className="text-[10px] text-brand/60">
                    Aman digunakan untuk pengujian internal, prototipe, dan verifikasi alur pemesanan. Lembar cetak akan memuat badge & watermark STAGING.
                  </p>
                </div>

                {/* Production Domain Info */}
                <div
                  onClick={() => {
                    if (tableEnvInfo?.isProductionConfigured) {
                      setTableTargetEnv('production')
                    } else {
                      showToast('Domain produksi belum diatur di menu Pengaturan. Master Live BLOCKED.', 'error')
                    }
                  }}
                  className={cn(
                    'p-4 rounded-xl border transition-all space-y-1.5',
                    !tableEnvInfo?.isProductionConfigured
                      ? 'border-amber-300 bg-amber-50/50 cursor-not-allowed'
                      : tableTargetEnv === 'production'
                      ? 'border-green-600 bg-green-50/40 ring-1 ring-green-600 cursor-pointer'
                      : 'border-outline-variant bg-surface-lowest hover:border-green-600/50 cursor-pointer'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                      Master Cetak Produksi (Live)
                    </span>
                    {tableEnvInfo?.isProductionConfigured ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-700 text-white">
                        {tableTargetEnv === 'production' ? 'Aktif Terpilih' : 'Siap Digunakan'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-800 text-white">
                        BLOCKED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-brand/70 truncate">
                    {tableEnvInfo?.isProductionConfigured
                      ? `Domain: ${tableEnvInfo.productionDomain}`
                      : 'Domain belum dikonfigurasi'}
                  </p>
                  <p className="text-[10px] text-brand/60">
                    {tableEnvInfo?.isProductionConfigured
                      ? 'QR permanen untuk stiker fisik meja kafe. Bebas watermark staging.'
                      : 'Atur domain produksi resmi pada tab Pengaturan & Pajak untuk membuka fitur unduh master produksi permanen.'}
                  </p>
                </div>
              </div>

              {/* Batch Export Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-outline-variant/60 flex-wrap gap-2 text-xs">
                <span className="text-brand/70 font-semibold text-[11px]">
                  Target Unduhan Saat Ini: <strong className="text-brand uppercase">{tableTargetEnv}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/staff/admin/tables/export/pdf?env=${tableTargetEnv}`}
                    download
                    className={cn(
                      'touch-target px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors',
                      tableTargetEnv === 'production' && !tableEnvInfo?.isProductionConfigured
                        ? 'opacity-50 pointer-events-none border-outline bg-surface-container text-outline'
                        : 'border-outline-variant bg-surface hover:bg-surface-container text-brand'
                    )}
                  >
                    <FileDown className="w-4 h-4 text-terracotta" />
                    Unduh Sheet PDF A4
                  </a>

                  <a
                    href={`/api/staff/admin/tables/export/zip?env=${tableTargetEnv}`}
                    download
                    className={cn(
                      'touch-target px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors',
                      tableTargetEnv === 'production' && !tableEnvInfo?.isProductionConfigured
                        ? 'opacity-50 pointer-events-none border-outline bg-surface-container text-outline'
                        : 'border-outline-variant bg-surface hover:bg-surface-container text-brand'
                    )}
                  >
                    <Download className="w-4 h-4 text-terracotta" />
                    Unduh ZIP Semua QR ({tables.filter((t) => t.isActive).length})
                  </a>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-surface p-4 rounded-2xl border border-outline-variant">
                <span className="text-xs text-outline font-bold uppercase">Total Meja</span>
                <p className="font-sans font-black text-2xl text-brand mt-1">{tables.length}</p>
              </div>
              <div className="bg-surface p-4 rounded-2xl border border-outline-variant">
                <span className="text-xs text-green-700 font-bold uppercase">Meja Aktif</span>
                <p className="font-sans font-black text-2xl text-green-700 mt-1">
                  {tables.filter((t) => t.isActive).length}
                </p>
              </div>
              <div className="bg-surface p-4 rounded-2xl border border-outline-variant">
                <span className="text-xs text-amber-700 font-bold uppercase">Meja Nonaktif</span>
                <p className="font-sans font-black text-2xl text-amber-700 mt-1">
                  {tables.filter((t) => !t.isActive).length}
                </p>
              </div>
              <div className="bg-surface p-4 rounded-2xl border border-outline-variant">
                <span className="text-xs text-outline font-bold uppercase">Status Master Produksi</span>
                <p
                  className={cn(
                    'font-sans font-black text-xl mt-1',
                    tableEnvInfo?.isProductionConfigured ? 'text-green-700' : 'text-amber-700'
                  )}
                >
                  {tableEnvInfo?.isProductionConfigured ? 'SIAP CETAK' : 'BLOCKED'}
                </p>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-surface p-4 rounded-2xl border border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nomor meja atau label lokasi..."
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest text-xs focus:outline-none focus:border-terracotta"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className="text-outline mr-1 text-[11px]">Filter:</span>
                {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setTableStatusFilter(status)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border transition-all text-[11px]',
                      tableStatusFilter === status
                        ? 'bg-primary text-white border-primary shadow-xs font-bold'
                        : 'bg-surface-lowest border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    )}
                  >
                    {status === 'ALL' ? 'Semua' : status === 'ACTIVE' ? 'Aktif Saja' : 'Nonaktif Saja'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tables Grid */}
            {isInitialLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <AdminTableRowSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tables
                .filter((t) => {
                  const matchSearch =
                    t.tableNumber.toLowerCase().includes(tableSearchQuery.toLowerCase()) ||
                    (t.label && t.label.toLowerCase().includes(tableSearchQuery.toLowerCase()))
                  const matchStatus =
                    tableStatusFilter === 'ALL'
                      ? true
                      : tableStatusFilter === 'ACTIVE'
                      ? t.isActive
                      : !t.isActive
                  return matchSearch && matchStatus
                })
                .map((table) => {
                  const baseUrl =
                    tableTargetEnv === 'production' && tableEnvInfo?.productionDomain
                      ? tableEnvInfo.productionDomain.replace(/\/$/, '')
                      : (tableEnvInfo?.stagingUrl || tableEnvInfo?.appUrl || '').replace(/\/$/, '')
                  const qrTargetUrl = `${baseUrl}/order?table=${encodeURIComponent(table.tableNumber)}`

                  return (
                    <div
                      key={table.id}
                      className={cn(
                        'bg-surface rounded-2xl border p-4 flex flex-col justify-between shadow-level1 transition-all',
                        table.isActive ? 'border-outline-variant' : 'border-outline-variant/60 opacity-80 bg-surface/60'
                      )}
                    >
                      {/* Card Top: Number, Label, Status */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                              MEJA SELA
                            </span>
                            <h3 className="font-sans font-black text-2xl text-brand leading-none mt-0.5">
                              {table.tableNumber}
                            </h3>
                          </div>

                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                              table.isActive
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            )}
                          >
                            {table.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>

                        <p className="text-xs text-brand/70 font-medium mt-1 truncate">
                          {table.label || <span className="italic text-brand/40">Tanpa label lokasi</span>}
                        </p>

                        {/* QR Image Preview */}
                        <div className="my-3 flex flex-col items-center">
                          <div className="relative p-2 rounded-xl bg-white border border-outline-variant shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/staff/admin/tables/${table.id}/qr?format=png&env=${tableTargetEnv}&inline=true`}
                              alt={`QR Meja ${table.tableNumber}`}
                              className="w-32 h-32 object-contain"
                              loading="lazy"
                            />
                            {tableTargetEnv === 'staging' && (
                              <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-amber-500 text-black px-1 rounded shadow">
                                STAGING
                              </span>
                            )}
                          </div>
                          <div className="w-full mt-2 text-center">
                            <span className="text-[9px] font-mono text-brand/50 block truncate px-2" title={qrTargetUrl}>
                              {qrTargetUrl}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Bottom: Actions */}
                      <div className="space-y-2 pt-2 border-t border-outline-variant/50 text-xs">
                        {/* Action Row 1: Status Toggle & Edit */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleTableActive(table)}
                            className={cn(
                              'touch-target py-1.5 px-2 rounded-lg font-bold text-[11px] border transition-colors text-center',
                              table.isActive
                                ? 'border-amber-300 text-amber-800 hover:bg-amber-50'
                                : 'border-green-300 text-green-800 hover:bg-green-50'
                            )}
                          >
                            {table.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditTable(table)}
                            className="touch-target py-1.5 px-2 rounded-lg font-bold text-[11px] border border-outline-variant text-brand hover:bg-surface-container text-center"
                          >
                            Edit Meja
                          </button>
                        </div>

                        {/* Action Row 2: Downloads & Open */}
                        <div className="flex items-center justify-between gap-1 pt-1 text-[11px]">
                          <a
                            href={`/api/staff/admin/tables/${table.id}/qr?format=png&env=${tableTargetEnv}`}
                            download
                            className="text-terracotta hover:underline font-bold"
                            title="Unduh PNG 1024x1024px"
                          >
                            PNG
                          </a>
                          <span className="text-outline-variant">•</span>
                          <a
                            href={`/api/staff/admin/tables/${table.id}/qr?format=svg&env=${tableTargetEnv}`}
                            download
                            className="text-terracotta hover:underline font-bold"
                            title="Unduh SVG Vektor Murni"
                          >
                            SVG
                          </a>
                          <span className="text-outline-variant">•</span>
                          <Link
                            href={`/order?table=${encodeURIComponent(table.tableNumber)}`}
                            target="_blank"
                            className="text-brand/70 hover:text-brand font-semibold flex items-center gap-1"
                            title="Buka rute pemesanan pelanggan"
                          >
                            <span>Tes Buka</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!isInitialLoading && tables.length === 0 && (
              <div className="text-center py-12 bg-surface rounded-2xl border border-outline-variant space-y-3">
                <p className="text-sm font-bold text-on-surface">Belum ada meja yang terdaftar.</p>
                <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                  Mulai dengan menambahkan meja pertama Anda untuk mengaktifkan pemesanan QR tamu.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddTable}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white font-sans font-bold text-xs hover:bg-primary-container shadow-sm transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Meja Baru
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI ARSIP / PULIHKAN MENU (CUSTOM MODAL - ZERO BROWSER ALERT) */}
      {/* ========================================================================= */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface max-w-md w-full rounded-3xl border border-outline-variant p-6 shadow-level3 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-base text-brand">
                  {archiveTarget.isArchived ? 'Pulihkan Menu?' : 'Arsipkan Menu Ini?'}
                </h3>
                <p className="text-xs text-brand/70 font-sans">
                  {archiveTarget.isArchived ? 'Menu akan kembali aktif di katalog' : 'Menu akan disembunyikan dari katalog'}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-low border border-outline-variant/60 text-xs font-sans text-brand/80 space-y-1">
              <p className="font-bold text-on-surface">
                {archiveTarget.name}
              </p>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                {archiveTarget.isArchived
                  ? 'Menu akan kembali dapat dipesan oleh pelanggan di meja dan aktif pada kuis kurasi selera.'
                  : 'Menu tidak akan muncul lagi pada katalog dan kuis pelanggan, namun riwayat transaksi sebelumnya tetap aman tersimpan pada sistem pembukuan.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-outline-variant/60">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                disabled={isArchivingInProgress}
                className="px-4 py-2 rounded-xl border border-outline-variant text-brand font-sans font-bold hover:bg-surface-container active:scale-95 transition-all text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmArchiveToggle}
                disabled={isArchivingInProgress}
                className={cn(
                  "px-5 py-2 rounded-xl text-white font-sans font-bold shadow-sm active:scale-95 transition-all text-xs disabled:opacity-50",
                  archiveTarget.isArchived ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary hover:bg-primary-container"
                )}
              >
                {isArchivingInProgress
                  ? 'Menyimpan...'
                  : archiveTarget.isArchived
                  ? 'Ya, Pulihkan Menu'
                  : 'Ya, Arsipkan Menu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FORM TAMBAH / EDIT MENU                                             */}
      {/* ========================================================================= */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface max-w-xl w-full max-h-[85vh] sm:max-h-[90vh] rounded-3xl border border-outline-variant shadow-level3 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* STICKY HEADER */}
            <div className="shrink-0 flex items-center justify-between border-b border-outline-variant px-6 py-4 bg-surface z-10">
              <h3 className="font-sans font-bold text-lg text-brand">
                {editingMenuItem ? 'Edit Menu Katalog' : 'Tambah Menu Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMenuModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-brand hover:bg-surface-container font-bold text-sm transition-colors"
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMenu} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block font-bold mb-1">Nama Menu:</label>
                <input
                  type="text"
                  required
                  value={menuFormName}
                  onChange={(e) => setMenuFormName(e.target.value)}
                  placeholder="Contoh: Es Kopi Susu Sela"
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Kategori:</label>
                  <select
                    value={menuFormCategoryId}
                    onChange={(e) => setMenuFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Harga Satuan (IDR):</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    required
                    value={menuFormPrice}
                    onChange={(e) => setMenuFormPrice(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta font-bold tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Deskripsi Menu:</label>
                <textarea
                  rows={2}
                  required
                  value={menuFormDescription}
                  onChange={(e) => setMenuFormDescription(e.target.value)}
                  placeholder="Rincian rasa dan bahan baku pilihan..."
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta"
                />
              </div>

              {/* Upload Foto */}
              <div>
                <label className="block font-bold mb-1">Foto Menu (Maks 2 MB, JPG/PNG/WebP):</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface-container border border-outline-variant relative flex-shrink-0">
                    {menuFormImage ? (
                      <Image
                        src={menuFormImage}
                        alt="Preview"
                        fill
                        unoptimized={menuFormImage.startsWith('/api/images/') || menuFormImage.startsWith('data:')}
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline">
                        <Coffee className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div>
                      <label
                        htmlFor="menu-image-upload"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant bg-surface-lowest hover:bg-surface-container text-on-surface text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 transition-all"
                      >
                        <Upload className="w-3.5 h-3.5 text-primary" />
                        <span>{menuFormImage ? 'Ganti Berkas Foto' : 'Pilih Berkas Foto'}</span>
                      </label>
                      <input
                        id="menu-image-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageFileUpload}
                        disabled={isUploadingImage}
                        className="sr-only"
                      />
                    </div>
                    {isUploadingImage && (
                      <span className="text-[10px] text-primary font-bold animate-pulse block">
                        Mengompresi & mengunggah foto...
                      </span>
                    )}
                    <span className="text-[10px] text-brand/60 block">
                      Foto otomatis dikompresi menjadi WebP ringan agar katalog cepat terbuka.
                    </span>
                    {menuFormImage && (
                      <button
                        type="button"
                        onClick={() => setMenuFormImage(null)}
                        className="text-[10px] text-red-700 underline block"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tags Selector */}
              <div>
                <label className="block font-bold mb-1.5">Tag Preferensi Kuis (Pilih yang relevan):</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-xl border border-outline-variant bg-surface-lowest">
                  {allTags.map((tag) => {
                    const isSelected = menuFormTagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setMenuFormTagIds((prev) =>
                            isSelected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                          )
                        }}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-bold transition-all',
                          isSelected
                            ? 'bg-primary text-white border border-primary shadow-xs'
                            : 'bg-surface-lowest text-on-surface-variant border border-outline-variant hover:border-primary hover:text-on-surface'
                        )}
                      >
                        #{tag.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Modifier Groups Selector */}
              <div className="space-y-3">
                <label className="block font-bold mb-1">Grup Kustomisasi yang Ditugaskan:</label>

                {/* Minuman & Kopi */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block mb-1">
                    ☕ Minuman & Kopi
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modifierGroups
                      .filter((mg) => !['mod-group-food-prep', 'mod-group-sauce', 'mod-group-spiciness'].includes(mg.id) && !mg.name.toLowerCase().includes('makanan') && !mg.name.toLowerCase().includes('saus') && !mg.name.toLowerCase().includes('pedas'))
                      .map((mg) => {
                        const isChecked = menuFormModifierGroupIds.includes(mg.id)
                        return (
                          <label key={mg.id} className={cn(
                            "flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer",
                            isChecked ? "bg-primary/5 border-primary text-primary" : "border-outline-variant/60 bg-surface-lowest text-on-surface hover:bg-surface-container"
                          )}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setMenuFormModifierGroupIds((prev) =>
                                  e.target.checked ? [...prev, mg.id] : prev.filter((id) => id !== mg.id)
                                )
                              }}
                              className="rounded text-primary focus:ring-primary"
                            />
                            <span className="font-semibold text-xs truncate">{mg.name}</span>
                          </label>
                        )
                      })}
                  </div>
                </div>

                {/* Makanan & Pastry */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">
                    🥐 Makanan & Pastry
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modifierGroups
                      .filter((mg) => ['mod-group-food-prep', 'mod-group-sauce', 'mod-group-spiciness'].includes(mg.id) || mg.name.toLowerCase().includes('makanan') || mg.name.toLowerCase().includes('saus') || mg.name.toLowerCase().includes('pedas'))
                      .map((mg) => {
                        const isChecked = menuFormModifierGroupIds.includes(mg.id)
                        return (
                          <label key={mg.id} className={cn(
                            "flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer",
                            isChecked ? "bg-primary/5 border-primary text-primary" : "border-outline-variant/60 bg-surface-lowest text-on-surface hover:bg-surface-container"
                          )}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setMenuFormModifierGroupIds((prev) =>
                                  e.target.checked ? [...prev, mg.id] : prev.filter((id) => id !== mg.id)
                                )
                              }}
                              className="rounded text-primary focus:ring-primary"
                            />
                            <span className="font-semibold text-xs truncate">{mg.name}</span>
                          </label>
                        )
                      })}
                  </div>
                </div>
              </div>

              </div>

              {/* STICKY FOOTER */}
              <div className="shrink-0 flex items-center justify-between border-t border-outline-variant px-6 py-3.5 bg-surface z-10">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={menuFormIsPopular}
                    onChange={(e) => setMenuFormIsPopular(e.target.checked)}
                    className="rounded text-terracotta"
                  />
                  <span>Tandai sebagai Best Seller</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMenuModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-outline-variant text-brand font-bold hover:bg-surface-container active:scale-95 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-primary text-white font-sans font-bold hover:bg-primary-container shadow-level1 active:scale-95 transition-all"
                  >
                    Simpan Menu
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FORM TAMBAH / EDIT MEJA                                             */}
      {/* ========================================================================= */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface max-w-md w-full max-h-[85vh] sm:max-h-[90vh] rounded-3xl border border-outline-variant shadow-level3 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* STICKY HEADER */}
            <div className="shrink-0 flex items-center justify-between border-b border-outline-variant px-6 py-4 bg-surface z-10">
              <h3 className="font-sans font-bold text-lg text-brand">
                {editingTable ? `Edit Meja ${editingTable.tableNumber}` : 'Tambah Meja Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsTableModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-brand hover:bg-surface-container font-bold text-sm transition-colors"
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div>
                  <label className="block font-bold mb-1">Nomor Meja (Maks 15 Karakter):</label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={tableFormNumber}
                    onChange={(e) => setTableFormNumber(e.target.value.toUpperCase())}
                    placeholder="Contoh: 08, 15, BAR-1, VIP"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-primary font-sans font-bold text-sm uppercase"
                  />
                  
                  {/* Preset Cepat */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    <span className="text-[10px] text-brand/60 font-sans">Preset Cepat:</span>
                    {['01', '02', '03', '07', '08', '09', '10', '11', '12', 'VIP-1', 'BAR-1'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTableFormNumber(preset)}
                        className="px-2 py-0.5 rounded-lg border border-outline-variant bg-surface-lowest text-[10.5px] font-sans font-semibold text-brand hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Live URL Preview */}
                  <div className="mt-2.5 p-2 rounded-xl bg-surface-low border border-outline-variant/60 text-[11px] font-sans text-brand/80">
                    <div className="text-[10px] font-bold text-brand uppercase tracking-wider mb-0.5">
                      Target URL Pemesanan Tamu:
                    </div>
                    <code className="block bg-surface-lowest px-2 py-1 rounded border border-outline-variant/50 font-mono text-[10.5px] text-primary truncate select-all">
                      /menu?table={tableFormNumber.trim().replace(/\s+/g, '-').toUpperCase() || 'XX'}
                    </code>
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1">Label Lokasi (Opsional):</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={tableFormLabel}
                    onChange={(e) => setTableFormLabel(e.target.value)}
                    placeholder="Contoh: Area Bar Utama / Semi-Outdoor Lantai 2"
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-lowest focus:outline-none focus:border-terracotta"
                  />
                  <p className="text-[10px] text-brand/60 mt-1">
                    Label membantu staf dan kasir mengenali letak fisik meja tanpa mengubah URL pemesanan.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-outline-variant/60 bg-surface-lowest space-y-1">
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tableFormIsActive}
                      onChange={(e) => setTableFormIsActive(e.target.checked)}
                      className="rounded text-terracotta"
                    />
                    <span>Status Meja Aktif untuk Pemesanan</span>
                  </label>
                  <p className="text-[10px] text-brand/60 pl-6">
                    Jika dinonaktifkan, pelanggan yang memindai QR akan menerima penolakan saat membuat order atau quote baru (<code>TABLE_INACTIVE</code>), namun riwayat pesanan sebelumnya tetap aman dan dapat diakses.
                  </p>
                </div>
              </div>

              {/* STICKY FOOTER */}
              <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-3.5 border-t border-outline-variant/60 bg-surface z-10">
                <button
                  type="button"
                  onClick={() => setIsTableModalOpen(false)}
                  className="touch-target px-4 py-2 rounded-xl border border-outline-variant text-brand font-bold hover:bg-surface-container active:scale-95 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingTable}
                  className="touch-target px-5 py-2 rounded-xl bg-primary text-white font-sans font-bold hover:bg-primary-container shadow-sm active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isSavingTable ? 'Menyimpan...' : 'Simpan Meja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL SUKSES MEJA BARU & INSTANT QR CODE PREVIEW                          */}
      {/* ========================================================================= */}
      {createdTableSuccess && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface max-w-md w-full rounded-3xl border border-outline-variant p-6 shadow-level3 my-8 space-y-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-sans font-black text-2xl text-brand">
                Meja {createdTableSuccess.tableNumber} Berhasil Dibuat!
              </h3>
              <p className="text-xs text-brand/70 font-sans">
                {createdTableSuccess.label || `Meja ${createdTableSuccess.tableNumber}`} telah terdaftar dan siap dipindai tamu.
              </p>
            </div>

            {/* QR Code Graphic Frame */}
            <div className="p-4 bg-white rounded-2xl border border-outline-variant shadow-xs inline-block mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/staff/admin/tables/${createdTableSuccess.id}/qr?format=png`}
                alt={`QR Code Meja ${createdTableSuccess.tableNumber}`}
                className="w-48 h-48 rounded-xl object-contain mx-auto"
              />
              <div className="mt-2 text-[11px] font-mono font-bold text-brand">
                /menu?table={createdTableSuccess.tableNumber}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-sans font-bold">
              <a
                href={`/api/staff/admin/tables/${createdTableSuccess.id}/qr?format=png&download=true`}
                download={`qr-meja-${createdTableSuccess.tableNumber}.png`}
                className="py-2.5 px-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 text-brand"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh PNG
              </a>
              <a
                href={`/api/staff/admin/tables/${createdTableSuccess.id}/qr?format=svg&download=true`}
                download={`qr-meja-${createdTableSuccess.tableNumber}.svg`}
                className="py-2.5 px-3 rounded-xl border border-outline-variant hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 text-brand"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh SVG
              </a>
            </div>

            <div className="space-y-2 pt-2 border-t border-outline-variant/60">
              <Link
                href={`/menu?table=${createdTableSuccess.tableNumber}`}
                target="_blank"
                className="block w-full py-2.5 px-4 rounded-xl bg-terracotta text-white font-sans font-bold text-xs hover:bg-primary-container transition-colors shadow-level1"
              >
                Buka & Tes Menu Meja Ini ↗
              </Link>
              <button
                type="button"
                onClick={() => setCreatedTableSuccess(null)}
                className="w-full py-2 rounded-xl text-xs font-sans text-brand/70 hover:text-brand transition-colors"
              >
                Tutup & Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

