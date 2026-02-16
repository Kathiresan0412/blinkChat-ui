'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RTCSignal } from '@/lib/ws';

const offerOptions: RTCOfferOptions = { offerToReceiveAudio: true, offerToReceiveVideo: true };

export function useWebRTC(onSignal: (payload: RTCSignal) => void) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const startLocalStream = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not access camera/microphone';
      setError(msg);
      return null;
    }
  }, []);

  const createPeerConnection = useCallback(
    async (stream: MediaStream, isInitiator: boolean) => {
      const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      const pc = new RTCPeerConnection(config);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams[0]) setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) onSignal({ type: 'ice', candidate: event.candidate.toJSON() });
      };

      if (isInitiator) {
        const offer = await pc.createOffer(offerOptions);
        await pc.setLocalDescription(offer);
        if (offer.sdp) onSignal({ type: 'offer', sdp: offer.sdp });
      }

      return pc;
    },
    [onSignal]
  );

  const handleSignal = useCallback(async (payload: RTCSignal, stream: MediaStream | null) => {
    let pc = pcRef.current;
    if (!pc && stream) {
      const isInitiator = payload.type !== 'offer';
      pc = await createPeerConnection(stream, isInitiator);
      pcRef.current = pc;
    }
    if (!pc) return;

    if (payload.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (answer.sdp) onSignal({ type: 'answer', sdp: answer.sdp });
    } else if (payload.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
    } else if (payload.type === 'ice' && payload.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
    }
  }, [createPeerConnection, onSignal]);

  const stop = useCallback(() => {
    localStream?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setError(null);
  }, [localStream]);

  return {
    localStream,
    remoteStream,
    error,
    startLocalStream,
    createPeerConnection,
    handleSignal,
    stop,
  };
}
