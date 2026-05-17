"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Orbit, Trophy, Users } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SiteLoader } from "@/components/ui/site-loader";
import { useAdminAuth } from "@/hooks/use-admin-auth";

type StudentIndicatorSummary = {
  id: string;
  name: string;
  circleName: string;
  memorized: number;
  revised: number;
  tied: number;
  percent: number;
  attendPercent: number;
  memorizedPercent: number;
  tikrarPercent: number;
  revisedPercent: number;
  tiedPercent: number;
  score: number;
};

const TEXT = {
  title: "مؤشرات طلاب الحلقة",
  attendanceMetric: "الحضور",
  memorizedMetric: "التسميع",
  tikrarMetric: "التكرار",
  revisedMetric: "المراجعة",
  tiedMetric: "الربط",
  studentsCount: "عدد الطلاب",
  averageScore: "متوسط الأداء",
  backToStatistics: "العودة للإحصائيات",
  noData: "لا يوجد طلاب أو بيانات لعرضها في هذه الحلقة خلال الفترة المحددة",
  loadError: "تعذر تحميل مؤشرات الطلاب",
  overallScore: "المؤشر العام",
};

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: value >= 10 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(Math.max(0, Math.min(100, value)))}%`;
}

function getReadableErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "حدث خطأ غير معروف أثناء تحميل البيانات";
}

function MetricBar({
  label,
  value,
  trackClass,
  fillClass,
}: {
  label: string;
  value: number;
  trackClass: string;
  fillClass: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)_72px] items-center gap-3 text-xs font-bold text-[#5f6b7a]">
      <span className="text-left tabular-nums text-[#4c5a6a]">{formatPercent(safeValue)}</span>
      <div className={`h-2.5 overflow-hidden rounded-full ${trackClass}`}>
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${safeValue}%` }} />
      </div>
      <span className="text-right whitespace-nowrap">{label}</span>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Users; accent: string }) {
  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-[#6b7280]">{label}</span>
        <span className={`rounded-full p-2 ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="text-2xl font-extrabold text-[#1a2332]">{value}</div>
    </div>
  );
}

export default function CircleStudentIndicatorsPage() {
  const { isLoading: authLoading, isVerified: authVerified } = useAdminAuth("الإحصائيات");
  const params = useParams();
  const searchParams = useSearchParams();
  const requestedCircleName = decodeURIComponent(String(params.circleName ?? ""));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [circleName, setCircleName] = useState(requestedCircleName);
  const [students, setStudents] = useState<StudentIndicatorSummary[]>([]);

  useEffect(() => {
    if (!authVerified) {
      return;
    }

    void fetchStudentIndicators();
  }, [authVerified, requestedCircleName, searchParams]);

  async function fetchStudentIndicators() {
    setLoading(true);
    setError("");

    try {
      const nextSearchParams = new URLSearchParams();
      nextSearchParams.set("circle", requestedCircleName);

      const filter = searchParams.get("filter") || "currentMonth";
      nextSearchParams.set("filter", filter);

      const start = searchParams.get("start");
      const end = searchParams.get("end");
      if (filter === "custom" && start && end) {
        nextSearchParams.set("start", start);
        nextSearchParams.set("end", end);
      }

      const response = await fetch(`/api/statistics/circle-students?${nextSearchParams.toString()}`, { cache: "no-store" });
      const payload = await response.json();

      setCircleName(payload.circleName || requestedCircleName);
      setStudents(payload.students || []);
      setError(typeof payload.error === "string" ? payload.error : "");
    } catch (caughtError) {
      setError(`${TEXT.loadError}: ${getReadableErrorMessage(caughtError)}`);
      setStudents([]);
      setCircleName(requestedCircleName);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !authVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafaf9]" dir="rtl">
        <SiteLoader size="md" />
      </div>
    );
  }

  const backSearch = searchParams.toString();
  const backHref = backSearch ? `/admin/statistics?${backSearch}` : "/admin/statistics";
  const averageScore = students.length > 0 ? students.reduce((sum, student) => sum + student.score, 0) / students.length : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#fafaf9] font-cairo" dir="rtl">
      <Header />
      <main className="flex-1 px-4 py-10">
        <div className="container mx-auto max-w-7xl space-y-8">
          <section className="space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3 text-right">
                <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-bold text-[#52627a] transition hover:text-[#1a2332]">
                  <ArrowRight className="h-4 w-4" />
                  <span>{TEXT.backToStatistics}</span>
                </Link>
                <div>
                  <div className="text-sm font-extrabold text-[#7c89c7]">{TEXT.title}</div>
                  <h1 className="mt-2 text-3xl font-black text-[#1a2332] md:text-4xl">{circleName}</h1>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:min-w-[360px] md:max-w-[420px] md:flex-1">
                <SummaryCard label={TEXT.studentsCount} value={new Intl.NumberFormat("ar-SA").format(students.length)} icon={Users} accent="bg-[#e8f3f1] text-[#0f766e]" />
                <SummaryCard label={TEXT.averageScore} value={formatPercent(averageScore)} icon={Trophy} accent="bg-[#eef2ff] text-[#4f46e5]" />
              </div>
            </div>
          </section>

          {loading ? (
            <div className="flex min-h-[55vh] justify-center py-24">
              <SiteLoader size="lg" />
            </div>
          ) : (
            <>
              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
              ) : null}

              <section className="rounded-[24px] border border-[#e5e7eb] bg-white p-5 shadow-sm md:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#111827]">
                    <span className="text-sm font-black text-[#111827]">{circleName}</span>
                  </div>
                  <Orbit className="h-4 w-4 text-[#60a5fa]" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {students.length > 0 ? (
                    students.map((student) => (
                      <div
                        key={student.id}
                        className="space-y-4 rounded-[20px] border border-[#edf0f3] bg-[#fcfdff] p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black text-[#4f46e5]">{TEXT.overallScore}: {formatPercent(student.score)}</div>
                          <div className="text-right text-sm font-black text-[#1f2937]">{student.name}</div>
                        </div>
                        <div className="space-y-2.5">
                          <MetricBar label={TEXT.attendanceMetric} value={student.attendPercent} trackClass="bg-[#fff3bf]" fillClass="bg-[#facc15]" />
                          <MetricBar label={TEXT.memorizedMetric} value={student.memorizedPercent} trackClass="bg-[#dcfce7]" fillClass="bg-[#22c55e]" />
                          <MetricBar label={TEXT.tikrarMetric} value={student.tikrarPercent} trackClass="bg-[#d1fae5]" fillClass="bg-[#10b981]" />
                          <MetricBar label={TEXT.revisedMetric} value={student.revisedPercent} trackClass="bg-[#dbeafe]" fillClass="bg-[#3b82f6]" />
                          <MetricBar label={TEXT.tiedMetric} value={student.tiedPercent} trackClass="bg-[#ede9fe]" fillClass="bg-[#8b5cf6]" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#dbe3ee] bg-[#fafcff] px-6 py-12 text-center text-sm font-bold text-[#7b8796]">
                      {TEXT.noData}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}