export const getApiBase = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Check if we are on a devtunnel URL
    // e.g. xnttfw6w-3000.inc1.devtunnels.ms
    const devtunnelMatch = host.match(/^([a-zA-Z0-9]+)-(\d+)\.(.*devtunnels\.ms)$/);
    if (devtunnelMatch) {
      const [_, tunnelId, port, rest] = devtunnelMatch;
      return `https://${tunnelId}-8000.${rest}`;
    }
  }

  return "http://127.0.0.1:8000";
};

export const API_BASE = getApiBase();

