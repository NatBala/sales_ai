import { useCallback, useRef, useState } from "react";
import {
  buildRealtimeConnectError,
  DEFAULT_REALTIME_CONNECT_TIMEOUT_MS,
  waitForUsableIceCandidate,
} from "@/lib/realtime";

export type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface BookingProposal {
  date: string;
  time: string;
  agendaTopic: string;
  dayLabel: string;
  timeLabel: string;
}

export interface AgendaArticleSelection {
  title: string;
  url: string;
  topic?: string;
  slot?: number;
}

export interface AdvisorMeta {
  advisorName: string;
  advisorCompany: string;
  advisorSegment?: string;
  aumM?: number;
  fiOpportunities?: number;
  etfOpportunities?: number;
  alpha?: number;
  competitors?: string[];
  territory?: string;
}

export interface UseRealtimeCallOptions {
  playbackWorkletPath: string;
  captureWorkletPath: string;
  onUserTranscriptDelta?: (delta: string, accumulated: string) => void;
  onUserTranscript?: (text: string) => void;
  onAgentTranscriptDelta?: (delta: string, accumulated: string) => void;
  onAgentResponseDone?: (fullText: string) => void;
  onBookingDetected?: (booking: BookingProposal) => void;
  onAgendaArticleAdded?: (article: AgendaArticleSelection) => void;
  onFunctionCall?: (toolCall: {
    name?: string;
    callId?: string;
    itemId?: string;
    argumentsText: string;
  }, helpers: {
    sendRealtimeEvent: (payload: Record<string, unknown>) => void;
  }) => void;
  onRealtimeEvent?: (event: Record<string, unknown>) => void;
  isTranscriptIgnored?: (text: string) => boolean;
  onError?: (error: Error) => void;
  onAgentSpeakingChange?: (speaking: boolean) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
}

export interface RealtimeStartOptions {
  sessionPath?: string;
  initialResponse?: {
    output_modalities?: string[];
    modalities?: string[];
    max_output_tokens?: number | "inf";
    instructions?: string;
  } | null;
}

interface RealtimeSessionResponse {
  answerSdp?: string;
  ephemeralKey?: string;
  webrtcUrl?: string;
}

const SCHEDULE_ME_TRANSCRIPTION_HINT = [
  "vanguard scheduling call",
  "advisor names",
  "firm names",
  "weekdays",
  "calendar times",
  "pacific time",
  "fixed income",
  "etfs",
  "direct indexing",
  "portfolio diagnostics",
  "advisor alpha",
].join(", ");

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function normalizeRealtimeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function sanitizeTranscriptText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function isPromptEchoTranscript(text: string): boolean {
  const normalized = normalizeRealtimeText(text);
  if (!normalized) return false;

  return (
    normalized === SCHEDULE_ME_TRANSCRIPTION_HINT ||
    normalized.startsWith("outbound scheduling call for vanguard") ||
    normalized.includes("listen for firm names") ||
    (normalized.includes("portfolio diagnostics") && normalized.includes("advisor alpha"))
  );
}

async function applyRealtimeAnswer(
  peer: RTCPeerConnection,
  offerSdp: string,
  session: RealtimeSessionResponse,
): Promise<void> {
  if (session.answerSdp) {
    await peer.setRemoteDescription({
      type: "answer",
      sdp: session.answerSdp,
    });
    return;
  }

  if (!session.ephemeralKey || !session.webrtcUrl) {
    throw new Error("Realtime session metadata missing");
  }

  const answerRes = await fetch(session.webrtcUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.ephemeralKey}`,
      "Content-Type": "application/sdp",
    },
    body: offerSdp,
  });

  if (!answerRes.ok) {
    const detail = await answerRes.text();
    throw new Error(detail ? `Realtime WebRTC connect failed: ${detail}` : "Realtime WebRTC connect failed");
  }

  const answerSdp = await answerRes.text();
  if (!answerSdp) {
    throw new Error("Realtime answer SDP missing");
  }

  await peer.setRemoteDescription({
    type: "answer",
    sdp: answerSdp,
  });
}

function normalizeResponseModalities(modalities?: string[]): string[] | undefined {
  if (!modalities?.length) return undefined;
  return modalities;
}

function buildRealtimeResponseOptions(response?: RealtimeStartOptions["initialResponse"]) {
  if (!response) return undefined;

  const modalities = normalizeResponseModalities(
    response.modalities?.length ? response.modalities : response.output_modalities,
  );

  return Object.fromEntries(
    Object.entries({
      output_modalities: modalities,
      max_output_tokens: response.max_output_tokens,
      instructions: response.instructions,
    }).filter(([, value]) => value !== undefined),
  );
}

export function useRealtimeCall(options: UseRealtimeCallOptions) {
  const {
    onConnectionStateChange,
    onAgentSpeakingChange,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const expiryTimeoutRef = useRef<number | null>(null);
  const disconnectTimeoutRef = useRef<number | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const negotiationArmedRef = useRef(false);
  const startAttemptRef = useRef(0);
  const mutedRef = useRef(false);
  const openerInProgressRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const accumulatedUserTranscriptRef = useRef("");
  const functionCallArgsRef = useRef("");
  const currentCallIdRef = useRef("");
  const currentItemIdRef = useRef("");
  const lastUserPreviewRef = useRef("");
  const lastAgentPreviewRef = useRef("");
  const lastDeliveredAgentResponseRef = useRef("");

  const cbRefs = useRef(options);
  cbRefs.current = options;

  const updateConnectionState = useCallback((state: ConnectionState) => {
    setConnectionState(state);
    onConnectionStateChange?.(state);
  }, [onConnectionStateChange]);

  const updateAgentSpeaking = useCallback((speaking: boolean) => {
    setAgentSpeaking(speaking);
    onAgentSpeakingChange?.(speaking);
  }, [onAgentSpeakingChange]);

  const syncMicTrackState = useCallback(() => {
    const shouldEnable = !mutedRef.current && !openerInProgressRef.current;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = shouldEnable;
    });
  }, []);

  const sendRealtimeEvent = useCallback((payload: Record<string, unknown>) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify(payload));
  }, []);

  const cleanup = useCallback(() => {
    if (expiryTimeoutRef.current !== null) {
      window.clearTimeout(expiryTimeoutRef.current);
      expiryTimeoutRef.current = null;
    }

    if (disconnectTimeoutRef.current !== null) {
      window.clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }

    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }

    const channel = dataChannelRef.current;
    if (channel) {
      channel.onopen = null;
      channel.onmessage = null;
      channel.onerror = null;
      channel.onclose = null;
      if (channel.readyState !== "closed") {
        channel.close();
      }
      dataChannelRef.current = null;
    }

    const peer = peerConnectionRef.current;
    if (peer) {
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
      if (peer.signalingState !== "closed") {
        peer.close();
      }
      peerConnectionRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }

    accumulatedTranscriptRef.current = "";
    accumulatedUserTranscriptRef.current = "";
    functionCallArgsRef.current = "";
    currentCallIdRef.current = "";
    currentItemIdRef.current = "";
    lastUserPreviewRef.current = "";
    lastAgentPreviewRef.current = "";
    lastDeliveredAgentResponseRef.current = "";
    openerInProgressRef.current = false;
    hasConnectedOnceRef.current = false;
    negotiationArmedRef.current = false;
  }, []);

  const releaseMicAfterOpener = useCallback(() => {
    if (!openerInProgressRef.current) return;
    openerInProgressRef.current = false;
    syncMicTrackState();
  }, [syncMicTrackState]);

  const handleRealtimeMessage = useCallback((event: MessageEvent) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      return;
    }

    cbRefs.current.onRealtimeEvent?.(msg);

    const type = msg.type as string;
    const isIgnoredTranscript = (text: string) =>
      cbRefs.current.isTranscriptIgnored?.(text) ?? isPromptEchoTranscript(text);

    switch (type) {
      case "session.created":
      case "session.updated":
      case "input_audio_buffer.speech_stopped":
      case "input_audio_buffer.committed":
      case "response.output_audio.delta":
      case "response.audio.delta":
        break;

      case "input_audio_buffer.speech_started":
        accumulatedTranscriptRef.current = "";
        lastAgentPreviewRef.current = "";
        updateAgentSpeaking(false);
        break;

      case "conversation.item.input_audio_transcription.delta": {
        const delta = (msg.delta as string | undefined) ?? "";
        if (delta && !isIgnoredTranscript(delta)) {
          accumulatedUserTranscriptRef.current += delta;
          const preview = sanitizeTranscriptText(accumulatedUserTranscriptRef.current);
          if (preview && preview !== lastUserPreviewRef.current) {
            lastUserPreviewRef.current = preview;
            cbRefs.current.onUserTranscriptDelta?.(sanitizeTranscriptText(delta), preview);
          }
        }
        break;
      }

      case "conversation.item.input_audio_transcription.completed": {
        const transcript = sanitizeTranscriptText(
          (msg.transcript as string | undefined) ?? accumulatedUserTranscriptRef.current,
        );
        if (transcript && !isIgnoredTranscript(transcript)) {
          lastUserPreviewRef.current = transcript;
          cbRefs.current.onUserTranscript?.(transcript);
        }
        accumulatedUserTranscriptRef.current = "";
        lastUserPreviewRef.current = "";
        break;
      }

      case "response.created":
        accumulatedTranscriptRef.current = "";
        lastAgentPreviewRef.current = "";
        updateAgentSpeaking(true);
        break;

      case "response.output_audio.done":
      case "response.audio.done":
        releaseMicAfterOpener();
        break;

      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta": {
        const delta = msg.delta as string;
        if (delta) {
          accumulatedTranscriptRef.current += delta;
          const preview = sanitizeTranscriptText(accumulatedTranscriptRef.current);
          if (preview && preview !== lastAgentPreviewRef.current) {
            lastAgentPreviewRef.current = preview;
            cbRefs.current.onAgentTranscriptDelta?.(sanitizeTranscriptText(delta), preview);
          }
        }
        break;
      }

      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const transcript = sanitizeTranscriptText(
          (msg.transcript as string | undefined) ?? accumulatedTranscriptRef.current,
        );
        lastAgentPreviewRef.current = "";
        if (transcript && transcript !== lastDeliveredAgentResponseRef.current) {
          lastDeliveredAgentResponseRef.current = transcript;
          cbRefs.current.onAgentResponseDone?.(transcript);
        }
        break;
      }

      case "response.function_call_arguments.delta": {
        const delta = msg.delta as string;
        if (delta) {
          functionCallArgsRef.current += delta;
        }
        break;
      }

      case "response.function_call_arguments.done": {
        const args = (msg.arguments as string | undefined) ?? functionCallArgsRef.current;
        const callId = (msg.call_id as string | undefined) ?? currentCallIdRef.current;
        const name = msg.name as string | undefined;

        cbRefs.current.onFunctionCall?.(
          {
            name,
            callId,
            itemId: currentItemIdRef.current || undefined,
            argumentsText: args,
          },
          {
            sendRealtimeEvent,
          },
        );

        try {
          const parsed = JSON.parse(args) as Record<string, string>;

          if (name === "book_meeting") {
            const booking: BookingProposal = {
              date: parsed.date ?? "",
              time: parsed.time ?? "",
              agendaTopic: parsed.agendaTopic ?? "Vanguard working session",
              dayLabel: parsed.dayLabel ?? "",
              timeLabel: parsed.timeLabel ?? "",
            };
            cbRefs.current.onBookingDetected?.(booking);

            sendRealtimeEvent({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  success: true,
                  message: `Meeting booked for ${booking.dayLabel} at ${booking.timeLabel}. Calendar invite will be sent.`,
                }),
              },
            });
            sendRealtimeEvent({ type: "response.create" });
          }

          if (name === "add_agenda_article") {
            const article: AgendaArticleSelection = {
              title: parsed.title ?? "",
              url: parsed.url ?? "",
              topic: parsed.topic ?? "",
              slot: Number(parsed.slot ?? "0") || undefined,
            };

            if (article.title && article.url) {
              cbRefs.current.onAgendaArticleAdded?.(article);
            }

            sendRealtimeEvent({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  success: true,
                  message: article.title
                    ? `Added "${article.title}" to the agenda article list.`
                    : "Agenda article updated.",
                }),
              },
            });
            sendRealtimeEvent({ type: "response.create" });
          }
        } catch (error) {
          console.error(`Failed to parse ${name ?? "realtime"} function args:`, error);
        }

        functionCallArgsRef.current = "";
        currentCallIdRef.current = "";
        break;
      }

      case "response.output_item.added": {
        const item = msg.item as Record<string, unknown> | undefined;
        if (item?.call_id) currentCallIdRef.current = item.call_id as string;
        if (item?.id) currentItemIdRef.current = item.id as string;
        break;
      }

      case "response.done":
        updateAgentSpeaking(false);
        releaseMicAfterOpener();
        break;

      case "response.cancelled":
        updateAgentSpeaking(false);
        break;

      case "error": {
        const errObj = msg.error as Record<string, unknown> | undefined;
        const errMsg = (errObj?.message as string) ?? "Unknown Realtime API error";
        console.error("Realtime API error:", errObj);
        cbRefs.current.onError?.(new Error(errMsg));
        break;
      }

      default:
        break;
    }
  }, [releaseMicAfterOpener, sendRealtimeEvent, updateAgentSpeaking]);

  const startCall = useCallback(async (
    sessionBody: Record<string, unknown>,
    startOptions: RealtimeStartOptions = {},
  ) => {
    const attemptId = startAttemptRef.current + 1;
    startAttemptRef.current = attemptId;
    cleanup();

    const sessionPath = startOptions.sessionPath ?? "/api/realtime/session";
    const initialResponse = startOptions.initialResponse === undefined
      ? {
          output_modalities: ["audio"],
          instructions:
            'The advisor just picked up the phone. In your first sentence, introduce yourself as "Maya, the Vanguard Scheduling AI assistant with Vanguard," then ask if they have 30 seconds. Keep it to 1-2 sentences.',
        }
      : startOptions.initialResponse;

    const connectAttempt = async (iceWaitMs: number) => {
      updateConnectionState("connecting");
      mutedRef.current = false;
      setIsMuted(false);

      try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (startAttemptRef.current !== attemptId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      const audioElement = document.createElement("audio");
      audioElement.autoplay = true;
      audioElement.setAttribute("playsinline", "true");
      audioElement.style.display = "none";
      document.body.appendChild(audioElement);
      audioElementRef.current = audioElement;

      const peer = new RTCPeerConnection({
        iceServers: DEFAULT_ICE_SERVERS,
        iceCandidatePoolSize: 4,
      });
      peerConnectionRef.current = peer;

      peer.ontrack = (trackEvent) => {
        if (!audioElementRef.current) return;
        audioElementRef.current.srcObject = trackEvent.streams[0];
        void audioElementRef.current.play().catch(() => {});
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          hasConnectedOnceRef.current = true;
          if (connectTimeoutRef.current !== null) {
            window.clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          if (disconnectTimeoutRef.current !== null) {
            window.clearTimeout(disconnectTimeoutRef.current);
            disconnectTimeoutRef.current = null;
          }
          updateConnectionState("connected");
        } else if (peer.connectionState === "failed") {
          if (!negotiationArmedRef.current) {
            return;
          }
          updateConnectionState("connecting");
          if (disconnectTimeoutRef.current !== null) {
            window.clearTimeout(disconnectTimeoutRef.current);
          }
          disconnectTimeoutRef.current = window.setTimeout(() => {
            if (peerConnectionRef.current === peer && peer.connectionState === "failed") {
              if (!hasConnectedOnceRef.current) {
                cleanup();
                updateConnectionState("error");
                cbRefs.current.onError?.(new Error("Realtime connection failed to initialize. Please try again."));
                updateAgentSpeaking(false);
                return;
              }
              cleanup();
              updateConnectionState("disconnected");
              updateAgentSpeaking(false);
            }
          }, hasConnectedOnceRef.current ? 7000 : 12000);
        } else if (peer.connectionState === "closed") {
          cleanup();
          updateConnectionState("disconnected");
          updateAgentSpeaking(false);
        } else if (peer.connectionState === "disconnected") {
          if (!negotiationArmedRef.current) {
            return;
          }
          updateConnectionState("connecting");
          if (disconnectTimeoutRef.current !== null) {
            window.clearTimeout(disconnectTimeoutRef.current);
          }
          disconnectTimeoutRef.current = window.setTimeout(() => {
            if (peerConnectionRef.current === peer && peer.connectionState === "disconnected") {
              cleanup();
              updateConnectionState("disconnected");
              updateAgentSpeaking(false);
            }
          }, hasConnectedOnceRef.current ? 7000 : 12000);
        }
      };

      peer.oniceconnectionstatechange = () => {
        if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
          if (connectTimeoutRef.current !== null) {
            window.clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          if (disconnectTimeoutRef.current !== null) {
            window.clearTimeout(disconnectTimeoutRef.current);
            disconnectTimeoutRef.current = null;
          }
          if (peer.connectionState !== "failed" && peer.connectionState !== "closed") {
            updateConnectionState("connected");
          }
        }
      };

      const normalizedInitialResponse = buildRealtimeResponseOptions(initialResponse);
      const hasInitialResponse = Boolean(
        normalizedInitialResponse && Object.keys(normalizedInitialResponse).length > 0,
      );
      openerInProgressRef.current = hasInitialResponse;
      syncMicTrackState();

      if (startAttemptRef.current !== attemptId || peerConnectionRef.current !== peer) {
        stream.getTracks().forEach((track) => track.stop());
        if (peerConnectionRef.current === peer) {
          peer.close();
        }
        return;
      }

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      const channel = peer.createDataChannel("oai-events");
      dataChannelRef.current = channel;

      channel.onopen = () => {
        if (connectTimeoutRef.current !== null) {
          window.clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        updateConnectionState("connected");
        if (hasInitialResponse) {
          sendRealtimeEvent({
            type: "response.create",
            response: normalizedInitialResponse,
          });
        }
      };

      channel.onmessage = handleRealtimeMessage;
      channel.onerror = () => {
        cbRefs.current.onError?.(new Error("Realtime data channel error"));
      };
      channel.onclose = () => {
        const peerState = peerConnectionRef.current?.connectionState;
        if (peerState === "connected" || peerState === "connecting") {
          return;
        }
        cleanup();
        updateConnectionState("disconnected");
        updateAgentSpeaking(false);
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForUsableIceCandidate(peer, iceWaitMs);

      connectTimeoutRef.current = window.setTimeout(() => {
        if (!hasConnectedOnceRef.current && peerConnectionRef.current === peer) {
          const message = buildRealtimeConnectError(peer);
          cbRefs.current.onError?.(new Error(message));
          cleanup();
          updateConnectionState("error");
          updateAgentSpeaking(false);
        }
      }, DEFAULT_REALTIME_CONNECT_TIMEOUT_MS);

      const sessionRes = await fetch(sessionPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...sessionBody,
          offerSdp: peer.localDescription?.sdp ?? offer.sdp ?? "",
        }),
      });

      if (!sessionRes.ok) {
        let detail = "";
        try {
          const errorPayload = await sessionRes.json() as { error?: string; details?: string };
          detail = errorPayload.details || errorPayload.error || "";
        } catch {
          detail = await sessionRes.text();
        }
        throw new Error(detail ? `Session creation failed: ${sessionRes.status} - ${detail}` : `Session creation failed: ${sessionRes.status}`);
      }

      const session = await sessionRes.json() as RealtimeSessionResponse;
      const localSdp = peer.localDescription?.sdp ?? offer.sdp ?? "";
      if (startAttemptRef.current !== attemptId || peerConnectionRef.current !== peer) {
        return;
      }
      await applyRealtimeAnswer(peer, localSdp, session);
      negotiationArmedRef.current = true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Failed to start call");
        cbRefs.current.onError?.(err);
        cleanup();
        updateConnectionState("error");
      }
    };

    hasConnectedOnceRef.current = false;
    await connectAttempt(1200);
  }, [cleanup, handleRealtimeMessage, sendRealtimeEvent, syncMicTrackState, updateAgentSpeaking, updateConnectionState]);

  const endCall = useCallback(() => {
    startAttemptRef.current += 1;
    cleanup();
    updateConnectionState("idle");
    updateAgentSpeaking(false);
  }, [cleanup, updateAgentSpeaking, updateConnectionState]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setIsMuted(mutedRef.current);
    syncMicTrackState();
  }, [syncMicTrackState]);

  return {
    connectionState,
    agentSpeaking,
    isMuted,
    startCall,
    endCall,
    sendRealtimeEvent,
    toggleMute,
  };
}
