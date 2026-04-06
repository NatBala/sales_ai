export const DEFAULT_REALTIME_ICE_WAIT_MS = 6000;
export const DEFAULT_REALTIME_CONNECT_TIMEOUT_MS = 25000;

const PREFERRED_CANDIDATE_PATTERN = /\btyp (srflx|relay)\b/i;

export function waitForUsableIceCandidate(
  peer: RTCPeerConnection,
  timeoutMs = DEFAULT_REALTIME_ICE_WAIT_MS,
): Promise<void> {
  if (peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      peer.removeEventListener("icegatheringstatechange", handleStateChange);
      peer.removeEventListener("icecandidate", handleCandidate);
      resolve();
    };

    const handleStateChange = () => {
      if (peer.iceGatheringState === "complete") {
        finish();
      }
    };

    const handleCandidate = (event: RTCPeerConnectionIceEvent) => {
      const candidate = event.candidate?.candidate ?? "";
      if (!event.candidate || PREFERRED_CANDIDATE_PATTERN.test(candidate)) {
        finish();
      }
    };

    const timeoutId = window.setTimeout(finish, Math.max(timeoutMs, DEFAULT_REALTIME_ICE_WAIT_MS));
    peer.addEventListener("icegatheringstatechange", handleStateChange);
    peer.addEventListener("icecandidate", handleCandidate);
  });
}

export function buildRealtimeConnectError(peer: RTCPeerConnection): string {
  const connectionState = peer.connectionState || "unknown";
  const iceState = peer.iceConnectionState || "unknown";
  return `Realtime connection failed to initialize (${connectionState}/${iceState}). Please try again.`;
}
