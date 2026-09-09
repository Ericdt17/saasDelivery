/**
 * Month selector for HR stats pages (Popover + Calendar).
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
import { formatMonthLabelFr } from "@/pages/hr/hrUi";
import { cn } from "@/lib/utils";

type HrMonthPickerProps = {
  year: number;
  month: number;
  onChange: (next: { year: number; month: number }) => void;
  id?: string;
  className?: string;
};

export function HrMonthPicker({
  year,
  month,
  onChange,
  id,
  className,
}: HrMonthPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = new Date(year, month - 1, 1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal sm:w-[220px]",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="capitalize">{formatMonthLabelFr(year, month)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          month={selected}
          onMonthChange={(d) =>
            onChange({ year: d.getFullYear(), month: d.getMonth() + 1 })
          }
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange({ year: d.getFullYear(), month: d.getMonth() + 1 });
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
