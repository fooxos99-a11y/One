"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { hasPermissionAccess } from "@/lib/admin-permissions"
import { ArrowRightLeft, UserPen } from "lucide-react"

interface Circle {
	id: string
	name: string
}

interface Student {
	id: string
	name: string
	points?: number | null
	guardian_phone?: string | null
	id_number?: string | null
	account_number?: string | number | null
	halaqah?: string | null
	circle_name?: string | null
}

const getStudentCircleName = (student: Student) => (student.halaqah || student.circle_name || "غير محدد").trim()

type GlobalEditStudentDialogProps = {
	displayMode?: "dialog" | "inline"
	onInlineActionsChange?: (state: {
		canTransfer: boolean
		canRemove: boolean
		hasSelectedStudent: boolean
		isSubmitting: boolean
		openMoveDialog: () => void
		removeStudent: () => void
	}) => void
	onCloseComplete?: () => void
}

export function GlobalEditStudentDialog({
	displayMode = "dialog",
	onInlineActionsChange,
	onCloseComplete,
}: GlobalEditStudentDialogProps) {
	const router = useRouter()
	const pathname = usePathname()
	const { toast } = useToast()
	const confirmDialog = useConfirmDialog()
	const isInline = displayMode === "inline"

	const [isOpen, setIsOpen] = useState(isInline)
	const [circles, setCircles] = useState<Circle[]>([])
	const [studentsInCircles, setStudentsInCircles] = useState<Record<string, Student[]>>({})
	const [selectedCircleForEdit, setSelectedCircleForEdit] = useState("")
	const [selectedStudentForEdit, setSelectedStudentForEdit] = useState("")
	const [editingStudent, setEditingStudent] = useState<Student | null>(null)
	const [editStudentName, setEditStudentName] = useState("")
	const [editStudentHalaqah, setEditStudentHalaqah] = useState("")
	const [editGuardianPhone, setEditGuardianPhone] = useState("")
	const [editStudentIdNumber, setEditStudentIdNumber] = useState("")
	const [editStudentAccountNumber, setEditStudentAccountNumber] = useState("")
	const [editStudentPoints, setEditStudentPoints] = useState("")
	const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false)
	const [moveTargetCircle, setMoveTargetCircle] = useState("")
	const [canTransferStudent, setCanTransferStudent] = useState(false)
	const [canRemoveStudent, setCanRemoveStudent] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const availableCircles = Array.from(
		new Set([
			...circles.map((circle) => circle.name.trim()),
			...Object.keys(studentsInCircles).map((circleName) => circleName.trim()),
		].filter(Boolean)),
	).sort((first, second) => first.localeCompare(second, "ar"))

	useEffect(() => {
		fetchData()
		void fetchActionPermissions()
	}, [])

	useEffect(() => {
		if (!isInline) {
			setIsOpen(true)
		}
	}, [isInline])

	useEffect(() => {
		onInlineActionsChange?.({
			canTransfer: canTransferStudent,
			canRemove: canRemoveStudent,
			hasSelectedStudent: Boolean(editingStudent),
			isSubmitting,
			openMoveDialog: () => {
				if (editingStudent && !isSubmitting) {
					setIsMoveDialogOpen(true)
				}
			},
			removeStudent: () => {
				if (editingStudent && !isSubmitting) {
					void handleRemoveStudent()
				}
			},
		})
	}, [canRemoveStudent, canTransferStudent, editingStudent, isSubmitting, onInlineActionsChange])

	const fetchData = async () => {
		try {
			const [circlesRes, studentsRes] = await Promise.all([
				fetch("/api/circles", { cache: "no-store" }),
				fetch("/api/students", { cache: "no-store" }),
			])

			const circlesData = await circlesRes.json()
			const studentsData = await studentsRes.json()

			if (circlesRes.ok && circlesData.circles) {
				setCircles(circlesData.circles)
			}

			if (studentsRes.ok && studentsData.students) {
				const grouped: Record<string, Student[]> = {}
				studentsData.students.forEach((student: Student) => {
					const circleName = getStudentCircleName(student)
					if (!grouped[circleName]) {
						grouped[circleName] = []
					}
					grouped[circleName].push(student)
				})
				setStudentsInCircles(grouped)
			}
		} catch (error) {
			console.error("Error fetching edit-student data:", error)
		}
	}

	const fetchActionPermissions = async () => {
		try {
			const authResponse = await fetch("/api/auth", { cache: "no-store" })
			if (!authResponse.ok) {
				setCanTransferStudent(false)
				setCanRemoveStudent(false)
				return
			}

			const authData = await authResponse.json()
			if (!authData?.success || !authData?.authenticated || !authData?.user) {
				setCanTransferStudent(false)
				setCanRemoveStudent(false)
				return
			}

			const sessionUser = authData.user as { role?: string; roleName?: string; accountNumber?: string | number } | undefined
			const normalizedRole = String(sessionUser?.role || "").trim()
			const roleName = String(sessionUser?.roleName || "").trim()
			const freshRole = roleName || normalizedRole
			const accountNumber = Number(sessionUser?.accountNumber || 0)

			if (accountNumber === 2 || freshRole === "admin" || freshRole === "مدير") {
				setCanTransferStudent(true)
				setCanRemoveStudent(true)
				return
			}

			const rolesResponse = await fetch("/api/roles", { cache: "no-store" })
			if (!rolesResponse.ok) {
				setCanTransferStudent(false)
				setCanRemoveStudent(false)
				return
			}

			const rolesData = await rolesResponse.json()
			const permissionsMap = (rolesData.permissions || {}) as Record<string, string[]>
			const rolePermissions = permissionsMap[freshRole] || permissionsMap[normalizedRole] || []
			const isFullAccess = rolePermissions.includes("all")

			setCanTransferStudent(hasPermissionAccess(rolePermissions, "نقل طالب", isFullAccess))
			setCanRemoveStudent(hasPermissionAccess(rolePermissions, "إزالة طالب", isFullAccess))
		} catch {
			setCanTransferStudent(false)
			setCanRemoveStudent(false)
		}
	}

	const handleClose = (open: boolean) => {
		setIsOpen(open)
		if (!open) {
			if (isInline) {
				onCloseComplete?.()
				return
			}

			setTimeout(() => {
				router.push(pathname || "/")
			}, 300)
		}
	}

	const handleSelectStudentForEdit = (studentId: string) => {
		setSelectedStudentForEdit(studentId)
		const student = (studentsInCircles[selectedCircleForEdit] || []).find((item) => item.id === studentId) || null
		setEditingStudent(student)
		setEditStudentName(student?.name || "")
		setEditStudentHalaqah(student ? getStudentCircleName(student) : "")
		setEditGuardianPhone(student?.guardian_phone || "")
		setEditStudentIdNumber(student?.id_number || "")
		setEditStudentAccountNumber(student?.account_number != null ? String(student.account_number) : "")
		setEditStudentPoints(student?.points != null ? String(student.points) : "0")
		setMoveTargetCircle("")
	}

	const resetEditForm = () => {
		setEditingStudent(null)
		setSelectedStudentForEdit("")
		setSelectedCircleForEdit("")
		setEditStudentName("")
		setEditStudentHalaqah("")
		setEditGuardianPhone("")
		setEditStudentIdNumber("")
		setEditStudentAccountNumber("")
		setEditStudentPoints("")
		setMoveTargetCircle("")
		setIsMoveDialogOpen(false)
	}

	const handleSaveStudentEdit = async () => {
		if (!editingStudent) return

		const parsedPoints = Number.parseInt(editStudentPoints, 10)
		if (Number.isNaN(parsedPoints) || parsedPoints < 0) {
			toast({
				title: "حدث خطأ",
				description: "نقاط الطالب يجب أن تكون رقمًا صحيحًا صفر أو أكبر",
				variant: "destructive",
			})
			return
		}

		setIsSubmitting(true)
		try {
			const response = await fetch("/api/students", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					id: editingStudent.id,
					name: editStudentName,
					points: parsedPoints,
					halaqah: editStudentHalaqah,
					guardian_phone: editGuardianPhone,
					id_number: editStudentIdNumber,
					account_number: editStudentAccountNumber.trim() || null,
				}),
			})

			const data = await response.json()

			if (!data.success) {
				throw new Error(data.error || "فشل في تحديث الطالب")
			}

			toast({
				title: "✓ تم الحفظ بنجاح",
				description: `تم تحديث معلومات الطالب ${editingStudent.name} بنجاح`,
				className: "bg-gradient-to-r from-[#3453a7] to-[#4f73d1] text-white border-none",
			})

			await fetchData()
			if (isInline) {
				setEditingStudent({
					...editingStudent,
					name: editStudentName,
					halaqah: editStudentHalaqah,
					guardian_phone: editGuardianPhone,
					id_number: editStudentIdNumber,
					account_number: editStudentAccountNumber.trim() || null,
					points: parsedPoints,
				})
			} else {
				resetEditForm()
				handleClose(false)
			}
		} catch (error) {
			console.error("Error updating student:", error)
			toast({
				title: "حدث خطأ",
				description: error instanceof Error ? error.message : "حدث خطأ أثناء تحديث الطالب",
				variant: "destructive",
			})
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleMoveStudent = async () => {
		if (!editingStudent || !moveTargetCircle) {
			return
		}

		setIsSubmitting(true)
		try {
			const response = await fetch(`/api/students?id=${editingStudent.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ halaqah: moveTargetCircle }),
			})

			const data = await response.json()
			if (!response.ok || !data.success) {
				throw new Error(data.error || "فشل في نقل الطالب")
			}

			toast({
				title: "✓ تم النقل بنجاح",
				description: `تم نقل الطالب ${editingStudent.name} إلى ${moveTargetCircle} بنجاح`,
				className: "bg-gradient-to-r from-[#3453a7] to-[#4f73d1] text-white border-none",
			})

			await fetchData()
			if (isInline) {
				setEditStudentHalaqah(moveTargetCircle)
				setIsMoveDialogOpen(false)
			} else {
				resetEditForm()
				handleClose(false)
			}
		} catch (error) {
			console.error("Error moving student:", error)
			toast({
				title: "حدث خطأ",
				description: error instanceof Error ? error.message : "حدث خطأ أثناء نقل الطالب",
				variant: "destructive",
			})
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleRemoveStudent = async () => {
		if (!editingStudent) {
			return
		}

		const confirmed = await confirmDialog({
			title: "تأكيد إزالة الطالب",
			description: `هل أنت متأكد من إزالة الطالب ${editingStudent.name}؟`,
			confirmText: "إزالة",
			cancelText: "إلغاء",
		})

		if (!confirmed) {
			return
		}

		setIsSubmitting(true)
		try {
			const response = await fetch(`/api/students?id=${editingStudent.id}`, {
				method: "DELETE",
			})

			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || "فشل في إزالة الطالب")
			}

			toast({
				title: "✓ تم الحذف بنجاح",
				description: `تم إزالة الطالب ${editingStudent.name} بنجاح`,
				className: "bg-gradient-to-r from-[#3453a7] to-[#4f73d1] text-white border-none",
			})

			resetEditForm()
			await fetchData()
			if (!isInline) {
				handleClose(false)
			}
		} catch (error) {
			console.error("Error removing student:", error)
			toast({
				title: "حدث خطأ",
				description: error instanceof Error ? error.message : "حدث خطأ أثناء إزالة الطالب",
				variant: "destructive",
			})
		} finally {
			setIsSubmitting(false)
		}
	}

	const availableTransferCircles = availableCircles.filter((circleName) => circleName !== editStudentHalaqah)
	const formContent = (
		<>
			<div className="grid gap-4 py-4">
				<div className="space-y-2">
					<Label className="text-sm font-medium text-neutral-600">اختر الحلقة</Label>
					<Select
						value={selectedCircleForEdit}
						onValueChange={(value) => {
							setSelectedCircleForEdit(value)
							setSelectedStudentForEdit("")
							setEditingStudent(null)
							setEditStudentName("")
							setEditStudentHalaqah("")
							setEditGuardianPhone("")
							setEditStudentIdNumber("")
							setEditStudentAccountNumber("")
							setEditStudentPoints("")
							setMoveTargetCircle("")
						}}
						dir="rtl"
					>
						<SelectTrigger className="w-full text-base">
							<SelectValue placeholder="اختر الحلقة" />
						</SelectTrigger>
						<SelectContent dir="rtl">
							{availableCircles.map((circleName) => (
								<SelectItem key={circleName} value={circleName}>
									{circleName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label className="text-sm font-medium text-neutral-600">اختر الطالب</Label>
					<Select value={selectedStudentForEdit} onValueChange={handleSelectStudentForEdit} disabled={!selectedCircleForEdit} dir="rtl">
						<SelectTrigger className="w-full text-base">
							<SelectValue placeholder={selectedCircleForEdit ? "اختر الطالب" : "اختر الحلقة أولاً"} />
						</SelectTrigger>
						<SelectContent dir="rtl">
							{(studentsInCircles[selectedCircleForEdit] || []).map((student) => (
								<SelectItem key={student.id} value={student.id}>
									{student.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{editingStudent ? (
					<>
						<div className="space-y-2">
							<Label className="text-sm font-medium text-neutral-600">اسم الطالب</Label>
							<Input value={editStudentName} onChange={(event) => setEditStudentName(event.target.value)} placeholder="أدخل اسم الطالب" className="text-sm" />
						</div>
						<div className="space-y-2">
							<Label className="text-sm font-medium text-neutral-600">الحلقة</Label>
							<Select value={editStudentHalaqah} onValueChange={setEditStudentHalaqah} dir="rtl">
								<SelectTrigger className="w-full text-base">
									<SelectValue placeholder="اختر الحلقة" />
								</SelectTrigger>
								<SelectContent dir="rtl">
									{availableCircles.map((circleName) => (
										<SelectItem key={circleName} value={circleName}>
											{circleName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label className="text-sm font-medium text-neutral-600">نقاط الطلاب</Label>
							<Input value={editStudentPoints} onChange={(event) => setEditStudentPoints(event.target.value)} placeholder="أدخل نقاط الطالب" className="text-sm" type="number" dir="ltr" lang="en" min="0" inputMode="numeric" />
						</div>
						<div className="space-y-2">
							<Label className="text-sm font-medium text-neutral-600">رقم الهوية</Label>
							<Input value={editStudentIdNumber} onChange={(event) => setEditStudentIdNumber(event.target.value)} placeholder="أدخل رقم الهوية" className="text-sm" dir="ltr" lang="en" inputMode="numeric" />
						</div>
						<div className="space-y-2">
							<Label className="text-sm font-medium text-neutral-600">رقم الحساب</Label>
							<Input value={editStudentAccountNumber} onChange={(event) => setEditStudentAccountNumber(event.target.value)} placeholder="أدخل رقم الحساب" className="text-sm" dir="ltr" />
						</div>
						<div className="space-y-2">
							<Label className="text-sm font-medium text-neutral-600">رقم جوال ولي الأمر</Label>
							<Input value={editGuardianPhone} onChange={(event) => setEditGuardianPhone(event.target.value)} placeholder="0555555555" className="text-sm" dir="ltr" />
							<p className="text-xs text-gray-500">مثال: 0555555555</p>
						</div>
					</>
				) : null}
			</div>
			<div className={`flex ${isInline ? "justify-between" : "justify-end"} gap-2`}>
				{!isInline && canTransferStudent ? (
					<Button
						variant="outline"
						onClick={() => setIsMoveDialogOpen(true)}
						className="text-sm h-9 rounded-lg border-[#3453a7]/50 text-[#3453a7]"
						disabled={!editingStudent || isSubmitting}
					>
						نقل الطالب
					</Button>
				) : null}
				{!isInline && canRemoveStudent ? (
					<Button
						variant="outline"
						onClick={handleRemoveStudent}
						className="text-sm h-9 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
						disabled={!editingStudent || isSubmitting}
					>
						إزالة الطالب
					</Button>
				) : null}
				<Button
					variant="outline"
					onClick={() => handleClose(false)}
					className="text-sm h-9 rounded-lg border-[#3453a7]/50 text-neutral-600"
				>
					إلغاء
				</Button>
				<Button
					onClick={handleSaveStudentEdit}
					className="bg-[#3453a7] hover:bg-[#24428f] text-white border-none text-sm h-9 rounded-lg font-medium disabled:bg-[#8ea2df] disabled:text-white disabled:opacity-100 disabled:cursor-not-allowed"
					disabled={!editingStudent || isSubmitting}
				>
					{isSubmitting ? "جاري الحفظ..." : "حفظ التعديلات"}
				</Button>
			</div>
		</>
	)

	return (
		<>
			{isInline ? (
				<div className="overflow-hidden rounded-[1.75rem] border border-[#dbe5f6] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]" dir="rtl">
					<div className="border-b border-[#e6eef9] px-6 py-5">
						<div className="relative flex items-center justify-center">
							<UserPen className="absolute right-0 h-5 w-5 text-[#3453a7]" />
							<h2 className="text-xl font-bold text-[#1a2332]">تعديل بيانات الطالب</h2>
						</div>
					</div>
					<div className="px-6 pb-6">{formContent}</div>
				</div>
			) : (
				<Dialog open={isOpen} onOpenChange={handleClose}>
					<DialogContent className="sm:max-w-[425px]" dir="rtl">
						<DialogHeader>
							<DialogTitle className="relative w-full text-center text-xl text-[#1a2332]">
								<UserPen className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 text-[#3453a7]" />
								<span>تعديل بيانات الطالب</span>
							</DialogTitle>
						</DialogHeader>
						{formContent}
					</DialogContent>
				</Dialog>
			)}

			<Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
				<DialogContent className="sm:max-w-[425px]" dir="rtl">
					<DialogHeader>
						<DialogTitle className="relative w-full text-center text-xl text-[#1a2332]">
							<ArrowRightLeft className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 text-[#3453a7]" />
							<span>نقل الطالب</span>
						</DialogTitle>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="space-y-2">
							<Label className="text-sm font-medium text-neutral-600">الطالب</Label>
							<Input value={editStudentName} disabled className="text-sm bg-neutral-50" />
						</div>
						<div className="space-y-2">
							<Label className="text-sm font-medium text-neutral-600">الحلقة الحالية</Label>
							<Input value={editStudentHalaqah} disabled className="text-sm bg-neutral-50" />
						</div>
						<div className="space-y-2">
							<Label className="text-sm font-medium text-neutral-600">اختر الحلقة المراد نقل الطالب إليها</Label>
							<Select value={moveTargetCircle} onValueChange={setMoveTargetCircle} dir="rtl">
								<SelectTrigger className="w-full text-base">
									<SelectValue placeholder="اختر الحلقة الجديدة" />
								</SelectTrigger>
								<SelectContent dir="rtl">
									{availableTransferCircles.map((circleName) => (
										<SelectItem key={circleName} value={circleName}>
											{circleName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => setIsMoveDialogOpen(false)}
							className="text-sm h-9 rounded-lg border-[#3453a7]/50 text-neutral-600"
						>
							إلغاء
						</Button>
						<Button
							onClick={handleMoveStudent}
							className="bg-[#3453a7] hover:bg-[#24428f] text-white border-none text-sm h-9 rounded-lg font-medium disabled:bg-[#8ea2df] disabled:text-white disabled:opacity-100 disabled:cursor-not-allowed"
							disabled={!editingStudent || !moveTargetCircle || isSubmitting}
						>
							{isSubmitting ? "جاري النقل..." : "تأكيد النقل"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	)
}
