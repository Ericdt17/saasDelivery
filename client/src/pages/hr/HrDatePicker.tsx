/**
 * Day selector for HR pages (Popover + Calendar).
 */

import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type HrDatePickerProps = {
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  id?: string;
  className?: string;
};

function parseYmd(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return new Date(y, m - 1, d);
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDayLabelFr(value: string): string {
  const date = parseYmd(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function HrDatePicker({
  value,
  onChange,
  id,
  className,
}: HrDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseYmd(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal sm:w-[240px]",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="capitalize">{formatDayLabelFr(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(toYmd(d));
            setOpen(false);
          }}
          defaultMonth={selected}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
