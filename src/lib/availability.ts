import { addMinutes, addDays, format, isAfter, isBefore, isSameDay, parse, parseISO } from "date-fns";
import type { Appointment, BlockedSlot, BusinessSettings, Service, WeekdayKey } from "@/types";

export const weekdayOrder: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTimeLabel(value: string): string {
  return value.length === 5 ? value : `${value}:00`;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function getWeekdayKey(date: Date): WeekdayKey {
  const map: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[date.getDay()] as WeekdayKey;
}

export function isPastDate(dateValue: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = parseISO(dateValue);
  return isBefore(date, today);
}

export function isBusinessDay(settings: BusinessSettings, date: Date): boolean {
  const key = getWeekdayKey(date);
  return !settings.workingHours[key].closed;
}

export type TimeSlotOption = {
  label: string;
  startTime: string;
  available: boolean;
};

export function getTimeSlotOptions(
  dateValue: string,
  service: Service,
  appointments: Appointment[],
  settings: BusinessSettings,
  blockedSlots: BlockedSlot[],
): TimeSlotOption[] {
  if (!dateValue || !service) {
    return [];
  }

  const day = parseISO(dateValue);
  const key = getWeekdayKey(day);
  const schedule = settings.workingHours[key];

  if (!schedule || schedule.closed || isPastDate(dateValue)) {
    return [];
  }

  const startMinutes = toMinutes(schedule.opens);
  const endMinutes = toMinutes(schedule.closes);
  const lunchStart = toMinutes(settings.lunchBreak.start);
  const lunchEnd = toMinutes(settings.lunchBreak.end);
  const serviceDuration = service.durationMinutes;

  const slots: TimeSlotOption[] = [];
  const step = 15;
  const now = new Date();
  const isToday = dateValue === format(now, "yyyy-MM-dd");
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  for (let start = startMinutes; start + serviceDuration <= endMinutes; start += step) {
    if (start < lunchEnd && start + serviceDuration > lunchStart) {
      continue;
    }

    const slotStart = format(new Date(2024, 0, 1, Math.floor(start / 60), start % 60), "HH:mm");
    const slotEndMinutes = start + serviceDuration;
    const slotEnd = format(new Date(2024, 0, 1, Math.floor(slotEndMinutes / 60), slotEndMinutes % 60), "HH:mm");

    const slotStartInMinutes = start;
    const slotEndInMinutes = slotEndMinutes;
    const isInPastToday = isToday && start <= currentTimeMinutes;

    const isBlockedByAppointment = appointments.some((appointment) => {
      if (appointment.date !== dateValue || appointment.status === "cancelled") {
        return false;
      }

      const appointmentStart = toMinutes(appointment.startTime);
      const appointmentEnd = toMinutes(appointment.endTime);
      return slotStartInMinutes < appointmentEnd && slotEndInMinutes > appointmentStart;
    });

    const isBlockedByManualSlot = blockedSlots.some((slot) => {
      if (!slot.active || slot.kind !== "range" || slot.date !== dateValue) {
        return false;
      }

      const blockedStart = slot.startTime ? toMinutes(slot.startTime) : 0;
      const blockedEnd = slot.endTime ? toMinutes(slot.endTime) : 0;
      return slotStartInMinutes < blockedEnd && slotEndInMinutes > blockedStart;
    });

    const manuallyBlockedDay = blockedSlots.some((slot) => {
      if (!slot.active || slot.kind !== "day" || slot.date !== dateValue) {
        return false;
      }
      return true;
    });

    slots.push({
      label: `${slotStart} - ${slotEnd}`,
      startTime: slotStart,
      available: !isInPastToday && !isBlockedByAppointment && !isBlockedByManualSlot && !manuallyBlockedDay,
    });
  }

  return slots;
}

export function getAvailableTimeSlots(
  dateValue: string,
  service: Service,
  appointments: Appointment[],
  settings: BusinessSettings,
  blockedSlots: BlockedSlot[],
): string[] {
  return getTimeSlotOptions(dateValue, service, appointments, settings, blockedSlots)
    .filter((slot) => slot.available)
    .map((slot) => slot.label);
}

export function generateAppointmentId(): string {
  return `NOIR-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

export function normalizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  return digits;
}

export function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

export function isValidBrazilianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

export function getStatusLabel(status: Appointment["status"]): string {
  const labels: Record<Appointment["status"], string> = {
    scheduled: "Agendamento criado",
    in_progress: "Em atendimento",
    completed: "Agendamento finalizado",
    cancelled: "Agendamento cancelado",
  };
  return labels[status];
}

export function formatDateForDisplay(value: string): string {
  return format(parseISO(value), "dd/MM/yyyy");
}

export function getBookingStartAndEnd(dateValue: string, startTime: string, durationMinutes: number): { start: string; end: string } {
  const baseDate = parseISO(dateValue);
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const startDate = new Date(baseDate);
  startDate.setHours(startHours, startMinutes, 0, 0);
  const endDate = addMinutes(startDate, durationMinutes);

  return {
    start: format(startDate, "HH:mm"),
    end: format(endDate, "HH:mm"),
  };
}

export function getServiceById(services: Service[], id: string | undefined): Service | undefined {
  return services.find((service) => service.id === id);
}

export function isDateSelectable(dateValue: string, settings: BusinessSettings): boolean {
  const date = parseISO(dateValue);
  if (isBefore(date, new Date(new Date().setHours(0, 0, 0, 0)))) {
    return false;
  }

  const maxDate = addDays(new Date(), settings.maxFutureDays);
  if (isAfter(date, maxDate)) {
    return false;
  }

  const key = getWeekdayKey(date);
  return !settings.workingHours[key].closed;
}
