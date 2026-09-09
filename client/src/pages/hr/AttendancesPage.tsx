/**
 * RH — présences / pointages (super_admin)
 * Liste des employés actifs pour une date + bouton marquer présent si absent/retard.
 */

import { useMemo, useState } from "react";
import {
  useCreateManualAttendance,
  useHrAttendances,
  useHrEmployees,
} from "@/hooks/useHr";
import {
  attendanceStatusClassName,
  attendanceStatusLabel,
  buildDayAttendanceRows,
  canMarkPresentManually,
  formatCheckInTime,
  isManualAttendance,
  todayDateStringDouala,
} from "@/pages/hr/hrUi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarCheck, UserCheck } from "lucide-react";

export default function AttendancesPage() {
  const [date, setDate] = useState(todayDateStringDouala);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const { data: employees = [], isLoading: loadingEmployees } = useHrEmployees();
  const filters = useMemo(() => ({ date }), [date]);
  const { data: attendances = [], isLoading: loadingAttendances } =
    useHrAttendances(filters);
  const createManual = useCreateManualAttendance();

  const rows = useMemo(
    () => buildDayAttendanceRows(employees, attendances),
    [employees, attendances]
  );

  const isLoading = loadingEmployees || loadingAttendances;

  async function markPresent(employeeId: number) {
    setPendingId(employeeId);
    try {
      await createManual.mutateAsync({
        employee_id: employeeId,
        date,
        status: "present",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Présences</h1>
            <p className="text-muted-foreground">
              Pointages du jour — marquez présent si besoin (absent ou en
              retard)
            </p>
          </div>
        </div>
        <div className="space-y-1 w-full sm:w-auto">
          <Label htmlFor="attendance-date" className="sr-only">
            Date
          </Label>
          <Input
            id="attendance-date"
            type="date"
            className="w-full sm:w-[180px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className="stat-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Employé</TableHead>
                <TableHead>Poste</TableHead>
                <TableHead>Heure</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right w-[72px]">Actions</TableHead>
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
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Aucun employé actif.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const showMark = canMarkPresentManually(row.status);
                  const manual = isManualAttendance(row);
                  const busy = pendingId === row.employee_id;
                  return (
                    <TableRow
                      key={row.employee_id}
                      className="hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">
                        {row.full_name}
                      </TableCell>
                      <TableCell>{row.poste ?? "—"}</TableCell>
                      <TableCell>
                        {formatCheckInTime(row.check_in_time)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={attendanceStatusClassName(row.status)}
                        >
                          {attendanceStatusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.status === "absent" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : manual ? (
                          <Badge variant="secondary">Manuel</Badge>
                        ) : (
                          <Badge variant="outline">App</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {showMark ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Marquer présent"
                            aria-label={`Marquer ${row.full_name} présent`}
                            disabled={busy || createManual.isPending}
                            onClick={() => void markPresent(row.employee_id)}
                          >
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        ) : null}
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
