"use client";

import Link from "next/link";
import Image from "next/image";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  defaultAdminSession,
  defaultServices,
  defaultSettings,
  ensureDefaults,
  getStorageState,
  readStorageJson,
  saveStorageState,
  STORAGE_KEYS,
  writeStorageJson,
} from "@/lib/storage";
import {
  formatMoney,
  formatPhoneDisplay,
  getAvailableTimeSlots,
  getBookingStartAndEnd,
  getServiceById,
  getStatusLabel,
  generateAppointmentId,
  getTimeSlotOptions,
  isDateSelectable,
  isPastDate,
  isValidBrazilianPhone,
  normalizePhone,
} from "@/lib/availability";
import type {
  AdminSession,
  Appointment,
  AppointmentStatus,
  BlockedSlot,
  BusinessSettings,
  Service,
  WeekdayKey,
} from "@/types";

const demoCredentials = {
  username: "barbeiro",
  password: "admin123",
};

type AppView = "home" | "appointments" | "admin" | "admin-login";

type BookingFormState = {
  serviceId: string;
  date: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  notes: string;
};

type BookingStep = "date" | "time" | "details" | "confirmed" | null;
type AdminSection = "agenda" | "management" | "settings" | "analytics";

export function BookingApp({ view }: { view?: AppView }) {
  const [services, setServices] = useState<Service[]>(defaultServices);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(defaultSettings);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [adminSession, setAdminSession] = useState<AdminSession>(defaultAdminSession);
  const [toast, setToast] = useState<string | null>(null);
  const [unreadAppointments, setUnreadAppointments] = useState(0);

  const [bookingForm, setBookingForm] = useState<BookingFormState>({
    serviceId: "",
    date: "",
    startTime: "",
    customerName: "",
    customerPhone: "",
    notes: "",
  });
  const [validationError, setValidationError] = useState<string | "">("");
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);
  const [selectedAdminDate, setSelectedAdminDate] = useState("");
  const [todayKey, setTodayKey] = useState("");
  const [calendarMonth, setCalendarMonth] = useState<Date | null>(null);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminFilterStatus, setAdminFilterStatus] = useState<"all" | AppointmentStatus>("all");
  const [adminLogin, setAdminLogin] = useState({ username: "", password: "" });
  const [adminSettings, setAdminSettings] = useState<BusinessSettings>(defaultSettings);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [bookingStep, setBookingStep] = useState<BookingStep>(null);
  const [isNavigationDrawerOpen, setIsNavigationDrawerOpen] = useState(false);
  const [isContactOptionsOpen, setIsContactOptionsOpen] = useState(false);
  const [adminSection, setAdminSection] = useState<AdminSection>("agenda");

  useEffect(() => {
    const stored = ensureDefaults();
    const today = format(new Date(), "yyyy-MM-dd");
    setServices(stored.services);
    setAppointments(stored.appointments);
    setSettings(stored.settings);
    setBlockedSlots(stored.blockedSlots);
    setAdminSession(stored.adminSession);
    setAdminSettings(stored.settings);
    setUnreadAppointments(readStorageJson<number>(STORAGE_KEYS.unreadAppointments, 0));
    setSelectedAdminDate(today);
    setTodayKey(today);
    setCalendarMonth(new Date());
  }, []);

  useEffect(() => {
    if (!bookingStep) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [bookingStep]);

  useEffect(() => {
    const handleStorage = () => {
      const fresh = getStorageState();
      setServices(fresh.services);
      setAppointments(fresh.appointments);
      setSettings(fresh.settings);
      setBlockedSlots(fresh.blockedSlots);
      setAdminSession(fresh.adminSession);
      setAdminSettings(fresh.settings);
      setUnreadAppointments(readStorageJson<number>(STORAGE_KEYS.unreadAppointments, 0));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (view === "appointments") {
      writeStorageJson(STORAGE_KEYS.unreadAppointments, 0);
    }
  }, [view]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedService = useMemo(
    () => getServiceById(services, bookingForm.serviceId || selectedServiceId),
    [bookingForm.serviceId, selectedServiceId, services],
  );

  const availableSlots = useMemo(() => {
    if (!bookingForm.date || !selectedService) {
      return [];
    }
    return getAvailableTimeSlots(bookingForm.date, selectedService, appointments, settings, blockedSlots);
  }, [bookingForm.date, selectedService, appointments, settings, blockedSlots]);

  const timeSlotOptions = useMemo(() => {
    if (!bookingForm.date || !selectedService) {
      return [];
    }
    return getTimeSlotOptions(bookingForm.date, selectedService, appointments, settings, blockedSlots);
  }, [bookingForm.date, selectedService, appointments, settings, blockedSlots]);

  const todayAppointments = useMemo(
    () =>
      appointments.filter(
        (item) => item.date === todayKey && item.status !== "cancelled",
      ),
    [appointments, todayKey],
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments.filter((item) => {
        if (item.status === "cancelled" || !todayKey) {
          return false;
        }

        return item.date >= todayKey && item.date <= format(addDays(new Date(), 7), "yyyy-MM-dd");
      }),
    [appointments, todayKey],
  );

  const adminFilteredAppointments = useMemo(() => {
    const term = adminSearch.trim().toLowerCase();
    return appointments.filter((appointment) => {
      const passDate = !selectedAdminDate || appointment.date === selectedAdminDate;
      const passStatus = adminFilterStatus === "all" || appointment.status === adminFilterStatus;
      const searchable = `${appointment.customerName} ${appointment.customerPhone}`.toLowerCase();
      const passSearch = !term || searchable.includes(term);
      return passDate && passStatus && passSearch;
    });
  }, [adminFilterStatus, adminSearch, appointments, selectedAdminDate]);

  const persistState = (next: Partial<{ services: Service[]; appointments: Appointment[]; settings: BusinessSettings; blockedSlots: BlockedSlot[]; adminSession: AdminSession }>) => {
    const state = {
      services,
      appointments,
      settings,
      blockedSlots,
      adminSession,
      ...next,
    };

    if (next.services) setServices(next.services);
    if (next.appointments) setAppointments(next.appointments);
    if (next.settings) setSettings(next.settings);
    if (next.blockedSlots) setBlockedSlots(next.blockedSlots);
    if (next.adminSession) setAdminSession(next.adminSession);

    saveStorageState({
      services: next.services ?? state.services,
      appointments: next.appointments ?? state.appointments,
      settings: next.settings ?? state.settings,
      blockedSlots: next.blockedSlots ?? state.blockedSlots,
      adminSession: next.adminSession ?? state.adminSession,
    });
  };

  const showToast = (message: string) => setToast(message);

  const resetBookingForm = () => {
    setBookingForm({
      serviceId: "",
      date: "",
      startTime: "",
      customerName: "",
      customerPhone: "",
      notes: "",
    });
    setSelectedServiceId("");
    setValidationError("");
    setCreatedAppointment(null);
    setBookingStep(null);
  };

  const handleBookingSubmit = () => {
    const service = selectedService ?? getServiceById(services, bookingForm.serviceId);
    if (!service) {
      setValidationError("Selecione um serviço antes de avançar.");
      return;
    }

    const value = bookingForm.customerName.trim();
    const phoneDigits = normalizePhone(bookingForm.customerPhone);
    if (!bookingForm.date) {
      setValidationError("Escolha uma data disponível.");
      return;
    }

    if (isPastDate(bookingForm.date)) {
      setValidationError("Não é possível agendar em uma data passada.");
      return;
    }

    if (!bookingForm.startTime) {
      setValidationError("Selecione um horário disponível.");
      return;
    }

    if (!value || value.length < 2) {
      setValidationError("Informe o nome completo do cliente.");
      return;
    }

    if (!isValidBrazilianPhone(phoneDigits)) {
      setValidationError("Informe um telefone brasileiro válido.");
      return;
    }

    const hasSlot = getAvailableTimeSlots(bookingForm.date, service, appointments, settings, blockedSlots)
      .some((slot) => slot.startsWith(`${bookingForm.startTime} -`));
    if (!hasSlot) {
      setValidationError("Esse horário foi ocupado ou bloqueado. Escolha outro.");
      return;
    }

    const id = generateAppointmentId();
    const { end: endTime } = getBookingStartAndEnd(bookingForm.date, bookingForm.startTime, service.durationMinutes);
    const newAppointment: Appointment = {
      id,
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      durationMinutes: service.durationMinutes,
      date: bookingForm.date,
      startTime: bookingForm.startTime,
      endTime,
      customerName: value,
      customerPhone: phoneDigits,
      notes: bookingForm.notes.trim(),
      status: "scheduled",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextAppointments = [...appointments, newAppointment];
    persistState({ appointments: nextAppointments });
    const previousUnreadAppointments = Number(readStorageJson<number>(STORAGE_KEYS.unreadAppointments, 0)) || 0;
    const nextUnreadAppointments = Math.max(0, previousUnreadAppointments) + 1;
    writeStorageJson(STORAGE_KEYS.unreadAppointments, nextUnreadAppointments);
    setUnreadAppointments(nextUnreadAppointments);
    setCreatedAppointment(newAppointment);
    setValidationError("");
    setBookingStep("confirmed");
    showToast("Agendamento Criado");
  };

  const startBooking = (serviceId: string) => {
    const today = new Date();
    setSelectedServiceId(serviceId);
    setBookingForm({
      serviceId,
      date: "",
      startTime: "",
      customerName: "",
      customerPhone: "",
      notes: "",
    });
    setCalendarMonth(startOfMonth(today));
    setCreatedAppointment(null);
    setValidationError("");
    setBookingStep("date");
  };

  const handleAdminLogin = () => {
    if (
      adminLogin.username === demoCredentials.username &&
      adminLogin.password === demoCredentials.password
    ) {
      const session: AdminSession = {
        authenticated: true,
        username: adminLogin.username,
        loggedAt: new Date().toISOString(),
      };
      persistState({ adminSession: session });
      if (typeof window !== "undefined") {
        window.location.assign("/admin");
      }
      return;
    }

    showToast("Credenciais inválidas. Use a demonstração do barbeiro.");
  };

  const handleAdminLogout = () => {
    persistState({ adminSession: { ...defaultAdminSession } });
    if (typeof window !== "undefined") {
      window.location.assign("/login-admin");
    }
  };

  const updateAppointmentStatus = (id: string, status: AppointmentStatus) => {
    const nextAppointments: Appointment[] = appointments.map((appointment) => {
      if (appointment.id !== id) {
        return appointment;
      }

      return { ...appointment, status, updatedAt: new Date().toISOString() };
    });

    persistState({ appointments: nextAppointments });
    showToast("Status atualizado.");
  };

  const cancelAppointment = (id: string) => {
    const match = appointments.find((appointment) => appointment.id === id);
    if (!match || match.status === "cancelled") {
      return;
    }

    const nextAppointments: Appointment[] = appointments.map((appointment) =>
      appointment.id === id
        ? { ...appointment, status: "cancelled" as AppointmentStatus, updatedAt: new Date().toISOString() }
        : appointment,
    );

    persistState({ appointments: nextAppointments });
    showToast("Agendamento cancelado e horário liberado.");
  };

  const saveSettings = () => {
    persistState({ settings: adminSettings });
    showToast("Configurações atualizadas.");
  };

  const handleSaveService = (service: Service) => {
    const nextServices = services.map((item) => (item.id === service.id ? service : item));
    persistState({ services: nextServices });
    showToast("Serviço atualizado.");
  };

  const businessDateButtons = useMemo(() => {
    if (!calendarMonth) {
      return [] as Date[];
    }

    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [calendarMonth]);

  const calendarLeadingDays = calendarMonth ? getDay(startOfMonth(calendarMonth)) : 0;
  const calendarMonths = useMemo(() => {
    if (!todayKey) {
      return [];
    }
    const today = parseISO(todayKey);
    const lastBookableDay = addDays(today, Math.max(0, settings.maxFutureDays));
    return eachMonthOfInterval({ start: today, end: startOfMonth(lastBookableDay) });
  }, [settings.maxFutureDays, todayKey]);
  const firstCalendarMonth = calendarMonths[0];
  const lastCalendarMonth = calendarMonths[calendarMonths.length - 1];
  const calendarYears = [...new Set(calendarMonths.map((month) => format(month, "yyyy")))];
  const calendarMonthsForYear = calendarMonths.filter(
    (month) => format(month, "yyyy") === (calendarMonth ? format(calendarMonth, "yyyy") : ""),
  );
  const visibleUnreadAppointments = view === "appointments" ? 0 : unreadAppointments;
  const serviceImages: Record<string, string> = {
    "service-corte": "/img/foto-cabelo.png",
    "service-barba": "/img/foto-barba.png",
    "service-corte-barba": "/img/foto-cabelo-barba.png",
    "service-selagem": "/img/foto-selagem.png",
  };
  const desktopContentOffset = isNavigationDrawerOpen ? "md:ml-[264px]" : "md:ml-[76px]";
  const whatsappNumber = "5511999999999";
  const whatsappInquiryUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Olá! Tenho uma dúvida sobre os serviços e horários da NOIR Barber Studio.")}`;
  const whatsappConversationUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Olá! Gostaria de conversar diretamente com a equipe da NOIR Barber Studio.")}`;

  const clearUnreadAppointments = () => {
    setUnreadAppointments(0);
    writeStorageJson(STORAGE_KEYS.unreadAppointments, 0);
  };

  const openContactOptions = () => setIsContactOptionsOpen(true);
  const closeContactOptions = () => setIsContactOptionsOpen(false);

  const renderHeader = () => (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0B0C]/80 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6">
          <Link href="/" aria-label="NOIR Barber Studio - início" className="flex items-center">
            <span className="relative inline-flex h-12 w-12 overflow-hidden rounded-full border border-[#C6A56B]/60 bg-[#141416] sm:h-14 sm:w-14">
              <Image src="/img/logo-barbearia.jpg" alt="Logo da barbearia" fill sizes="56px" className="object-cover" />
            </span>
          </Link>
        </div>
      </header>

      <aside
        aria-label="Menu lateral de navegação"
        className={`fixed inset-y-0 left-0 z-[70] hidden flex-col border-r border-white/10 bg-[#111113] px-3 py-5 transition-[width] duration-300 md:flex ${isNavigationDrawerOpen ? "w-[264px]" : "w-[76px]"}`}
      >
        <div className="flex flex-col items-center border-b border-white/10 pb-4">
          <div className={`flex min-h-11 w-full items-center ${isNavigationDrawerOpen ? "gap-3" : "justify-center"}`}>
            <Link href="/" aria-label="NOIR Barber Studio - início" className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#C6A56B]/60 bg-[#141416]">
              <Image src="/img/logo-barbearia.jpg" alt="" fill sizes="44px" className="object-cover" />
            </Link>
            {isNavigationDrawerOpen && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-[#C6A56B]">NOIR Barber Studio</p>
                <p className="mt-1 text-xs text-[#A5A5AA]">Navegação</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsNavigationDrawerOpen((open) => !open)}
            aria-label={isNavigationDrawerOpen ? "Recolher menu lateral" : "Expandir menu lateral"}
            aria-expanded={isNavigationDrawerOpen}
            className={`mt-3 flex h-10 items-center rounded-xl text-[#A5A5AA] transition hover:bg-white/5 hover:text-[#C6A56B] ${isNavigationDrawerOpen ? "w-full justify-start gap-4 px-3" : "w-10 justify-center"}`}
          >
            {isNavigationDrawerOpen ? <PanelLeftClose className="h-5 w-5 shrink-0" /> : <PanelLeftOpen className="h-5 w-5" />}
            {isNavigationDrawerOpen && <span className="text-sm font-semibold">Recolher menu</span>}
          </button>
        </div>

        <nav aria-label="Navegação" className="mt-5 flex flex-1 flex-col gap-2">
          {view === "admin" ? (
            [
              { id: "agenda" as const, label: "Agenda diária", icon: CalendarDays },
              { id: "management" as const, label: "Gerenciamento", icon: ClipboardList },
              { id: "settings" as const, label: "Configurações", icon: Building2 },
              { id: "analytics" as const, label: "Gráficos", icon: ChartNoAxesCombined },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAdminSection(id)}
                aria-current={adminSection === id ? "page" : undefined}
                title={isNavigationDrawerOpen ? undefined : label}
                className={`flex min-h-12 items-center rounded-xl text-left text-sm font-semibold transition ${isNavigationDrawerOpen ? "gap-4 px-3" : "justify-center px-0"} ${adminSection === id ? "bg-[#C6A56B]/15 text-[#C6A56B]" : "text-[#A5A5AA] hover:bg-white/5 hover:text-[#F5F3EF]"}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isNavigationDrawerOpen && <span>{label}</span>}
              </button>
            ))
          ) : (
            <>
              <Link
                href="/"
                aria-current={view === "home" ? "page" : undefined}
                title={isNavigationDrawerOpen ? undefined : "Agendar"}
                className={`flex min-h-12 items-center rounded-xl text-sm font-semibold transition ${isNavigationDrawerOpen ? "gap-4 px-3" : "justify-center px-0"} ${view === "home" ? "bg-[#C6A56B]/15 text-[#C6A56B]" : "text-[#A5A5AA] hover:bg-white/5 hover:text-[#F5F3EF]"}`}
              >
                <CalendarDays className="h-5 w-5 shrink-0" />
                {isNavigationDrawerOpen && <span>Agendar</span>}
              </Link>
              <Link
                href="/agendamentos"
                onClick={clearUnreadAppointments}
                aria-current={view === "appointments" ? "page" : undefined}
                title={isNavigationDrawerOpen ? undefined : "Agendamentos"}
                className={`relative flex min-h-12 items-center rounded-xl text-sm font-semibold transition ${isNavigationDrawerOpen ? "gap-4 px-3" : "justify-center px-0"} ${view === "appointments" ? "bg-[#C6A56B]/15 text-[#C6A56B]" : "text-[#A5A5AA] hover:bg-white/5 hover:text-[#F5F3EF]"}`}
              >
                <ClipboardList className="h-5 w-5 shrink-0" />
                {isNavigationDrawerOpen && <span>Agendamentos</span>}
                {visibleUnreadAppointments > 0 && <span className={`rounded-full bg-[#C6A56B] px-1.5 text-[9px] font-bold leading-4 text-[#0B0B0C] ${isNavigationDrawerOpen ? "ml-auto" : "absolute right-1 top-1"}`}>+{visibleUnreadAppointments}</span>}
              </Link>
              <button
                type="button"
                onClick={openContactOptions}
                title={isNavigationDrawerOpen ? undefined : "Contato"}
                className={`flex min-h-12 items-center rounded-xl text-sm font-semibold text-[#A5A5AA] transition hover:bg-white/5 hover:text-[#F5F3EF] ${isNavigationDrawerOpen ? "gap-4 px-3" : "justify-center px-0"}`}
              >
                <Phone className="h-5 w-5 shrink-0" />
                {isNavigationDrawerOpen && <span>Contato</span>}
              </button>
            </>
          )}
        </nav>

      </aside>

      {(view === "home" || view === "appointments" || view === "admin") && (
        <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-[#0B0B0C]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
          {view === "admin" ? (
            <div className="mx-auto grid max-w-2xl grid-cols-4 px-1 py-2">
              {[
                { id: "agenda" as const, label: "Agenda", icon: CalendarDays },
                { id: "management" as const, label: "Gerenciar", icon: ClipboardList },
                { id: "settings" as const, label: "Ajustes", icon: Building2 },
                { id: "analytics" as const, label: "Gráficos", icon: ChartNoAxesCombined },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAdminSection(id)}
                  aria-current={adminSection === id ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition ${adminSection === id ? "text-[#C6A56B]" : "text-[#A5A5AA] hover:text-[#F5F3EF]"}`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : (
          <div className="mx-auto grid max-w-lg grid-cols-3 px-2 py-2">
            <Link
              href="/"
              aria-current={view === "home" ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition ${view === "home" ? "text-[#C6A56B]" : "text-[#A5A5AA] hover:text-[#F5F3EF]"}`}
            >
              <CalendarDays className="h-5 w-5" />
              <span>Agendar</span>
            </Link>
            <Link
              href="/agendamentos"
              onClick={clearUnreadAppointments}
              aria-current={view === "appointments" ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition ${view === "appointments" ? "text-[#C6A56B]" : "text-[#A5A5AA] hover:text-[#F5F3EF]"}`}
            >
              <span className="relative">
                <ClipboardList className="h-5 w-5" />
                {visibleUnreadAppointments > 0 && <span className="absolute -right-3 -top-2 rounded-full bg-[#C6A56B] px-1.5 text-[9px] font-bold leading-4 text-[#0B0B0C]">+{visibleUnreadAppointments}</span>}
              </span>
              <span>Agendamentos</span>
            </Link>
            <button
              type="button"
              onClick={openContactOptions}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold text-[#A5A5AA] transition hover:text-[#F5F3EF]"
            >
              <Phone className="h-5 w-5" />
              <span>Contato</span>
            </button>
          </div>
          )}
        </nav>
      )}

      {isContactOptionsOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onClick={closeContactOptions}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-options-title"
            className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#141416] p-6 shadow-2xl sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#C6A56B]">WhatsApp</p>
                <h2 id="contact-options-title" className="mt-2 text-2xl font-semibold text-[#F5F3EF]">Como podemos ajudar?</h2>
                <p className="mt-2 text-sm leading-6 text-[#A5A5AA]">Escolha como quer falar com a NOIR Barber Studio.</p>
              </div>
              <button
                type="button"
                onClick={closeContactOptions}
                aria-label="Fechar opções de contato"
                className="rounded-full border border-white/10 p-2.5 text-[#A5A5AA] transition hover:border-[#C6A56B] hover:text-[#F5F3EF]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 grid gap-3">
              <a
                href={whatsappInquiryUrl}
                target="_blank"
                rel="noreferrer"
                onClick={closeContactOptions}
                className="flex items-center gap-4 rounded-2xl border border-[#C6A56B]/30 bg-[#0B0B0C] p-4 text-left transition hover:border-[#C6A56B] hover:bg-[#C6A56B]/10"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#C6A56B]/15 text-[#C6A56B]"><MessageCircle className="h-5 w-5" /></span>
                <span>
                  <span className="block font-semibold text-[#F5F3EF]">Tirar uma dúvida</span>
                  <span className="mt-1 block text-sm text-[#A5A5AA]">Envie uma mensagem sobre serviços ou horários.</span>
                </span>
              </a>
              <a
                href={whatsappConversationUrl}
                target="_blank"
                rel="noreferrer"
                onClick={closeContactOptions}
                className="flex items-center gap-4 rounded-2xl border border-[#C6A56B]/30 bg-[#0B0B0C] p-4 text-left transition hover:border-[#C6A56B] hover:bg-[#C6A56B]/10"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#C6A56B]/15 text-[#C6A56B]"><Phone className="h-5 w-5" /></span>
                <span>
                  <span className="block font-semibold text-[#F5F3EF]">Conversar diretamente</span>
                  <span className="mt-1 block text-sm text-[#A5A5AA]">Abra uma conversa com nossa equipe.</span>
                </span>
              </a>
            </div>
          </section>
        </div>
      )}
    </>
  );

  const renderBookingFlow = () => {
    if (!bookingStep || !selectedService) {
      return null;
    }

    const stepLabels = ["Data", "Horário", "Seus dados"];
    const activeStep = bookingStep === "date" ? 0 : bookingStep === "time" ? 1 : bookingStep === "details" ? 2 : 3;

    return (
      <div className="booking-flow-overlay fixed inset-0 z-[100] overflow-y-auto bg-[#0B0B0C] text-[#F5F3EF]" role="dialog" aria-modal="true" aria-labelledby="booking-flow-title">
        <div className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#C6A56B]">Novo agendamento</p>
              <p className="mt-1 text-sm text-[#A5A5AA]">{selectedService.name} · {formatMoney(selectedService.price)}</p>
            </div>
            <button
              type="button"
              onClick={resetBookingForm}
              aria-label="Fechar agendamento"
              className="rounded-full border border-white/10 p-3 text-[#A5A5AA] transition hover:border-[#C6A56B] hover:text-[#F5F3EF]"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-8 sm:py-12">
            {bookingStep !== "confirmed" && (
              <div className="mx-auto mb-8 grid w-full max-w-5xl grid-cols-3 gap-3 sm:gap-6" aria-label="Etapas do agendamento">
                {stepLabels.map((label, index) => (
                  <div key={label} className={`border-t-2 pt-2 text-xs ${index <= activeStep ? "border-[#C6A56B] text-[#F5F3EF]" : "border-white/10 text-[#77777D]"}`}>
                    {index + 1}. {label}
                  </div>
                ))}
              </div>
            )}

            {bookingStep === "date" && (
              <section key="booking-date-step" className="booking-step-panel my-auto">
                <p className="text-xs uppercase tracking-[0.2em] text-[#C6A56B]">Etapa 1 de 3</p>
                <h1 id="booking-flow-title" className="mt-2 text-3xl font-semibold sm:text-4xl">Qual dia fica melhor?</h1>
                <p className="mt-2 text-sm text-[#A5A5AA]">Escolha uma data disponível no calendário.</p>

                <div className="mt-8 rounded-[28px] border border-white/10 bg-[#141416] p-4 sm:p-6 lg:mx-auto lg:max-w-3xl lg:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((month) => month ? subMonths(month, 1) : startOfMonth(new Date()))}
                      disabled={!calendarMonth || !firstCalendarMonth || isSameMonth(calendarMonth, firstCalendarMonth)}
                      aria-label="Mês anterior"
                      className="rounded-full border border-white/10 p-2 text-[#A5A5AA] hover:border-[#C6A56B] hover:text-[#F5F3EF] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <label>
                        <span className="sr-only">Escolha o mês do agendamento</span>
                      <select
                        aria-label="Mês do agendamento"
                        value={calendarMonth ? format(calendarMonth, "MM") : ""}
                        onChange={(event) => {
                          const selectedMonth = parseISO(`${format(calendarMonth ?? new Date(), "yyyy")}-${event.target.value}-01`);
                          setCalendarMonth(startOfMonth(selectedMonth));
                          setBookingForm((current) => ({ ...current, date: "", startTime: "" }));
                        }}
                        className="max-w-[145px] rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-2 text-sm font-semibold capitalize text-[#F5F3EF] outline-none focus:border-[#C6A56B] sm:max-w-none"
                      >
                        {calendarMonthsForYear.map((month) => (
                          <option key={format(month, "yyyy-MM")} value={format(month, "MM")}>
                            {format(month, "MMMM", { locale: ptBR })}
                          </option>
                        ))}
                      </select>
                      </label>
                      <label>
                        <span className="sr-only">Escolha o ano do agendamento</span>
                        <select
                          aria-label="Ano do agendamento"
                          value={calendarMonth ? format(calendarMonth, "yyyy") : ""}
                          onChange={(event) => {
                            const monthNumber = format(calendarMonth ?? new Date(), "MM");
                            const selectedYearMonths = calendarMonths.filter((month) => format(month, "yyyy") === event.target.value);
                            const preservedMonth = selectedYearMonths.find((month) => format(month, "MM") === monthNumber);
                            const selectedMonth = preservedMonth ?? selectedYearMonths[0];
                            if (selectedMonth) {
                              setCalendarMonth(startOfMonth(selectedMonth));
                              setBookingForm((current) => ({ ...current, date: "", startTime: "" }));
                            }
                          }}
                          className="rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-2 text-sm font-semibold text-[#F5F3EF] outline-none focus:border-[#C6A56B]"
                        >
                          {calendarYears.map((year) => <option key={year} value={year}>{year}</option>)}
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth((month) => month ? addMonths(month, 1) : startOfMonth(new Date()))}
                      disabled={!calendarMonth || !lastCalendarMonth || isSameMonth(calendarMonth, lastCalendarMonth)}
                      aria-label="Próximo mês"
                      className="rounded-full border border-white/10 p-2 text-[#A5A5AA] hover:border-[#C6A56B] hover:text-[#F5F3EF] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#A5A5AA] sm:gap-2 sm:text-sm lg:text-xs">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <div key={day} className="py-2 sm:py-3">{day}</div>)}
                    {Array.from({ length: calendarLeadingDays }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
                    {businessDateButtons.map((date) => {
                      const dateKey = format(date, "yyyy-MM-dd");
                      const selectable = isDateSelectable(dateKey, settings);
                      const selected = bookingForm.date === dateKey;
                      return (
                        <button
                          key={dateKey}
                          type="button"
                          disabled={!selectable}
                          aria-pressed={selected}
                          onClick={() => {
                            setBookingForm((current) => ({ ...current, date: dateKey, startTime: "" }));
                            setValidationError("");
                          }}
                          className={`aspect-square rounded-xl border text-base font-semibold transition sm:text-lg lg:text-[33px] ${selected ? "border-[#C6A56B] bg-[#C6A56B] text-[#0B0B0C]" : selectable ? "border-white/10 bg-[#0B0B0C] text-[#F5F3EF] hover:border-[#C6A56B]" : "cursor-not-allowed border-white/5 bg-[#0B0B0C]/50 text-[#55555B] opacity-60"}`}
                        >
                          {format(date, "d")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {validationError && <p role="alert" className="mt-4 rounded-xl border border-[#FE5F5F]/30 bg-[#2F1617] p-3 text-sm text-[#F8D6D4]">{validationError}</p>}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    disabled={!bookingForm.date}
                    onClick={() => setBookingStep("time")}
                    className="rounded-full bg-[#C6A56B] px-6 py-3 text-sm font-semibold text-[#0B0B0C] transition hover:bg-[#d7b986] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Confirmar dia e continuar
                  </button>
                </div>
              </section>
            )}

            {bookingStep === "time" && (
              <section key="booking-time-step" className="booking-step-panel my-auto">
                <p className="text-xs uppercase tracking-[0.2em] text-[#C6A56B]">Etapa 2 de 3</p>
                <h1 id="booking-flow-title" className="mt-2 text-3xl font-semibold sm:text-4xl">Escolha o horário</h1>
                <p className="mt-2 text-sm capitalize text-[#A5A5AA]">
                  {bookingForm.date && format(parseISO(bookingForm.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {timeSlotOptions.map((slot) => {
                    const selected = bookingForm.startTime === slot.startTime;
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        disabled={!slot.available}
                        aria-pressed={selected}
                        onClick={() => {
                          setBookingForm((current) => ({ ...current, startTime: slot.startTime }));
                          setValidationError("");
                        }}
                        className={`rounded-2xl border px-3 py-4 text-sm font-medium transition ${selected ? "border-[#C6A56B] bg-[#C6A56B] text-[#0B0B0C]" : slot.available ? "border-white/10 bg-[#141416] text-[#F5F3EF] hover:border-[#C6A56B]" : "cursor-not-allowed border-white/5 bg-[#141416]/50 text-[#66666C] opacity-60"}`}
                      >
                        <span className="block">{slot.label}</span>
                        {!slot.available && <span className="mt-1 block text-[10px] uppercase tracking-wider">Indisponível</span>}
                      </button>
                    );
                  })}
                  {!timeSlotOptions.length && (
                    <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-[#A5A5AA]">
                      Não há horários disponíveis nesta data. Volte ao calendário e escolha outro dia.
                    </div>
                  )}
                </div>
                {validationError && <p role="alert" className="mt-4 rounded-xl border border-[#FE5F5F]/30 bg-[#2F1617] p-3 text-sm text-[#F8D6D4]">{validationError}</p>}
                <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                  <button type="button" onClick={() => setBookingStep("date")} className="rounded-full border border-white/10 px-6 py-3 text-sm text-[#F5F3EF] hover:border-[#C6A56B]">Voltar ao calendário</button>
                  <button
                    type="button"
                    disabled={!bookingForm.startTime}
                    onClick={() => setBookingStep("details")}
                    className="rounded-full bg-[#C6A56B] px-6 py-3 text-sm font-semibold text-[#0B0B0C] transition hover:bg-[#d7b986] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Confirmar horário
                  </button>
                </div>
              </section>
            )}

            {bookingStep === "details" && (
              <section key="booking-details-step" className="booking-step-panel my-auto">
                <p className="text-xs uppercase tracking-[0.2em] text-[#C6A56B]">Etapa 3 de 3</p>
                <h1 id="booking-flow-title" className="mt-2 text-3xl font-semibold sm:text-4xl">Seus dados para confirmar</h1>
                <div className="mt-6 rounded-2xl border border-[#C6A56B]/25 bg-[#C6A56B]/5 p-4 text-sm">
                  <p className="font-semibold text-[#F5F3EF]">{selectedService.name} · {formatMoney(selectedService.price)}</p>
                  <p className="mt-1 capitalize text-[#A5A5AA]">
                    {bookingForm.date && format(parseISO(bookingForm.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    {" · "}{bookingForm.startTime} · {selectedService.durationMinutes} min
                  </p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-[#A5A5AA]">
                    <span>Nome completo</span>
                    <input
                      autoComplete="name"
                      value={bookingForm.customerName}
                      onChange={(event) => setBookingForm((current) => ({ ...current, customerName: event.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-[#141416] px-3 py-3 text-[#F5F3EF] outline-none focus:border-[#C6A56B]"
                      placeholder="Seu nome"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-[#A5A5AA]">
                    <span>Telefone</span>
                    <input
                      autoComplete="tel"
                      type="tel"
                      value={bookingForm.customerPhone}
                      onChange={(event) => setBookingForm((current) => ({ ...current, customerPhone: event.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-[#141416] px-3 py-3 text-[#F5F3EF] outline-none focus:border-[#C6A56B]"
                      placeholder="(11) 99999-9999"
                    />
                  </label>
                </div>
                <label className="mt-4 block space-y-2 text-sm text-[#A5A5AA]">
                  <span>Observação opcional</span>
                  <textarea
                    value={bookingForm.notes}
                    onChange={(event) => setBookingForm((current) => ({ ...current, notes: event.target.value }))}
                    className="min-h-24 w-full rounded-xl border border-white/10 bg-[#141416] px-3 py-3 text-[#F5F3EF] outline-none focus:border-[#C6A56B]"
                    placeholder="Alguma preferência para o atendimento?"
                  />
                </label>
                {validationError && <p role="alert" className="mt-4 rounded-xl border border-[#FE5F5F]/30 bg-[#2F1617] p-3 text-sm text-[#F8D6D4]">{validationError}</p>}
                <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                  <button type="button" onClick={() => setBookingStep("time")} className="rounded-full border border-white/10 px-6 py-3 text-sm text-[#F5F3EF] hover:border-[#C6A56B]">Voltar aos horários</button>
                  <button type="button" onClick={handleBookingSubmit} className="rounded-full bg-[#C6A56B] px-6 py-3 text-sm font-semibold text-[#0B0B0C] transition hover:bg-[#d7b986]">Confirmar agendamento</button>
                </div>
              </section>
            )}

            {bookingStep === "confirmed" && createdAppointment && (
              <section key="booking-confirmed-step" className="booking-step-panel my-auto text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#2fb88d]/30 bg-[#2fb88d]/10 text-[#94d7bf]">
                  <CheckCheck className="h-8 w-8" />
                </div>
                <p className="mt-6 text-xs uppercase tracking-[0.2em] text-[#94d7bf]">Agendamento Criado</p>
                <h1 id="booking-flow-title" className="mt-2 text-3xl font-semibold sm:text-4xl">Seu horário está confirmado.</h1>
                <p className="mx-auto mt-3 max-w-lg text-sm text-[#A5A5AA]">Salvamos seu atendimento. Você pode consultar os detalhes na seção Agendamentos.</p>
                <div className="mx-auto mt-8 max-w-md rounded-[28px] border border-white/10 bg-[#141416] p-5 text-left">
                  <p className="font-semibold text-[#F5F3EF]">{createdAppointment.serviceName}</p>
                  <p className="mt-2 capitalize text-sm text-[#A5A5AA]">
                    {format(parseISO(createdAppointment.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    {" · "}{createdAppointment.startTime} às {createdAppointment.endTime}
                  </p>
                  <p className="mt-2 text-sm text-[#C6A56B]">{formatMoney(createdAppointment.price)}</p>
                </div>
                <Link
                  href="/agendamentos"
                  onClick={() => {
                    clearUnreadAppointments();
                    resetBookingForm();
                  }}
                  className="mt-8 inline-flex rounded-full bg-[#C6A56B] px-6 py-3 text-sm font-semibold text-[#0B0B0C] transition hover:bg-[#d7b986]"
                >
                  Ver meus agendamentos
                </Link>
              </section>
            )}
          </main>
        </div>
      </div>
    );
  };

  const renderHomePage = () => (
    <div className={`flex flex-col gap-6 pb-24 transition-[margin] duration-300 md:pb-20 ${desktopContentOffset}`}>
      {renderHeader()}
      <main className="flex w-full flex-col gap-8">
        <section className="w-full overflow-hidden">
          <div className="relative grid grid-rows-[auto_280px] min-[640px]:grid-rows-[auto_220px] lg:h-[500px] lg:grid-cols-[1.05fr_0.95fr] lg:grid-rows-1">
            <div className="flex flex-col justify-center p-6 sm:p-8 lg:py-10 lg:px-8">
              <div className="hero-copy-content mx-auto w-full max-w-[520px] lg:!left-8">
              <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[#C6A56B]/40 bg-[#C6A56B]/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-[#C6A56B]">
                <Sparkles className="h-3.5 w-3.5" />
                Barber studio premium
              </div>

              <h1 className="max-w-xl text-5xl font-semibold leading-none tracking-[-0.06em] text-[#F5F3EF] sm:text-6xl lg:text-7xl">
                {settings.tagline}
              </h1>
              <p className="mt-4 max-w-lg text-base text-[#A5A5AA] sm:text-lg">
                {settings.description}
              </p>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C6A56B] px-5 py-3 text-sm font-semibold text-[#0B0B0C] transition hover:bg-[#d7b986]"
                >
                  Conhecer serviços
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link href="/agendamentos" onClick={clearUnreadAppointments} className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-[#F5F3EF] transition hover:border-[#C6A56B] hover:text-[#C6A56B]">
                  Ver meus agendamentos
                </Link>
              </div>

              <div className="mt-5 grid max-w-md grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#A5A5AA]">Disponibilidade</p>
                  <p className="mt-2 text-xl font-semibold text-[#F5F3EF]">Hoje</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#A5A5AA]">Agenda</p>
                  <p className="mt-2 text-xl font-semibold text-[#C6A56B]">{todayAppointments.length} atendimentos</p>
                </div>
              </div>
              </div>
            </div>

            <div className="relative min-h-0 lg:h-full">
              <img
                src="https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1200&q=80"
                alt="Barbeiro realizando o corte e acabamento de barba"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0C]/60 via-transparent to-transparent lg:bg-gradient-to-l lg:from-[#0B0B0C]/30 lg:to-transparent" />
            </div>
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 sm:px-6 md:mx-0 md:max-w-none md:px-8">
        <section id="services" className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#C6A56B]">Serviços</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#F5F3EF]">Precisão em cada detalhe</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 min-[666px]:grid-cols-3 min-[880px]:grid-cols-4 min-[1350px]:grid-cols-5 min-[1500px]:grid-cols-6 min-[1800px]:grid-cols-7 sm:gap-5">
            {services.map((service) => {
              const selected = selectedService?.id === service.id || bookingForm.serviceId === service.id;
              return (
                <article
                  key={service.id}
                  className={`group flex flex-col overflow-hidden rounded-[20px] border transition ${selected ? "border-[#C6A56B] bg-[#1B1B1F] shadow-[0_14px_48px_rgba(198,165,107,0.28)]" : "border-white/10 bg-[#141416] hover:border-white/20"}`}
                >
                  <div className="relative aspect-square w-full overflow-hidden">
                    <Image
                      src={serviceImages[service.id] ?? "/img/foto-cabelo.png"}
                      alt={`Serviço de ${service.name}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 600px"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    {selected && <span className="absolute right-4 top-4 rounded-full border border-[#C6A56B]/50 bg-[#0B0B0C]/85 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#C6A56B]">Selecionado</span>}
                  </div>

                  <div className="flex flex-1 flex-col p-5 pb-[3px]">
                    <h3 className="whitespace-nowrap text-[clamp(0.72rem,3.5vw,1.25rem)] font-semibold text-[#F5F3EF]">{service.name}</h3>

                    <div className="mx-[-18px] mt-4 flex items-center justify-between rounded-none border border-white/10 bg-[#0B0B0C]/60 p-3 text-sm text-[#F5F3EF] max-[321px]:flex-col max-[321px]:items-start max-[321px]:gap-1">
                      <span>{service.durationMinutes} min</span>
                      <span className="font-semibold text-[#C6A56B]">{formatMoney(service.price)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => startBooking(service.id)}
                      className="mx-[-18px] mt-4 inline-flex w-[calc(100%+36px)] items-center justify-center gap-1 rounded-full border border-[#C6A56B]/50 bg-[#C6A56B] px-3 py-2 text-xs font-extrabold text-[#0B0B0C] transition hover:bg-[#d7b986] max-[399px]:gap-0.5 max-[399px]:px-2 max-[399px]:text-[10px] sm:gap-2 sm:px-3"
                      style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}
                    >
                      Selecionar
                      <ArrowRight className="h-3.5 w-3.5 max-[399px]:h-3 max-[399px]:w-3" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {renderBookingFlow()}

        <section id="booking-panel" className="hidden">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#C6A56B]">Agendar</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#F5F3EF]">Seu atendimento</h3>
            </div>
            <div className="rounded-full border border-white/10 bg-[#0B0B0C] px-3 py-2 text-xs text-[#A5A5AA]">
              {selectedService ? `${selectedService.name} • ${formatMoney(selectedService.price)}` : "Selecione um serviço"}
            </div>
          </div>

          {selectedService ? (
            <div className="space-y-6">
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-[#0B0B0C] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#A5A5AA]">Serviço</p>
                  <p className="mt-2 text-lg font-semibold text-[#F5F3EF]">{selectedService.name}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0B0B0C] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#A5A5AA]">Duração</p>
                  <p className="mt-2 text-lg font-semibold text-[#F5F3EF]">{selectedService.durationMinutes} min</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0B0B0C] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#A5A5AA]">Preço</p>
                  <p className="mt-2 text-lg font-semibold text-[#C6A56B]">{formatMoney(selectedService.price)}</p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
                <div className="rounded-2xl border border-white/10 bg-[#0B0B0C] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[#F5F3EF]">
                    <CalendarDays className="h-4 w-4 text-[#C6A56B]" />
                    <span className="text-sm font-medium">Escolher dia</span>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center text-[11px] text-[#A5A5AA]">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => (
                      <div key={`${day}-${index}`} className="py-2">{day.slice(0, 1)}</div>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-7 gap-2">
                    {businessDateButtons.map((date) => {
                      const dateKey = format(date, "yyyy-MM-dd");
                      const selectable = isDateSelectable(dateKey, settings);
                      const selected = bookingForm.date === dateKey;
                      return (
                        <button
                          key={dateKey}
                          type="button"
                          disabled={!selectable}
                          onClick={() => setBookingForm((current) => ({ ...current, date: dateKey, startTime: "" }))}
                          className={`h-11 rounded-xl border text-xs font-medium transition ${selected ? "border-[#C6A56B] bg-[#C6A56B]/15 text-[#F5F3EF]" : "border-white/10 bg-[#141416] text-[#A5A5AA]"} ${!selectable ? "cursor-not-allowed opacity-35" : "hover:border-[#C6A56B]"}`}
                        >
                          {format(date, "d")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0B0B0C] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[#F5F3EF]">
                    <Clock3 className="h-4 w-4 text-[#C6A56B]" />
                    <span className="text-sm font-medium">Escolher horário</span>
                  </div>

                  {bookingForm.date ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {availableSlots.length ? (
                        availableSlots.map((slot) => {
                          const [startTime] = slot.split(" - ");
                          const selected = bookingForm.startTime === startTime;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setBookingForm((current) => ({ ...current, startTime }))}
                              className={`rounded-xl border px-3 py-3 text-xs font-medium transition ${selected ? "border-[#C6A56B] bg-[#C6A56B]/15 text-[#F5F3EF]" : "border-white/10 bg-[#141416] text-[#A5A5AA] hover:border-[#C6A56B] hover:text-[#F5F3EF]"}`}
                            >
                              {slot}
                            </button>
                          );
                        })
                      ) : (
                        <div className="col-span-full rounded-xl border border-dashed border-white/10 bg-[#141416] p-4 text-sm text-[#A5A5AA]">
                          Nenhum horário disponível para este dia. Escolha outra data.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-[#141416] p-4 text-sm text-[#A5A5AA]">
                      Selecione uma data para visualizar os horários.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0B0B0C] p-4">
                <div className="mb-4 flex items-center gap-2 text-[#F5F3EF]">
                  <UserRound className="h-4 w-4 text-[#C6A56B]" />
                  <span className="text-sm font-medium">Informar dados do cliente</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-[#A5A5AA]">
                    <span>Nome completo</span>
                    <input
                      value={bookingForm.customerName}
                      onChange={(event) => setBookingForm((current) => ({ ...current, customerName: event.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-[#141416] px-3 py-3 text-[#F5F3EF] outline-none ring-0 transition placeholder:text-[#6b7280] focus:border-[#C6A56B]"
                      placeholder="Seu nome"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-[#A5A5AA]">
                    <span>Telefone</span>
                    <input
                      value={bookingForm.customerPhone}
                      onChange={(event) => setBookingForm((current) => ({ ...current, customerPhone: event.target.value }))}
                      className="w-full rounded-xl border border-white/10 bg-[#141416] px-3 py-3 text-[#F5F3EF] outline-none ring-0 transition placeholder:text-[#6b7280] focus:border-[#C6A56B]"
                      placeholder="(11) 99999-9999"
                    />
                  </label>
                </div>

                <label className="mt-4 block space-y-2 text-sm text-[#A5A5AA]">
                  <span>Observação opcional</span>
                  <textarea
                    value={bookingForm.notes}
                    onChange={(event) => setBookingForm((current) => ({ ...current, notes: event.target.value }))}
                    className="min-h-[96px] w-full rounded-xl border border-white/10 bg-[#141416] px-3 py-3 text-[#F5F3EF] outline-none transition placeholder:text-[#6b7280] focus:border-[#C6A56B]"
                    placeholder="Detalhes do corte, barba ou preferência de estilo"
                  />
                </label>
              </div>

              {(bookingForm.date && bookingForm.startTime && selectedService) && (
                <div className="rounded-2xl border border-[#C6A56B]/25 bg-[#C6A56B]/10 p-4 text-sm text-[#F5F3EF]">
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-[#C6A56B]">Resumo</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div><span className="text-[#A5A5AA]">Serviço:</span> {selectedService.name}</div>
                    <div><span className="text-[#A5A5AA]">Preço:</span> {formatMoney(selectedService.price)}</div>
                    <div><span className="text-[#A5A5AA]">Data:</span> {format(parseISO(bookingForm.date), "dd/MM/yyyy")}</div>
                    <div><span className="text-[#A5A5AA]">Horário:</span> {bookingForm.startTime} - {getBookingStartAndEnd(bookingForm.date, bookingForm.startTime, selectedService.durationMinutes).end}</div>
                  </div>
                </div>
              )}

              {validationError && (
                <div className="rounded-xl border border-[#FE5F5F]/40 bg-[#2F1617] px-4 py-3 text-sm text-[#F8D6D4]">{validationError}</div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetBookingForm}
                  className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-[#F5F3EF] transition hover:border-[#C6A56B]"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={handleBookingSubmit}
                  className="rounded-full bg-[#C6A56B] px-5 py-3 text-sm font-semibold text-[#0B0B0C] transition hover:bg-[#d7b986]"
                >
                  Confirmar agendamento
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-[#0B0B0C] p-8 text-center text-[#A5A5AA]">
              Selecione um serviço para iniciar o agendamento.
            </div>
          )}
        </section>

        </div>
      </main>
      {toast && <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-[#2fb88d]/40 bg-[#112621] px-5 py-3 text-center text-sm font-semibold text-[#94d7bf] shadow-xl md:bottom-5">{toast}</div>}
    </div>
  );

  const renderAppointmentsPage = () => (
    <div className={`min-h-screen bg-[#0B0B0C] text-[#F5F3EF] transition-[margin] duration-300 ${desktopContentOffset}`}>
      {renderHeader()}
      <main className="w-full max-w-7xl px-4 py-8 sm:px-6 md:px-8">
        <div className="mb-6 flex flex-col gap-2">
          <Link href="/" className="mb-2 inline-flex w-fit items-center gap-2 text-sm text-[#A5A5AA] transition hover:text-[#C6A56B]">
            <ArrowRight className="h-4 w-4 rotate-180" />
            Voltar à barbearia
          </Link>
          <p className="text-xs uppercase tracking-[0.2em] text-[#C6A56B]">Agendamentos</p>
          <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[#F5F3EF]">Seus agendamentos</h1>
          <p className="text-sm text-[#A5A5AA]">Aqui ficam os atendimentos salvos neste dispositivo.</p>
        </div>

        <div className="mt-6 space-y-4">
          {[...appointments]
            .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
            .map((appointment) => (
              <div key={appointment.id} className="rounded-[28px] border border-white/10 bg-[#141416] p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#C6A56B]">{appointment.serviceName}</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#F5F3EF]">{appointment.customerName}</h2>
                  </div>
                  <span className="rounded-full border border-[#C6A56B]/40 bg-[#C6A56B]/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-[#C6A56B]">
                    {getStatusLabel(appointment.status)}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-[#0B0B0C] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#A5A5AA]">Data e hora</p>
                    <p className="mt-2 text-sm capitalize text-[#F5F3EF]">{format(parseISO(appointment.date), "EEEE, d 'de' MMMM yyyy", { locale: ptBR })} • {appointment.startTime} às {appointment.endTime}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0B0B0C] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#A5A5AA]">Valor</p>
                    <p className="mt-2 text-sm text-[#F5F3EF]">{formatMoney(appointment.price)} • {appointment.durationMinutes} min</p>
                  </div>
                </div>

                {appointment.notes && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-[#0B0B0C] p-4 text-sm text-[#A5A5AA]">
                    <p className="font-medium text-[#F5F3EF]">Observação</p>
                    <p className="mt-2">{appointment.notes}</p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  {appointment.status !== "cancelled" && appointment.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => cancelAppointment(appointment.id)}
                      className="rounded-full border border-[#FE5F5F]/50 bg-[#FE5F5F]/10 px-4 py-2 text-sm font-medium text-[#F8D6D4] transition hover:bg-[#FE5F5F]/20"
                    >
                      Cancelar agendamento
                    </button>
                  )}
                </div>
              </div>
            ))}
          {!appointments.length && (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-[#141416] p-10 text-center text-[#A5A5AA]">
              <CalendarCheck2 className="mx-auto h-8 w-8 text-[#C6A56B]" />
              <p className="mt-4">Você ainda não tem agendamentos salvos.</p>
              <Link href="/" className="mt-5 inline-flex rounded-full bg-[#C6A56B] px-5 py-3 text-sm font-semibold text-[#0B0B0C]">
                Agendar um horário
              </Link>
            </div>
          )}
        </div>
      </main>
      {toast && <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-[#2fb88d]/40 bg-[#112621] px-5 py-3 text-center text-sm font-semibold text-[#94d7bf] shadow-xl md:bottom-5">{toast}</div>}
    </div>
  );

  const renderAdminLoginPage = () => (
    <div className="min-h-screen bg-[#0B0B0C] text-[#F5F3EF]">
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6 sm:pb-14 sm:pt-8">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-[#A5A5AA] transition hover:text-[#C6A56B]">
          <ArrowRight className="h-4 w-4 rotate-180" />
          Voltar à barbearia
        </Link>

        <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-white/10 sm:h-56 sm:rounded-3xl md:h-64">
          <img
            src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=2200&q=85"
            alt="Interior de uma barbearia"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0C]/70 via-[#0B0B0C]/10 to-transparent" />
          <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full border border-[#C6A56B]/40 bg-[#0B0B0C]/65 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E2C895] backdrop-blur-sm sm:bottom-7 sm:left-7 sm:text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acesso administrativo
          </div>
        </div>

        <section className="mx-auto mt-7 w-full max-w-md">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="relative mb-3 h-16 w-16 overflow-hidden rounded-full border-2 border-[#C6A56B]/70 bg-[#141416] shadow-[0_0_28px_rgba(198,165,107,0.14)]">
              <Image src="/img/logo-barbearia.jpg" alt={`Logo ${settings.businessName}`} fill sizes="64px" className="object-cover" />
            </span>
            <p className="text-xs uppercase tracking-[0.24em] text-[#C6A56B]">{settings.businessName}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#F5F3EF]">Entrar no painel</h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#A5A5AA]">
              Acesse com suas credenciais para gerenciar a agenda e os serviços da barbearia.
            </p>
          </div>

          <div className="space-y-5 rounded-2xl border border-white/10 bg-[#141416] p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <label className="block space-y-2 text-sm text-[#A5A5AA]">
              <span>Usuário</span>
              <input
                value={adminLogin.username}
                onChange={(event) => setAdminLogin((current) => ({ ...current, username: event.target.value }))}
                autoComplete="username"
                className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-3 text-[#F5F3EF] outline-none transition focus:border-[#C6A56B]"
                placeholder="Digite seu usuário"
              />
            </label>

            <label className="block space-y-2 text-sm text-[#A5A5AA]">
              <span>Senha</span>
              <input
                value={adminLogin.password}
                onChange={(event) => setAdminLogin((current) => ({ ...current, password: event.target.value }))}
                type="password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-3 text-[#F5F3EF] outline-none transition focus:border-[#C6A56B]"
                placeholder="Digite sua senha"
              />
            </label>

            <button
              type="button"
              onClick={handleAdminLogin}
              className="w-full rounded-full bg-[#C6A56B] px-4 py-3.5 text-sm font-semibold text-[#0B0B0C] transition hover:bg-[#d7b986]"
            >
              Entrar no painel
            </button>

            <div className="rounded-xl border border-white/5 bg-[#0B0B0C] px-4 py-3 text-xs leading-relaxed text-[#A5A5AA]">
              <p className="font-medium text-[#F5F3EF]">Credenciais de demonstração</p>
              <p className="mt-1">Usuário: <span className="text-[#C6A56B]">{demoCredentials.username}</span> · Senha: <span className="text-[#C6A56B]">{demoCredentials.password}</span></p>
            </div>
            <p className="text-center text-[11px] leading-relaxed text-[#77777D]">
              Esta autenticação é demonstrativa e não deve ser considerada proteção para produção.
            </p>
          </div>
        </section>
      </main>
    </div>
  );

  useEffect(() => {
    if (view !== "admin") {
      return;
    }

    const currentSession = getStorageState().adminSession;
    if (!currentSession.authenticated && typeof window !== "undefined") {
      window.location.assign("/login-admin");
    }
  }, [adminSession.authenticated, view]);

  const renderAdminPage = () => {
    if (!adminSession.authenticated) {
      return null;
    }

    const weekdayLabels: Record<WeekdayKey, string> = {
      mon: "Segunda-feira",
      tue: "Terça-feira",
      wed: "Quarta-feira",
      thu: "Quinta-feira",
      fri: "Sexta-feira",
      sat: "Sábado",
      sun: "Domingo",
    };
    const adminAppointmentsForDay = appointments
      .filter((appointment) => appointment.date === selectedAdminDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const todayRevenue = appointments
      .filter((appointment) => appointment.date === todayKey && appointment.status !== "cancelled")
      .reduce((total, appointment) => total + appointment.price, 0);
    const completedAppointments = appointments.filter((appointment) => appointment.status === "completed");
    const cancelledAppointments = appointments.filter((appointment) => appointment.status === "cancelled");
    const scheduledAppointments = appointments.filter((appointment) => appointment.status === "scheduled");
    const inProgressAppointments = appointments.filter((appointment) => appointment.status === "in_progress");
    const statusChartData = [
      { label: "Concluídos", value: completedAppointments.length, color: "#C6A56B" },
      { label: "Agendados", value: scheduledAppointments.length, color: "#F5F3EF" },
      { label: "Em atendimento", value: inProgressAppointments.length, color: "#61C7A0" },
      { label: "Cancelados", value: cancelledAppointments.length, color: "#FE5F5F" },
    ];
    const statusTotal = statusChartData.reduce((total, item) => total + item.value, 0);
    let chartOffset = 0;
    const statusGradient = statusTotal
      ? `conic-gradient(${statusChartData.map((item) => {
          const start = chartOffset;
          chartOffset += (item.value / statusTotal) * 100;
          return `${item.color} ${start}% ${chartOffset}%`;
        }).join(", ")})`
      : "conic-gradient(#333338 0% 100%)";
    const monthlyStats = Array.from({ length: 6 }, (_, index) => {
      const month = startOfMonth(subMonths(new Date(), 5 - index));
      const monthKey = format(month, "yyyy-MM");
      const monthAppointments = appointments.filter(
        (appointment) => appointment.date.startsWith(monthKey) && appointment.status !== "cancelled",
      );
      return {
        label: format(month, "MMM", { locale: ptBR }),
        appointments: monthAppointments.length,
        revenue: monthAppointments.reduce((total, appointment) => total + appointment.price, 0),
      };
    });
    const maxMonthlyRevenue = Math.max(...monthlyStats.map((month) => month.revenue), 1);
    const maxMonthlyAppointments = Math.max(...monthlyStats.map((month) => month.appointments), 1);
    const sectionTitles: Record<AdminSection, { title: string; description: string }> = {
      agenda: { title: "Agenda diária", description: "Acompanhe os atendimentos e a movimentação do dia." },
      management: { title: "Gerenciamento", description: "Pesquise clientes, atualize agendamentos e gerencie serviços." },
      settings: { title: "Configurações", description: "Defina horários de funcionamento e dados da barbearia." },
      analytics: { title: "Desempenho", description: "Acompanhe atendimentos, cancelamentos e faturamento." },
    };
    const currentSection = sectionTitles[adminSection];

    return (
      <div className={`min-h-screen bg-[#0B0B0C] pb-24 text-[#F5F3EF] transition-[margin] duration-300 md:pb-8 ${desktopContentOffset}`}>
        {renderHeader()}
        <main className="w-full max-w-7xl px-4 py-5 sm:px-6 md:px-8 md:py-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link href="/" className="mb-2 inline-flex items-center gap-2 text-sm text-[#A5A5AA] transition hover:text-[#C6A56B]">
                <ArrowRight className="h-4 w-4 rotate-180" />
                Voltar à barbearia
              </Link>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C6A56B]">Painel do barbeiro</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#F5F3EF] sm:text-3xl">{currentSection.title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#A5A5AA]">{currentSection.description}</p>
            </div>
            <div className="flex items-center gap-2 sm:pb-1">
              <button
                type="button"
                onClick={handleAdminLogout}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-[#F5F3EF] transition hover:border-[#C6A56B] sm:px-4 sm:text-sm"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          </div>

          {adminSection === "agenda" && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
                {[
                  { label: "Hoje", value: todayAppointments.length, icon: CalendarCheck2, tint: "text-[#C6A56B]" },
                  { label: "Próximos", value: upcomingAppointments.length, icon: Clock3, tint: "text-[#F5F3EF]" },
                  { label: "Concluídos", value: completedAppointments.length, icon: CheckCheck, tint: "text-[#61C7A0]" },
                  { label: "Cancelados", value: cancelledAppointments.length, icon: X, tint: "text-[#FE5F5F]" },
                  { label: "Faturado hoje", value: formatMoney(todayRevenue), icon: CircleDollarSign, tint: "text-[#C6A56B]" },
                ].map(({ label, value, icon: Icon, tint }) => (
                  <div key={label} className="min-w-0 rounded-2xl border border-white/10 bg-[#141416] p-3 sm:rounded-[22px] sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#A5A5AA] sm:text-xs">{label}</p>
                      <Icon className={`h-4 w-4 shrink-0 ${tint}`} />
                    </div>
                    <p className="mt-2 truncate text-xl font-semibold text-[#F5F3EF] sm:mt-3 sm:text-2xl">{value}</p>
                  </div>
                ))}
              </div>
              <section className="rounded-2xl border border-white/10 bg-[#141416] p-3 sm:rounded-[26px] sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#F5F3EF] sm:text-xl">Agenda diária</h2>
                    <p className="mt-1 text-xs text-[#A5A5AA]">{adminAppointmentsForDay.length} atendimentos</p>
                  </div>
                  <input
                    type="date"
                    value={selectedAdminDate}
                    onChange={(event) => setSelectedAdminDate(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-2.5 text-sm text-[#F5F3EF] sm:w-auto"
                  />
                </div>
                <div className="space-y-2.5">
                  {adminAppointmentsForDay.length ? adminAppointmentsForDay.map((appointment) => (
                    <div key={appointment.id} className="rounded-xl border border-white/10 bg-[#0B0B0C] p-3 sm:rounded-2xl sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#F5F3EF]">{appointment.startTime} · {appointment.customerName}</p>
                          <p className="mt-1 text-sm text-[#A5A5AA]">{appointment.serviceName} · {formatMoney(appointment.price)}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-[#C6A56B]/40 bg-[#C6A56B]/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-[#C6A56B]">
                          {getStatusLabel(appointment.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#A5A5AA]">{formatPhoneDisplay(appointment.customerPhone)} · até {appointment.endTime}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {appointment.status === "scheduled" && (
                          <button type="button" onClick={() => updateAppointmentStatus(appointment.id, "in_progress")} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#F5F3EF]">Iniciar</button>
                        )}
                        {appointment.status !== "cancelled" && appointment.status !== "completed" && (
                          <button type="button" onClick={() => updateAppointmentStatus(appointment.id, "completed")} className="rounded-full border border-[#61C7A0]/40 bg-[#61C7A0]/10 px-3 py-1.5 text-xs text-[#9BE1C4]">Finalizar</button>
                        )}
                        {appointment.status !== "cancelled" && appointment.status !== "completed" && (
                          <button type="button" onClick={() => cancelAppointment(appointment.id)} className="rounded-full border border-[#FE5F5F]/40 bg-[#FE5F5F]/10 px-3 py-1.5 text-xs text-[#F8D6D4]">Cancelar</button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-[#0B0B0C] p-6 text-center text-sm text-[#A5A5AA]">
                      Nenhum agendamento para a data selecionada.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {adminSection === "management" && (
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/10 bg-[#141416] p-3 sm:rounded-[26px] sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <label className="block flex-1 space-y-2 text-sm text-[#A5A5AA]">
                    <span>Pesquisar por nome ou telefone</span>
                    <input value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-2.5 text-[#F5F3EF] outline-none focus:border-[#C6A56B]" placeholder="Buscar cliente" />
                  </label>
                  <label className="block space-y-2 text-sm text-[#A5A5AA] sm:w-56">
                    <span>Filtrar status</span>
                    <select value={adminFilterStatus} onChange={(event) => setAdminFilterStatus(event.target.value as "all" | AppointmentStatus)} className="w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-2.5 text-[#F5F3EF] outline-none focus:border-[#C6A56B]">
                      <option value="all">Todos os status</option>
                      <option value="scheduled">Agendado</option>
                      <option value="in_progress">Em atendimento</option>
                      <option value="completed">Concluído</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </label>
                </div>
                <p className="mb-3 text-xs text-[#A5A5AA]">{adminFilteredAppointments.length} agendamentos encontrados</p>
                <div className="space-y-2">
                  {adminFilteredAppointments.map((appointment) => (
                    <article key={appointment.id} className="rounded-xl border border-white/10 bg-[#0B0B0C] p-3 sm:rounded-2xl sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#F5F3EF]">{appointment.customerName}</p>
                          <p className="mt-1 text-sm text-[#A5A5AA]">{appointment.serviceName} · {format(parseISO(appointment.date), "dd/MM/yyyy")} · {appointment.startTime} · {formatMoney(appointment.price)}</p>
                          <p className="mt-1 text-xs text-[#A5A5AA]">{formatPhoneDisplay(appointment.customerPhone)} · {getStatusLabel(appointment.status)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {appointment.status === "scheduled" && <button type="button" onClick={() => updateAppointmentStatus(appointment.id, "in_progress")} className="rounded-full border border-white/15 px-3 py-2 text-xs text-[#F5F3EF]">Iniciar</button>}
                          {appointment.status !== "cancelled" && appointment.status !== "completed" && <button type="button" onClick={() => updateAppointmentStatus(appointment.id, "completed")} className="rounded-full border border-[#61C7A0]/40 bg-[#61C7A0]/10 px-3 py-2 text-xs text-[#9BE1C4]">Finalizar</button>}
                          {appointment.status !== "cancelled" && appointment.status !== "completed" && <button type="button" onClick={() => cancelAppointment(appointment.id)} className="rounded-full border border-[#FE5F5F]/40 bg-[#FE5F5F]/10 px-3 py-2 text-xs text-[#F8D6D4]">Cancelar</button>}
                          <a href={`https://wa.me/${normalizePhone(appointment.customerPhone)}?text=${encodeURIComponent(`Olá, ${appointment.customerName}! Aqui é da NOIR BARBER STUDIO. Estou entrando em contato sobre seu agendamento de ${appointment.serviceName}, marcado para ${appointment.date} às ${appointment.startTime}.`)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#61C7A0]/40 bg-[#61C7A0]/10 px-3 py-2 text-xs text-[#9BE1C4]"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>
                        </div>
                      </div>
                    </article>
                  ))}
                  {!adminFilteredAppointments.length && <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-[#A5A5AA]">Nenhum agendamento corresponde aos filtros.</div>}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#F5F3EF]">Serviços</h2>
                    <p className="mt-1 text-xs text-[#A5A5AA]">Atualize preço, duração e disponibilidade.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {services.map((service) => (
                    <article key={service.id} className="rounded-2xl border border-white/10 bg-[#141416] p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-[#F5F3EF]">{service.name}</h3>
                        <label className="flex items-center gap-2 text-xs text-[#A5A5AA]">
                          <input type="checkbox" checked={service.active} onChange={(event) => setServices((current) => current.map((item) => item.id === service.id ? { ...item, active: event.target.checked } : item))} className="accent-[#C6A56B]" />
                          Ativo
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1 text-xs text-[#A5A5AA]">Preço
                          <input type="number" min="0" step="1" value={service.price} onChange={(event) => setServices((current) => current.map((item) => item.id === service.id ? { ...item, price: Number(event.target.value) } : item))} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B0B0C] px-2.5 py-2 text-sm text-[#F5F3EF]" />
                        </label>
                        <label className="space-y-1 text-xs text-[#A5A5AA]">Duração (min)
                          <input type="number" min="5" step="5" value={service.durationMinutes} onChange={(event) => setServices((current) => current.map((item) => item.id === service.id ? { ...item, durationMinutes: Number(event.target.value) } : item))} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B0B0C] px-2.5 py-2 text-sm text-[#F5F3EF]" />
                        </label>
                      </div>
                      <button type="button" onClick={() => handleSaveService(service)} className="mt-3 w-full rounded-full border border-[#C6A56B]/40 bg-[#C6A56B]/10 px-3 py-2 text-xs font-semibold text-[#C6A56B] transition hover:bg-[#C6A56B]/20">Salvar serviço</button>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}

          {adminSection === "settings" && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#141416] p-4 sm:rounded-[26px] sm:p-5">
                <div className="mb-4 flex items-center gap-2"><Building2 className="h-4 w-4 text-[#C6A56B]" /><h2 className="text-lg font-semibold">Dados da barbearia</h2></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm text-[#A5A5AA]">Nome
                    <input value={adminSettings.businessName} onChange={(event) => setAdminSettings((current) => ({ ...current, businessName: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-2.5 text-[#F5F3EF]" />
                  </label>
                  <label className="space-y-1.5 text-sm text-[#A5A5AA]">Slogan
                    <input value={adminSettings.tagline} onChange={(event) => setAdminSettings((current) => ({ ...current, tagline: event.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-2.5 text-[#F5F3EF]" />
                  </label>
                  <label className="space-y-1.5 text-sm text-[#A5A5AA] sm:col-span-2">Descrição
                    <textarea value={adminSettings.description} onChange={(event) => setAdminSettings((current) => ({ ...current, description: event.target.value }))} className="mt-1 min-h-20 w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-2.5 text-[#F5F3EF]" />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#141416] p-4 sm:rounded-[26px] sm:p-5">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Horários de funcionamento</h2>
                  <p className="mt-1 text-xs text-[#A5A5AA]">Marque os dias fechados ou ajuste abertura e fechamento.</p>
                </div>
                <div className="space-y-2">
                  {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as WeekdayKey[]).map((day) => {
                    const hours = adminSettings.workingHours[day];
                    return (
                      <div key={day} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl border border-white/5 bg-[#0B0B0C] p-2.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-3 sm:p-3">
                        <span className="text-sm font-medium text-[#F5F3EF]">{weekdayLabels[day]}</span>
                        {hours.closed ? (
                          <span className="col-span-2 text-center text-xs text-[#A5A5AA]">Fechado</span>
                        ) : (
                          <>
                            <label className="text-[10px] text-[#A5A5AA] sm:text-xs">Abre
                              <input type="time" value={hours.opens} onChange={(event) => setAdminSettings((current) => ({ ...current, workingHours: { ...current.workingHours, [day]: { ...current.workingHours[day], opens: event.target.value } } }))} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#141416] px-1.5 py-1.5 text-xs text-[#F5F3EF] sm:px-2 sm:text-sm" />
                            </label>
                            <label className="text-[10px] text-[#A5A5AA] sm:text-xs">Fecha
                              <input type="time" value={hours.closes} onChange={(event) => setAdminSettings((current) => ({ ...current, workingHours: { ...current.workingHours, [day]: { ...current.workingHours[day], closes: event.target.value } } }))} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#141416] px-1.5 py-1.5 text-xs text-[#F5F3EF] sm:px-2 sm:text-sm" />
                            </label>
                          </>
                        )}
                        <label className="flex items-center justify-end gap-1.5 text-[10px] text-[#A5A5AA] sm:text-xs">
                          <input type="checkbox" checked={hours.closed} onChange={(event) => setAdminSettings((current) => ({ ...current, workingHours: { ...current.workingHours, [day]: { ...current.workingHours[day], closed: event.target.checked } } }))} className="accent-[#C6A56B]" />
                          Fechado
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#141416] p-4 sm:rounded-[26px] sm:p-5">
                <h2 className="mb-4 text-lg font-semibold">Intervalo</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-[#A5A5AA]">Início do intervalo
                    <input type="time" value={adminSettings.lunchBreak.start} onChange={(event) => setAdminSettings((current) => ({ ...current, lunchBreak: { ...current.lunchBreak, start: event.target.value } }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-2.5 text-[#F5F3EF]" />
                  </label>
                  <label className="text-sm text-[#A5A5AA]">Fim do intervalo
                    <input type="time" value={adminSettings.lunchBreak.end} onChange={(event) => setAdminSettings((current) => ({ ...current, lunchBreak: { ...current.lunchBreak, end: event.target.value } }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0B0B0C] px-3 py-2.5 text-[#F5F3EF]" />
                  </label>
                </div>
                <button type="button" onClick={saveSettings} className="mt-5 w-full rounded-full bg-[#C6A56B] px-4 py-3 text-sm font-semibold text-[#0B0B0C] transition hover:bg-[#d7b986] sm:w-auto sm:px-8">Salvar configurações</button>
              </div>
            </section>
          )}

          {adminSection === "analytics" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
                {[
                  { label: "Faturamento total", value: formatMoney(appointments.filter((appointment) => appointment.status !== "cancelled").reduce((total, appointment) => total + appointment.price, 0)), icon: CircleDollarSign },
                  { label: "Atendimentos concluídos", value: completedAppointments.length, icon: CheckCheck },
                  { label: "Cancelamentos", value: cancelledAppointments.length, icon: X },
                  { label: "Taxa de conclusão", value: `${appointments.length ? Math.round((completedAppointments.length / appointments.length) * 100) : 0}%`, icon: ChartNoAxesCombined },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-[#141416] p-3 sm:rounded-[22px] sm:p-4">
                    <div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-wider text-[#A5A5AA] sm:text-xs">{label}</p><Icon className="h-4 w-4 shrink-0 text-[#C6A56B]" /></div>
                    <p className="mt-2 truncate text-lg font-semibold text-[#F5F3EF] sm:text-2xl">{value}</p>
                  </div>
                ))}
              </div>
              <section className="rounded-2xl border border-white/10 bg-[#141416] p-4 sm:rounded-[26px] sm:p-5">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold">Faturamento por mês</h2>
                  <p className="mt-1 text-xs text-[#A5A5AA]">Estimativa com base nos agendamentos não cancelados.</p>
                </div>
                <div className="grid h-52 grid-cols-6 items-end gap-2 border-b border-white/10 pb-2 sm:h-64 sm:gap-5">
                  {monthlyStats.map((month) => (
                    <div key={month.label} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                      <span className="max-w-full truncate text-center text-[9px] text-[#A5A5AA] sm:text-xs">{month.revenue ? formatMoney(month.revenue) : "—"}</span>
                      <div className="flex h-[72%] w-full items-end justify-center">
                        <div title={`${formatMoney(month.revenue)} · ${month.appointments} atendimentos`} className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-[#8B6A37] via-[#C6A56B] to-[#F5F3EF] transition-all" style={{ height: `${month.revenue ? Math.max(8, (month.revenue / maxMonthlyRevenue) * 100) : 0}%` }} />
                      </div>
                      <span className="text-xs capitalize text-[#A5A5AA]">{month.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-6 gap-2 sm:gap-5">
                  {monthlyStats.map((month) => (
                    <p key={`${month.label}-count`} className="text-center text-[9px] text-[#77777D] sm:text-xs">{month.appointments} atend.</p>
                  ))}
                </div>
              </section>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <section className="rounded-2xl border border-white/10 bg-[#141416] p-4 sm:rounded-[26px] sm:p-5">
                  <h2 className="text-lg font-semibold">Status dos atendimentos</h2>
                  <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
                    <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: statusGradient }}>
                      <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-[#141416]">
                        <span className="text-2xl font-semibold text-[#F5F3EF]">{statusTotal}</span>
                        <span className="text-[10px] text-[#A5A5AA]">total</span>
                      </div>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-1">
                      {statusChartData.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2 text-[#A5A5AA]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
                          <span className="font-semibold text-[#F5F3EF]">{item.value}{statusTotal ? ` · ${Math.round((item.value / statusTotal) * 100)}%` : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
                <section className="rounded-2xl border border-white/10 bg-[#141416] p-4 sm:rounded-[26px] sm:p-5">
                  <h2 className="text-lg font-semibold">Volume de atendimentos</h2>
                  <p className="mt-1 text-xs text-[#A5A5AA]">Comparativo mensal dos últimos seis meses.</p>
                  <div className="mt-5 grid h-40 grid-cols-6 items-end gap-2 border-b border-white/10 pb-2 sm:h-48 sm:gap-4">
                    {monthlyStats.map((month) => (
                      <div key={`${month.label}-appointments`} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                        <span className="text-[10px] text-[#F5F3EF]">{month.appointments}</span>
                        <div className="flex h-[75%] w-full items-end justify-center">
                          <div className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-[#8B6A37] to-[#C6A56B]" style={{ height: `${month.appointments ? Math.max(8, (month.appointments / maxMonthlyAppointments) * 100) : 0}%` }} />
                        </div>
                        <span className="text-xs capitalize text-[#A5A5AA]">{month.label}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  };

  if (view === "appointments") {
    return renderAppointmentsPage();
  }

  if (view === "admin") {
    return renderAdminPage();
  }

  if (view === "admin-login") {
    return renderAdminLoginPage();
  }

  return renderHomePage();
}
