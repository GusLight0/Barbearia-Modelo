export type AppointmentStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type Service = {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  active: boolean;
};

export type Appointment = {
  id: string;
  serviceId: string;
  serviceName: string;
  price: number;
  durationMinutes: number;
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
};

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WorkingHours = {
  opens: string;
  closes: string;
  closed: boolean;
};

export type BusinessSettings = {
  businessName: string;
  tagline: string;
  description: string;
  workingHours: Record<WeekdayKey, WorkingHours>;
  lunchBreak: { start: string; end: string };
  maxFutureDays: number;
};

export type BlockedSlot = {
  id: string;
  kind: "day" | "range";
  date?: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  active: boolean;
  createdAt: string;
};

export type AdminSession = {
  authenticated: boolean;
  username: string;
  loggedAt: string | null;
};

export type AppStorageState = {
  services: Service[];
  appointments: Appointment[];
  settings: BusinessSettings;
  blockedSlots: BlockedSlot[];
  adminSession: AdminSession;
};
