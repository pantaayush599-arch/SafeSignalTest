import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/types";
import { getRequestState } from "../api/client";
import type { RequestStateOut } from "../api/types";
import { WS_BASE } from "../api/client";

export type WsConnectionState = "connecting" | "open" | "closed" | "error";

/**
 * Polls GET /requests/{id} for the initial/authoritative state, then keeps
 * it live via WS /ws/requests/{id}. On any WS disconnect it never assumes
 * verified/failed -- it always re-syncs with a fresh GET, per the contract's
 * explicit "a dropped socket is never treated as verified or failed" rule.
 */
export function useRequestState(token: string | undefined, requestId: string | undefined) {
  const [state, setState] = useState<RequestStateOut | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsState, setWsState] = useState<WsConnectionState>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !requestId) return;
    try {
      const fresh = await getRequestState(token, requestId);
      setState(fresh);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, null, "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [token, requestId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!token || !requestId) return;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setWsState("connecting");
      const ws = new WebSocket(`${WS_BASE}/ws/requests/${requestId}?token=${encodeURIComponent(token!)}`);
      wsRef.current = ws;

      ws.onopen = () => setWsState("open");
      ws.onmessage = () => {
        // Any event (STATUS_CHANGED / VERIFICATION_UPDATED) triggers a
        // full re-sync via GET rather than trusting the socket payload as
        // the source of truth -- keeps a single source of truth server-side.
        refresh();
      };
      ws.onerror = () => setWsState("error");
      ws.onclose = () => {
        setWsState("closed");
        refresh(); // never assume verified/failed on disconnect; re-sync
        if (!cancelled) {
          reconnectTimer.current = window.setTimeout(connect, 3000);
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [token, requestId, refresh]);

  return { state, error, loading, wsState, refresh };
}
