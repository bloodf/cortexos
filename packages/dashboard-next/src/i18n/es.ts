import type { Dict } from "./en";

export const es: Dict = {
  app: { name: "CortexOS", tagline: "Plano de control de infraestructura" },
  common: {
    search: "Buscar…", searchKbd: "Buscar… ⌘K", loading: "Cargando…",
    empty: "Nada para mostrar", error: "Algo salió mal", retry: "Reintentar",
    cancel: "Cancelar", confirm: "Confirmar", save: "Guardar", delete: "Eliminar",
    create: "Crear", edit: "Editar", close: "Cerrar", open: "Abrir", refresh: "Refrescar",
    admin: "Admin", actions: "Acciones", status: "Estado", name: "Nombre", type: "Tipo",
    description: "Descripción", enabled: "Activo", disabled: "Inactivo", yes: "Sí", no: "No",
    all: "Todo", none: "Ninguno", start: "Iniciar", stop: "Detener", restart: "Reiniciar",
    logs: "Logs", remove: "Quitar", favorite: "Favorito",
  },
  status: { online: "En línea", offline: "Caído", unknown: "Desconocido", checking: "Comprobando" },
  auth: { signIn: "Entrar", username: "Usuario", password: "Contraseña", show: "Mostrar", hide: "Ocultar", invalid: "Credenciales inválidas", logout: "Salir" },
  nav: {
    platform: "Plataforma", infra: "Infraestructura", secOps: "Seguridad y Ops", admin: "Configuración",
    overview: "Resumen", apps: "Apps", healthcheck: "Salud", agents: "Agentes",
    docker: "Docker", incus: "Incus", systemd: "Systemd", storage: "Almacenamiento",
    network: "Red", processes: "Procesos", terminal: "Terminal", mail: "Mail Guardian",
    alerts: "Alertas", approvals: "Aprobaciones", audit: "Auditoría",
    services: "Servicios", badges: "Panel", env: "Explorador Env", users: "Usuarios",
    projects: "Proyectos", account: "Cuenta",
    scheduler: "Programador", backups: "Copias de seguridad",
  },
  overview: {
    customize: "Personalizar", addWidget: "Añadir widget",
    widgets: {
      cpu: "CPU", memory: "Memoria", storage: "Disco", cpuTemp: "Temp. CPU",
      sensors: "Sensores", servicesOnline: "Servicios activos", servicesOffline: "Caídos",
      servicesIdle: "Inactivos", live: "Rendimiento en vivo", topProcesses: "Procesos top",
      network: "Red", download: "Bajada total", upload: "Subida total",
      dbOps: "Ops Bases de datos", monOps: "Ops Monitoreo", containerOps: "Ops Contenedores",
      docker: "Docker", uptime: "Uptime", alerts: "Alertas recientes",
    },
  },
  palette: { nav: "Navegación", services: "Servicios", actions: "Acciones",
    hints: { move: "↑↓ mover", select: "↵ elegir", close: "esc cerrar" }, recent: "Reciente" },
  live: { connected: "En vivo", reconnecting: "Reconectando" },
};
