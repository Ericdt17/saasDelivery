/**
 * RH — présences / pointages (super_admin)
 */

import { useMemo, useState } from "react";
import { useHrAttendances, useHrEmployees } from "@/hooks/useHr";
import {
  attendanceStatusClassName,
  attendanceStatusLabel,
  formatAttendanceDate,
  formatCheckInTime,
  type AttendanceStatus,
} from "@/pages/hr/hrUi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarCheck } from "lucide-react";

const MONTHS = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

const YEAR_OPTIONS = (() => {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1];
})();

export default function AttendancesPage() {
  const initial = currentMonthYear();
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [employeeId, setEmployeeId] = useState<string>("all");

  const { data: employees = [] } = useHrEmployees();

  const filters = useMemo(
    () => ({
      month,
      year,
      employee_id:
        employeeId === "all" ? undefined : Number(employeeId) || undefined,
    }),
    [month, year, employeeId]
  );

  const { data: attendances = [], isLoading } = useHrAttendances(filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarCheck className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Présences</h1>
          <p className="text-muted-foreground">
            Pointages journaliers — filtres par mois et employé
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select
          value={String(month)}
          onValueChange={(v) => setMonth(Number(v))}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Mois" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={String(m.value)}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-full sm:w-[120px]">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Employé" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les employés</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="stat-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Employé</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>GPS</TableHead>
                <TableHead>Face</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : attendances.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Aucun pointage pour cette période.
                  </TableCell>
                </TableRow>
              ) : (
                attendances.map((row) => {
                  const status = row.status as AttendanceStatus;
                  return (
                    <TableRow key={row.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {row.full_name}
                      </TableCell>
                      <TableCell>{formatAttendanceDate(row.date)}</TableCell>
                      <TableCell>
                        {formatCheckInTime(row.check_in_time)}
                      </TableCell>
                      <TableCell>
                        <Badge className={attendanceStatusClassName(status)}>
                          {attendanceStatusLabel(status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.gps_verified ? (
                          <Badge className="bg-green-600 hover:bg-green-600">
                            Oui
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Non</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.face_verified ? (
                          <Badge className="bg-green-600 hover:bg-green-600">
                            Oui
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Non</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
