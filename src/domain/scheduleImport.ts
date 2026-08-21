export interface ImportedScheduleItem {
  title: string;
  dueDate: string;
  estimatedMinutes: number;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function icsDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function parseScheduleImport(fileName: string, text: string): ImportedScheduleItem[] {
  if (fileName.toLowerCase().endsWith(".ics")) {
    const events = text.replace(/\r\n[ \t]/g, "").split("BEGIN:VEVENT").slice(1).map((block) => {
      const title = block.match(/^SUMMARY(?:;[^:]*)?:(.+)$/m)?.[1]?.trim();
      const dueDate = icsDate(block.match(/^DTSTART(?:;[^:]*)?:(.+)$/m)?.[1] ?? "");
      return title && dueDate ? { title, dueDate, estimatedMinutes: 60 } : null;
    }).filter((item): item is ImportedScheduleItem => item !== null);
    if (!events.length) throw new Error("未找到可导入的 iCalendar 课程条目");
    return events;
  }
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (rows.length < 2) throw new Error("CSV 需要标题行和至少一条课程记录");
  const headers = rows[0].split(",").map((value) => value.trim().toLowerCase());
  const titleIndex = headers.findIndex((value) => ["title", "name", "课程", "名称"].includes(value));
  const dateIndex = headers.findIndex((value) => ["date", "due_date", "日期"].includes(value));
  const minutesIndex = headers.findIndex((value) => ["minutes", "duration", "时长", "分钟"].includes(value));
  if (titleIndex < 0 || dateIndex < 0) throw new Error("CSV 必须包含 title/name 和 date/due_date 两列");
  const items = rows.slice(1).map((line, index) => {
    const fields = line.split(",").map((value) => value.trim());
    const title = fields[titleIndex]; const dueDate = fields[dateIndex];
    const estimatedMinutes = minutesIndex < 0 ? 60 : Number(fields[minutesIndex]);
    if (!title || !datePattern.test(dueDate) || !Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 1440) {
      throw new Error(`CSV 第 ${index + 2} 行无效`);
    }
    return { title, dueDate, estimatedMinutes };
  });
  if (!items.length) throw new Error("未找到可导入的 CSV 课程条目");
  return items;
}

export function suggestActionDates(startDate: string, endDate: string, actionCount: number): string[] {
  if (!datePattern.test(startDate) || !datePattern.test(endDate) || startDate > endDate || actionCount < 1) return [];
  const dates: string[] = [];
  for (let cursor = new Date(`${startDate}T12:00:00`); toDate(cursor) <= endDate; cursor.setDate(cursor.getDate() + 1)) dates.push(toDate(cursor));
  return Array.from({ length: actionCount }, (_, index) => dates[Math.min(dates.length - 1, Math.floor(index * dates.length / actionCount))]);
}

function toDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
