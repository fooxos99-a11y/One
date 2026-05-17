"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { SiteLoader } from "@/components/ui/site-loader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Award, Medal, Gem, Trash2, Plus, User, Trophy, Star, Flame, Zap, Crown, Heart } from "lucide-react";

interface Student {
  id: string;
  name: string;
  circle_name?: string;
}

interface Circle {
  id: string;
  name: string;
  studentCount: number;
}

interface Achievement {
  id: string;
  title: string;
  icon_type: string;
  date: string;
}

export function StudentsAchievementsAdmin({ displayMode = "page" }: { displayMode?: "page" | "inline" }) {
  const confirmDialog = useConfirmDialog();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [icon, setIcon] = useState<string>("trophy");
  const [achievementName, setAchievementName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [achievementsMap, setAchievementsMap] = useState<Record<string, Achievement[]>>({});
  const [isCirclesLoading, setIsCirclesLoading] = useState(true);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);

  useEffect(() => {
    const fetchCircles = async () => {
      try {
        const response = await fetch("/api/circles");
        const data = await response.json();
        setCircles(data.circles || []);
      } catch (error) {
        console.error("Error fetching circles:", error);
        setCircles([]);
      } finally {
        setIsCirclesLoading(false);
      }
    };

    fetchCircles();
  }, []);

  const fetchAchievementsForStudents = async (studentsList: Student[]) => {
    if (studentsList.length === 0) {
      setAchievementsMap({});
      return;
    }

    try {
      const ids = studentsList.map((student) => student.id).join(",");
      const response = await fetch(`/api/achievements?student_ids=${encodeURIComponent(ids)}`);
      const achData = await response.json();
      setAchievementsMap(achData.achievementsByStudent || {});
    } catch (error) {
      console.error("Error fetching achievements batch:", error);
      setAchievementsMap(Object.fromEntries(studentsList.map((student) => [student.id, []])));
    }
  };

  const fetchStudentsByCircle = async (circleName: string) => {
    setIsStudentsLoading(true);
    setSelectedStudent(null);
    setStudents([]);
    setAchievementsMap({});

    try {
      const response = await fetch(`/api/students?circle=${encodeURIComponent(circleName)}`);
      const data = await response.json();
      const studentsList = data.students || [];

      setStudents(studentsList);
      await fetchAchievementsForStudents(studentsList);
    } catch (error) {
      console.error("Error fetching students by circle:", error);
      setStudents([]);
      setAchievementsMap({});
    } finally {
      setIsStudentsLoading(false);
    }
  };

  const handleCircleChange = async (circleName: string) => {
    setSelectedCircle(circleName);

    if (!circleName) {
      setSelectedStudent(null);
      setStudents([]);
      setAchievementsMap({});
      return;
    }

    await fetchStudentsByCircle(circleName);
  };

  const handleSave = async () => {
    if (!selectedStudent || !achievementName) return;

    setIsSaving(true);
    await fetch("/api/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_name: selectedStudent.name,
        student_id: selectedStudent.id,
        icon_type: icon,
        title: achievementName,
        achievement_type: "student",
        date: new Date().toLocaleDateString("ar-EG"),
        description: "تم إضافة إنجاز جديد للطالب.",
        category: "عام",
        status: "مكتمل",
        level: "ممتاز",
      }),
    });

    const response = await fetch(`/api/achievements?student_id=${selectedStudent.id}`);
    const achData = await response.json();

    setAchievementsMap((prev) => ({ ...prev, [selectedStudent.id]: achData.achievements || [] }));
    setIsSaving(false);
    setSelectedStudent(null);
    setAchievementName("");
    setIcon("trophy");
  };

  const handleDelete = async (achievementId: string, studentId: string) => {
    const confirmed = await confirmDialog({
      title: "حذف الإنجاز",
      description: "هل أنت متأكد من حذف هذا الإنجاز؟ لا يمكن التراجع عن هذا الإجراء بعد التنفيذ.",
      confirmText: "حذف الإنجاز",
      cancelText: "إلغاء",
    });

    if (!confirmed) return;

    await fetch(`/api/achievements?id=${achievementId}`, { method: "DELETE" });
    const response = await fetch(`/api/achievements?student_id=${studentId}`);
    const achData = await response.json();
    setAchievementsMap((prev) => ({ ...prev, [studentId]: achData.achievements || [] }));
  };

  const renderIcon = (type: string, cls = "w-4 h-4") => {
    const color = "text-[#3453a7]";

    switch (type) {
      case "medal":
        return <Medal className={`${cls} ${color}`} />;
      case "gem":
        return <Gem className={`${cls} ${color}`} />;
      case "star":
        return <Star className={`${cls} ${color}`} />;
      case "flame":
        return <Flame className={`${cls} ${color}`} />;
      case "zap":
        return <Zap className={`${cls} ${color}`} />;
      case "crown":
        return <Crown className={`${cls} ${color}`} />;
      case "heart":
        return <Heart className={`${cls} ${color}`} />;
      default:
        return <Award className={`${cls} ${color}`} />;
    }
  };

  return (
    <div className={`${displayMode === "inline" ? "bg-transparent" : "min-h-screen bg-[#f7f9fd]"} flex flex-col`} dir="rtl">
      {displayMode === "inline" ? null : <Header />}
      <main className={`flex-1 ${displayMode === "inline" ? "px-0 py-0" : "px-4 py-6 md:px-6 md:py-10"}`}>
        <div className="mx-auto max-w-6xl space-y-6">
          {!selectedStudent ? (
            <div className="rounded-[1.9rem] border border-[#edf2fb] bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:px-7 md:py-7">
              <div className="max-w-sm space-y-1.5">
                <Label className="text-lg font-semibold text-[#1a2332]">الحلقة</Label>
                {isCirclesLoading ? (
                  <div className="flex h-14 items-center justify-center rounded-[1.25rem] border border-[#cfdcf4] bg-white">
                    <SiteLoader size="sm" />
                  </div>
                ) : circles.length === 0 ? (
                  <div className="flex h-14 items-center rounded-[1.25rem] border border-[#cfdcf4] bg-white px-5 text-sm text-[#8b97aa]">لا توجد حلقات متاحة</div>
                ) : (
                  <Select dir="rtl" value={selectedCircle} onValueChange={handleCircleChange}>
                    <SelectTrigger className="h-14 rounded-[1.25rem] border-[#cfdcf4] bg-white px-5 text-right text-lg text-[#1a2332] focus:border-[#bfd0ea] [&>span]:w-full [&>span]:text-right">
                      <SelectValue placeholder="اختر الحلقة" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[1.25rem] border-[#d6e2f6] bg-white text-right">
                      {circles.map((circle) => (
                        <SelectItem key={circle.id} value={circle.name} className="justify-end pr-10 text-right text-base text-[#1a2332]">
                          {circle.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="mt-6 border-t border-[#dfe7f5]/70 pt-6">
                {!selectedCircle ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-[1.5rem] bg-[#fbfdff] px-6 text-center text-lg text-[#8b97aa]">اختر حلقة لعرض الطلاب</div>
                ) : isStudentsLoading ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-[1.5rem] bg-[#fbfdff]">
                    <SiteLoader size="md" />
                  </div>
                ) : students.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-[1.5rem] bg-[#fbfdff] px-6 text-center text-lg text-[#8b97aa]">لا يوجد طلاب في هذه الحلقة</div>
                ) : (
                  <div className="overflow-hidden rounded-[1.5rem] border border-[#e7eef9] bg-[#fbfdff]">
                    <div className="divide-y divide-[#e8eef8]">
                      {students.map((student) => (
                        <div key={student.id} className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d8e3f2] bg-[#edf4ff]">
                              <User className="h-5 w-5 text-[#3453a7]" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-black text-[#1a2332]">{student.name}</p>
                              <div className="flex flex-wrap gap-2">
                                {achievementsMap[student.id]?.length > 0 ? (
                                  achievementsMap[student.id].map((achievement) => (
                                    <div key={achievement.id} className="group/item flex items-center gap-1.5 rounded-full border border-[#d7e2f5] bg-white px-3 py-1.5">
                                      {renderIcon(achievement.icon_type)}
                                      <span className="text-sm text-[#42556f]">{achievement.title}</span>
                                      <button
                                        onClick={() => handleDelete(achievement.id, student.id)}
                                        className="mr-0.5 text-red-400 opacity-0 transition-all group-hover/item:opacity-100 hover:text-red-600"
                                        title="حذف"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-sm text-[#8b97aa]">لا توجد إنجازات</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedStudent(student)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#d8e5fb] bg-white px-5 text-sm font-bold text-[#3453a7] shadow-[0_10px_30px_rgba(52,83,167,0.08)] transition-all hover:bg-[#f6f9ff]"
                          >
                            <Plus className="h-4 w-4" />
                            إضافة إنجاز
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
              <div className="rounded-[1.9rem] border border-[#edf2fb] bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:px-7 md:py-7">
                <div className="space-y-3">
                  <Label className="text-lg font-semibold text-[#1a2332]">اختر الرمز</Label>
                  <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
                    {[
                      { type: "trophy", label: "كأس", Icon: Trophy },
                      { type: "medal", label: "ميدالية", Icon: Medal },
                      { type: "gem", label: "جوهرة", Icon: Gem },
                      { type: "star", label: "نجمة", Icon: Star },
                      { type: "flame", label: "شعلة", Icon: Flame },
                      { type: "zap", label: "برق", Icon: Zap },
                      { type: "crown", label: "تاج", Icon: Crown },
                      { type: "heart", label: "قلب", Icon: Heart },
                    ].map(({ type, label, Icon }) => (
                      <button
                        key={type}
                        onClick={() => setIcon(type)}
                        className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[1.25rem] border transition-all text-sm font-bold ${
                          icon === type
                            ? "border-[#bfd0ea] bg-[#edf4ff] text-[#3453a7] shadow-[0_10px_24px_rgba(52,83,167,0.08)]"
                            : "border-[#d8e3f2] bg-white text-[#7b879a] hover:border-[#bfd0ea] hover:bg-[#f8fbff]"
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-[#dfe7f5]/70 pt-6">
                  <Label className="text-lg font-semibold text-[#1a2332]">عنوان الإنجاز</Label>
                  <Input
                    value={achievementName}
                    onChange={(e) => setAchievementName(e.target.value)}
                    placeholder="مثال: حفظ جزء عم"
                    autoFocus
                    className="h-14 rounded-[1.25rem] border-[#d8e3f2] bg-white px-5 text-lg focus-visible:border-[#bfd0ea] focus-visible:ring-[#3453a7]/20"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-[#dfe7f5]/70 pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedStudent(null)}
                    className="h-11 rounded-[1.25rem] border-[#d8e3f2] px-5 text-base text-neutral-600"
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !achievementName}
                    className="h-11 rounded-[1.25rem] border-none bg-[#3453a7] px-6 text-base font-bold text-white hover:bg-[#24428f] disabled:cursor-not-allowed disabled:bg-[#dbe3f3] disabled:text-[#8a97b5] disabled:shadow-none disabled:hover:bg-[#dbe3f3] disabled:opacity-100"
                  >
                    {isSaving ? "جاري الحفظ..." : "حفظ الإنجاز"}
                  </Button>
                </div>
              </div>
            )}
        </div>
      </main>
      {displayMode === "inline" ? null : <Footer />}
    </div>
  );
}

export default StudentsAchievementsAdmin;
