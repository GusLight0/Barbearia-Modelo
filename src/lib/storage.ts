import type {
  AdminSession,
  AppStorageState,
  Appointment,
  BlockedSlot,
  BusinessSettings,
  Service,
} from "@/types";

export const STORAGE_KEYS = {
  services: "noir_services_v1",
  appointments: "noir_appointments_v1",
  settings: "noir_settings_v1",
  blockedSlots: "noir_blocked_slots_v1",
  adminSession: "noir_admin_session_v1",
  unreadAppointments: "noir_unread_appointments_v1",
};

export const defaultServices: Service[] = [
  {
    id: "service-corte",
    name: "Corte",
    description: "Corte personalizado com acabamento preciso.",
    price: 35,
    durationMinutes: 30,
    active: true,
  },
  {
    id: "service-barba",
    name: "Barba",
    description: "Modelagem e acabamento cuidadoso para sua barba.",
    price: 25,
    durationMinutes: 25,
    active: true,
  },
  {
    id: "service-corte-barba",
    name: "Corte + barba",
    description: "Atendimento completo para um visual impecável em uma sessão única.",
    price: 50,
    durationMinutes: 50,
    active: true,
  },
  {
    id: "service-selagem",
    name: "Selagem",
    description: "Tratamento para alinhar e reduzir o volume dos fios.",
    price: 80,
    durationMinutes: 60,
    active: true,
  },
];

function normalizeServices(services: Service[]): Service[] {
  const legacyIds: Record<string, string> = {
    "service-tradicional": "service-corte",
  };
  const savedById = new Map(
    services.map((service) => [legacyIds[service.id] ?? service.id, service]),
  );

  return defaultServices.map((defaultService) => {
    const savedService = savedById.get(defaultService.id);
    return {
      ...defaultService,
      ...(savedService ?? {}),
      id: defaultService.id,
      name: defaultService.name,
      description: defaultService.description,
    };
  });
}

export const defaultSettings: BusinessSettings = {
  businessName: "NOIR BARBER STUDIO",
  tagline: "Seu estilo. Sua assinatura.",
  description: "Precisão em cada detalhe. Experiência em cada corte.",
  workingHours: {
    mon: { opens: "09:00", closes: "19:00", closed: false },
    tue: { opens: "09:00", closes: "19:00", closed: false },
    wed: { opens: "09:00", closes: "19:00", closed: false },
    thu: { opens: "09:00", closes: "19:00", closed: false },
    fri: { opens: "09:00", closes: "19:00", closed: false },
    sat: { opens: "09:00", closes: "17:00", closed: false },
    sun: { opens: "00:00", closes: "00:00", closed: true },
  },
  lunchBreak: { start: "12:30", end: "13:30" },
  maxFutureDays: 1826,
};

export const defaultAdminSession: AdminSession = {
  authenticated: false,
  username: "",
  loggedAt: null,
};

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as T;
    if (!parsed) {
      return fallback;
    }

    return parsed;
  } catch {
    return fallback;
  }
}

export function writeStorageJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Storage write failed:", error);
  }
}

function readSessionStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as T;
    return parsed || fallback;
  } catch {
    return fallback;
  }
}

function writeSessionStorageJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Session storage write failed:", error);
  }
}

export function getStorageState(): AppStorageState {
  const storedServices = readStorageJson<Service[]>(STORAGE_KEYS.services, defaultServices);
  const services = Array.isArray(storedServices) ? normalizeServices(storedServices) : clone(defaultServices);
  const appointments = readStorageJson<Appointment[]>(STORAGE_KEYS.appointments, []);
  const settings = readStorageJson<BusinessSettings>(STORAGE_KEYS.settings, defaultSettings);
  const blockedSlots = readStorageJson<BlockedSlot[]>(STORAGE_KEYS.blockedSlots, []);
  const adminSession = readSessionStorageJson<AdminSession>(STORAGE_KEYS.adminSession, defaultAdminSession);

  return {
    services,
    appointments: Array.isArray(appointments) ? appointments : [],
    settings: settings && settings.businessName ? settings : clone(defaultSettings),
    blockedSlots: Array.isArray(blockedSlots) ? blockedSlots : [],
    adminSession:
      adminSession && typeof adminSession.authenticated === "boolean"
        ? adminSession
        : clone(defaultAdminSession),
  };
}

export function saveStorageState(state: AppStorageState): void {
  writeStorageJson(STORAGE_KEYS.services, state.services);
  writeStorageJson(STORAGE_KEYS.appointments, state.appointments);
  writeStorageJson(STORAGE_KEYS.settings, state.settings);
  writeStorageJson(STORAGE_KEYS.blockedSlots, state.blockedSlots);
  writeSessionStorageJson(STORAGE_KEYS.adminSession, state.adminSession);
}

export function ensureDefaults(): AppStorageState {
  const current = getStorageState();
  const maxFutureDays = current.settings.maxFutureDays === 60
    ? defaultSettings.maxFutureDays
    : current.settings.maxFutureDays;

  const next: AppStorageState = {
    services: current.services.length ? current.services : clone(defaultServices),
    appointments: current.appointments,
    settings: current.settings.businessName
      ? { ...current.settings, maxFutureDays }
      : clone(defaultSettings),
    blockedSlots: current.blockedSlots,
    adminSession: current.adminSession,
  };

  saveStorageState(next);
  return next;
}
