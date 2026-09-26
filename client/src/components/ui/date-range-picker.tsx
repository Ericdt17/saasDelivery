/**
 * Date Range Picker — presets + custom calendars
 * Ported from parcoursAdmin for ops reports.
 */

import { useState, useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  type DateRangePreset,
  getDateRangeForPreset,
  getDefaultDateRange,
  getPresetLabel,
  formatDateLocal,
  parseLocalDate,
  isActiveDateRange,
  type DateRange,
} from "@/lib/date-utils";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  allowAllPeriod?: boolean;
  planning?: boolean;
}

export function DateRangePicker({
  value,
  onChange,
  className,
  allowAllPeriod = false,
  planning = false,
}: DateRangePickerProps) {
  const defaultRange = getDefaultDateRange();
  const [preset, setPreset] = useState<DateRangePreset>(
    allowAllPeriod && !isActiveDateRange(value) ? "allPeriod" : "today"
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    value.startDate
      ? parseLocalDate(value.startDate)
      : parseLocalDate(defaultRange.startDate)
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    value.endDate
      ? parseLocalDate(value.endDate)
      : parseLocalDate(defaultRange.endDate)
  );
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);

  useEffect(() => {
    if (preset !== "custom") {
      if (isStartOpen) setIsStartOpen(false);
      if (isEndOpen) setIsEndOpen(false);
    }
  }, [preset, isStartOpen, isEndOpen]);

  useEffect(() => {
    if (value.startDate) setStartDate(parseLocalDate(value.startDate));
    if (value.endDate) setEndDate(parseLocalDate(value.endDate));
  }, [value.startDate, value.endDate]);

  useEffect(() => {
    if (allowAllPeriod && !isActiveDateRange(value)) {
      setPreset("allPeriod");
      return;
    }

    const presets: DateRangePreset[] = [
      "today",
      ...(planning ? (["tomorrow"] as const) : []),
      "yesterday",
      "thisWeek",
      "lastWeek",
      "thisMonth",
      "lastMonth",
      "thisYear",
      "lastYear",
    ];

    for (const p of presets) {
      const presetRange = getDateRangeForPreset(p, planning);
      if (
        presetRange.startDate === value.startDate &&
        presetRange.endDate === value.endDate
      ) {
        setPreset(p);
        return;
      }
    }
    setPreset("custom");
  }, [value, allowAllPeriod, planning]);

  const handlePresetChange = (newPreset: DateRangePreset) => {
    if (newPreset !== "custom") {
      if (isStartOpen) setIsStartOpen(false);
      if (isEndOpen) setIsEndOpen(false);
    }
    setPreset(newPreset);
    if (newPreset === "allPeriod") {
      onChange({ startDate: "", endDate: "" });
      return;
    }
    if (newPreset !== "custom") {
      const range = getDateRangeForPreset(newPreset, planning);
      onChange(range);
      setStartDate(
        range.startDate ? parseLocalDate(range.startDate) : undefined
      );
      setEndDate(range.endDate ? parseLocalDate(range.endDate) : undefined);
    }
  };

  const handleStartDateChange = (date: Date | undefined) => {
    if (!date) return;
    setStartDate(date);
    setPreset("custom");
    const start = formatDateLocal(date);
    const end = endDate ? formatDateLocal(endDate) : start;
    onChange({ startDate: start, endDate: end });
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (!date) return;
    setEndDate(date);
    setPreset("custom");
    const end = formatDateLocal(date);
    const start = startDate ? formatDateLocal(startDate) : end;
    onChange({ startDate: start, endDate: end });
  };

  const presets: DateRangePreset[] = [
    ...(allowAllPeriod ? (["allPeriod"] as const) : []),
    "today",
    ...(planning ? (["tomorrow"] as const) : []),
    "yesterday",
    "thisWeek",
    "lastWeek",
    "thisMonth",
    "lastMonth",
    "thisYear",
    "lastYear",
    "custom",
  ];

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row gap-2 items-start",
        className
      )}
    >
      <Select
        value={preset}
        onValueChange={(v) => handlePresetChange(v as DateRangePreset)}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Période" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p} value={p}>
              {getPresetLabel(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div
        className={cn(
          "flex gap-2 transition-opacity",
          preset === "custom"
            ? "opacity-100"
            : "opacity-0 pointer-events-none w-0 overflow-hidden"
        )}
        aria-hidden={preset !== "custom"}
      >
        <Popover
          open={preset === "custom" && isStartOpen}
          onOpenChange={(open) => {
            if (preset === "custom") setIsStartOpen(open);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[200px] justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? (
                format(startDate, "PPP", { locale: fr })
              ) : (
                <span>Date début</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => {
                handleStartDateChange(date);
                setIsStartOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover
          open={preset === "custom" && isEndOpen}
          onOpenChange={(open) => {
            if (preset === "custom") setIsEndOpen(open);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[200px] justify-start text-left font-normal",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? (
                format(endDate, "PPP", { locale: fr })
              ) : (
                <span>Date fin</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => {
                handleEndDateChange(date);
                setIsEndOpen(false);
              }}
              initialFocus
              disabled={(date) => {
                if (startDate) return date < startDate;
                return false;
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {preset !== "custom" &&
        preset !== "allPeriod" &&
        isActiveDateRange(value) && (
          <div className="flex items-center gap-2 text-sm text-foreground px-3 py-2 bg-muted rounded-md border min-w-[200px]">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">
              {value.startDate === value.endDate
                ? format(parseLocalDate(value.startDate), "PPP", {
                    locale: fr,
                  })
                : `${format(parseLocalDate(value.startDate), "PPP", {
                    locale: fr,
                  })} - ${format(parseLocalDate(value.endDate), "PPP", {
                    locale: fr,
                  })}`}
            </span>
          </div>
        )}
    </div>
  );
}
