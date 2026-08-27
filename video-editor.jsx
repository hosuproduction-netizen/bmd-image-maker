const BMD_VIDEO_TRACKS = [
  { id: "none", name: "배경음악 없음", meta: "원본 소리만 사용", icon: "—" },
  {
    id: "minimal",
    name: "Minimal Tech",
    meta: "차분한 테크 · 자체 생성 루프",
    icon: "♫",
  },
  {
    id: "bright",
    name: "Bright Motion",
    meta: "밝고 경쾌함 · 자체 생성 루프",
    icon: "♫",
  },
  {
    id: "cinematic",
    name: "Cinematic Pulse",
    meta: "묵직한 시네마틱 · 자체 생성 루프",
    icon: "♫",
  },
];

function bmdVideoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function bmdVideoTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  return `${String(mins).padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
}

function bmdClipDuration(clip) {
  if (!clip) return 0;
  if (clip.type === "video") {
    return Math.max(
      .2,
      (clip.trimEnd || clip.sourceDuration || clip.duration || 1) -
        (clip.trimStart || 0),
    );
  }
  return Math.max(.5, clip.duration || 3);
}

function bmdTransitionDuration(clip, isLast) {
  if (!clip || isLast || clip.transition === "none") return 0;
  return Math.min(
    Math.max(.2, clip.transitionDuration || .5),
    Math.max(.2, bmdClipDuration(clip) / 2),
  );
}

function bmdBuildTimeline(clips) {
  let cursor = 0;
  const items = clips.map((clip, index) => {
    const duration = bmdClipDuration(clip);
    const transitionDuration = bmdTransitionDuration(
      clip,
      index === clips.length - 1,
    );
    const item = {
      clip,
      index,
      start: cursor,
      end: cursor + duration,
      duration,
      transitionDuration,
    };
    cursor += duration - transitionDuration;
    return item;
  });
  return { items, total: items.length ? items[items.length - 1].end : 0 };
}

function bmdDrawCover(ctx, source, width, height, scale, offsetX, offsetY) {
  if (!source || !source.videoWidth && !source.naturalWidth) return false;
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
  const sourceHeight = source.videoHeight || source.naturalHeight ||
    source.height;
  if (!sourceWidth || !sourceHeight) return false;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let drawWidth;
  let drawHeight;
  if (sourceRatio > targetRatio) {
    drawHeight = height;
    drawWidth = height * sourceRatio;
  } else {
    drawWidth = width;
    drawHeight = width / sourceRatio;
  }
  const zoom = Math.min(3, Math.max(.2, scale || 1));
  drawWidth *= zoom;
  drawHeight *= zoom;
  const maxOffsetX = Math.abs(drawWidth - width) / 2;
  const maxOffsetY = Math.abs(drawHeight - height) / 2;
  const normalizedOffsetX = Math.max(-1, Math.min(1, offsetX || 0));
  const normalizedOffsetY = Math.max(-1, Math.min(1, offsetY || 0));
  const drawX = (width - drawWidth) / 2 + normalizedOffsetX * maxOffsetX;
  const drawY = (height - drawHeight) / 2 + normalizedOffsetY * maxOffsetY;
  ctx.drawImage(source, drawX, drawY, drawWidth, drawHeight);
  return true;
}

function bmdWavBlob(style) {
  const sampleRate = 22050;
  const seconds = 16;
  const sampleCount = sampleRate * seconds;
  const pcm = new Int16Array(sampleCount);
  const tempo = style === "cinematic" ? 80 : style === "bright" ? 116 : 100;
  const beat = 60 / tempo;
  const roots = style === "bright"
    ? [261.63, 329.63, 392, 293.66]
    : style === "cinematic"
    ? [73.42, 65.41, 87.31, 73.42]
    : [110, 130.81, 98, 110];
  const melody = style === "bright"
    ? [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 880, 783.99]
    : [220, 261.63, 196, 220, 261.63, 293.66, 261.63, 220];

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const bar = Math.floor(t / (beat * 4)) % roots.length;
    const root = roots[bar];
    const beatPhase = t % beat;
    const halfBeat = t % (beat / 2);
    const noteIndex = Math.floor(t / (beat / 2)) % melody.length;
    const notePhase = t % (beat / 2);
    let value = 0;

    if (style === "cinematic") {
      value += Math.sin(2 * Math.PI * root * t) * .16;
      value += Math.sin(2 * Math.PI * root * 1.5 * t) * .07;
      value += Math.sin(2 * Math.PI * root * .5 * t) * .09;
      value += Math.sin(2 * Math.PI * (60 - beatPhase * 35) * beatPhase) *
        Math.exp(-8 * beatPhase) * .26;
      value *= .75 + .25 * Math.sin(Math.PI * (t % (beat * 4)) / (beat * 4));
    } else {
      const padEnvelope = .72 +
        .28 * Math.sin(Math.PI * (t % (beat * 4)) / (beat * 4));
      value += Math.sin(2 * Math.PI * root * t) * .09 * padEnvelope;
      value += Math.sin(2 * Math.PI * root * 1.25 * t) * .045 * padEnvelope;
      value += Math.sin(2 * Math.PI * root * 1.5 * t) * .04 * padEnvelope;
      value += Math.sin(2 * Math.PI * (85 - beatPhase * 55) * beatPhase) *
        Math.exp(-12 * beatPhase) * (style === "bright" ? .25 : .19);
      const pluck = Math.exp(-8 * notePhase / (beat / 2));
      value += Math.sin(2 * Math.PI * melody[noteIndex] * t) * pluck *
        (style === "bright" ? .12 : .055);
      const noise = Math.sin((i + 1) * 12.9898) * 43758.5453;
      value += (noise - Math.floor(noise) - .5) * Math.exp(-30 * halfBeat) *
        .025;
    }

    const fadeIn = Math.min(1, t / .25);
    const fadeOut = Math.min(1, (seconds - t) / .35);
    value *= fadeIn * fadeOut;
    pcm[i] = Math.max(-32767, Math.min(32767, Math.round(value * 32767)));
  }

  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);
  const write = (offset, text) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  new Int16Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}

function VideoEditor({ resellerName }) {
  const [clips, setClips] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [quality, setQuality] = React.useState("720");
  const [bgmId, setBgmId] = React.useState("minimal");
  const [bgmVolume, setBgmVolume] = React.useState(.32);
  const [customBgm, setCustomBgm] = React.useState(null);
  const [exportState, setExportState] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [imageDragging, setImageDragging] = React.useState(false);

  const canvasRef = React.useRef(null);
  const mediaInputRef = React.useRef(null);
  const musicInputRef = React.useRef(null);
  const mediaRefs = React.useRef(new Map());
  const imageRefs = React.useRef(new Map());
  const objectUrls = React.useRef(new Set());
  const generatedMusicUrls = React.useRef(new Map());
  const bgmElementRef = React.useRef(null);
  const animationRef = React.useRef(null);
  const playClockRef = React.useRef({ startedAt: 0, baseTime: 0 });
  const playingRef = React.useRef(false);
  const currentTimeRef = React.useRef(0);
  const exportCancelRef = React.useRef(false);
  const recorderRef = React.useRef(null);
  const audioGraphRef = React.useRef(null);
  const imageDragRef = React.useRef(null);

  const timeline = React.useMemo(() => bmdBuildTimeline(clips), [clips]);
  const selectedClip = clips.find((clip) => clip.id === selectedId) || null;

  React.useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  React.useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  React.useEffect(() => () => {
    cancelAnimationFrame(animationRef.current);
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    generatedMusicUrls.current.forEach((url) => URL.revokeObjectURL(url));
    if (audioGraphRef.current?.context) {
      audioGraphRef.current.context.close().catch(() => {});
    }
  }, []);

  const updateClip = React.useCallback((id, patch) => {
    setClips((list) =>
      list.map((clip) => clip.id === id ? { ...clip, ...patch } : clip)
    );
  }, []);

  const getImage = React.useCallback((clip) => {
    if (!clip || clip.type !== "image") return null;
    if (imageRefs.current.has(clip.id)) return imageRefs.current.get(clip.id);
    const image = new Image();
    image.onload = () => drawPreview(currentTimeRef.current);
    image.src = clip.url;
    imageRefs.current.set(clip.id, image);
    return image;
  }, []);

  const drawSource = React.useCallback(
    (ctx, item, time, width, height, alpha, translateX) => {
      const clip = item.clip;
      let source = null;
      if (clip.type === "image") source = getImage(clip);
      else source = mediaRefs.current.get(clip.id);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(translateX || 0, 0);
      const drawn = bmdDrawCover(
        ctx,
        source,
        width,
        height,
        clip.type === "image" ? clip.imageScale ?? 1 : 1,
        clip.type === "image" ? clip.imageOffsetX ?? 0 : 0,
        clip.type === "image" ? clip.imageOffsetY ?? 0 : 0,
      );
      if (!drawn) {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#111827");
        gradient.addColorStop(1, clip.type === "video" ? "#166534" : "#9a3412");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "rgba(255,255,255,.75)";
        ctx.font = `600 ${Math.round(width * .025)}px Pretendard, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(clip.name, width / 2, height / 2);
      }
      ctx.restore();
    },
    [getImage],
  );

  const renderFrame = React.useCallback((time, canvas) => {
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#05070b";
    ctx.fillRect(0, 0, width, height);
    if (!timeline.items.length) return;

    let active = timeline.items.filter((item) =>
      time >= item.start - .02 && time <= item.end + .02
    );
    if (!active.length) {
      active = [
        timeline
          .items[
            Math.min(
              timeline.items.length - 1,
              timeline.items.findIndex((item) => time < item.start),
            )
          ],
      ];
    }
    active = active.filter(Boolean).slice(-2);

    if (active.length === 1) {
      drawSource(ctx, active[0], time, width, height, 1, 0);
      return;
    }

    const first = active[0];
    const second = active[1];
    const progress = Math.max(
      0,
      Math.min(
        1,
        (time - second.start) / Math.max(.01, first.transitionDuration),
      ),
    );
    const transition = first.clip.transition || "crossfade";

    if (transition === "slide") {
      drawSource(ctx, first, time, width, height, 1, -width * progress);
      drawSource(ctx, second, time, width, height, 1, width * (1 - progress));
    } else if (transition === "fade") {
      if (progress < .5) {
        drawSource(ctx, first, time, width, height, 1 - progress * 2, 0);
      } else {drawSource(
          ctx,
          second,
          time,
          width,
          height,
          (progress - .5) * 2,
          0,
        );}
    } else {
      drawSource(ctx, first, time, width, height, 1, 0);
      drawSource(ctx, second, time, width, height, progress, 0);
    }
  }, [timeline, drawSource]);

  const drawPreview = React.useCallback((time) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== 360) {
      canvas.width = 360;
      canvas.height = 640;
    }
    renderFrame(time, canvas);
  }, [renderFrame]);

  React.useEffect(() => {
    drawPreview(Math.min(currentTime, timeline.total));
  }, [clips, currentTime, timeline.total, drawPreview]);

  const getBgmUrl = React.useCallback((id) => {
    if (id === "none") return null;
    if (id === "custom") return customBgm?.url || null;
    if (!generatedMusicUrls.current.has(id)) {
      const url = URL.createObjectURL(bmdWavBlob(id));
      generatedMusicUrls.current.set(id, url);
    }
    return generatedMusicUrls.current.get(id);
  }, [customBgm]);

  const ensureAudioGraph = React.useCallback(async () => {
    if (audioGraphRef.current) {
      if (audioGraphRef.current.context.state === "suspended") {
        await audioGraphRef.current.context.resume();
      }
      return audioGraphRef.current;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    const context = new AudioContextClass();
    const recordDestination = context.createMediaStreamDestination();
    const graph = {
      context,
      recordDestination,
      mediaNodes: new Map(),
      bgmNode: null,
    };
    audioGraphRef.current = graph;
    await context.resume();
    return graph;
  }, []);

  const ensureMediaAudioNode = React.useCallback(async (clip) => {
    if (!clip || clip.type !== "video") return null;
    const graph = await ensureAudioGraph();
    const element = mediaRefs.current.get(clip.id);
    if (!graph || !element) return null;
    if (graph.mediaNodes.has(clip.id)) return graph.mediaNodes.get(clip.id);
    try {
      element.muted = false;
      element.volume = 1;
      const source = graph.context.createMediaElementSource(element);
      const previewGain = graph.context.createGain();
      const recordGain = graph.context.createGain();
      source.connect(previewGain);
      previewGain.connect(graph.context.destination);
      source.connect(recordGain);
      recordGain.connect(graph.recordDestination);
      previewGain.gain.value = 0;
      recordGain.gain.value = 0;
      const node = { source, previewGain, recordGain };
      graph.mediaNodes.set(clip.id, node);
      return node;
    } catch (error) {
      console.warn("Video audio graph unavailable", error);
      return null;
    }
  }, [ensureAudioGraph]);

  const ensureBgmNode = React.useCallback(async () => {
    const graph = await ensureAudioGraph();
    const element = bgmElementRef.current;
    if (!graph || !element || !element.src) return null;
    if (graph.bgmNode) return graph.bgmNode;
    try {
      element.muted = false;
      element.volume = 1;
      const source = graph.context.createMediaElementSource(element);
      const previewGain = graph.context.createGain();
      const recordGain = graph.context.createGain();
      source.connect(previewGain);
      previewGain.connect(graph.context.destination);
      source.connect(recordGain);
      recordGain.connect(graph.recordDestination);
      previewGain.gain.value = 0;
      recordGain.gain.value = 0;
      graph.bgmNode = { source, previewGain, recordGain };
      return graph.bgmNode;
    } catch (error) {
      console.warn("BGM audio graph unavailable", error);
      return null;
    }
  }, [ensureAudioGraph]);

  const syncMedia = React.useCallback(async (time, mode) => {
    const activeVideoIds = new Set();
    const activeItems = timeline.items.filter((item) =>
      item.clip.type === "video" && time >= item.start - .05 &&
      time <= item.end + .05
    );

    for (const item of activeItems) {
      const clip = item.clip;
      const element = mediaRefs.current.get(clip.id);
      if (!element) continue;
      activeVideoIds.add(clip.id);
      const wanted = Math.max(
        clip.trimStart || 0,
        Math.min(
          clip.trimEnd || clip.sourceDuration || 0,
          (clip.trimStart || 0) + time - item.start,
        ),
      );
      if (
        Number.isFinite(wanted) &&
        Math.abs((element.currentTime || 0) - wanted) > .18
      ) {
        try {
          element.currentTime = wanted;
        } catch (e) {}
      }
      if (mode !== "paused") element.play().catch(() => {});
      const node = await ensureMediaAudioNode(clip);
      if (node) {
        const gain = clip.originalAudio ? (clip.volume ?? .75) : 0;
        node.previewGain.gain.value = mode === "preview" ? gain : 0;
        node.recordGain.gain.value = mode === "export" ? gain : 0;
      } else {
        element.muted = !clip.originalAudio || mode === "export";
        element.volume = clip.volume ?? .75;
      }
    }

    mediaRefs.current.forEach((element, id) => {
      if (!activeVideoIds.has(id)) {
        element.pause();
        const node = audioGraphRef.current?.mediaNodes.get(id);
        if (node) {
          node.previewGain.gain.value = 0;
          node.recordGain.gain.value = 0;
        }
      }
    });

    const bgm = bgmElementRef.current;
    if (bgm && bgm.src && bgmId !== "none") {
      const duration = Number.isFinite(bgm.duration) && bgm.duration > 0
        ? bgm.duration
        : 16;
      const wanted = time % duration;
      if (Math.abs((bgm.currentTime || 0) - wanted) > .25) {
        try {
          bgm.currentTime = wanted;
        } catch (e) {}
      }
      bgm.loop = true;
      if (mode !== "paused") bgm.play().catch(() => {});
      else bgm.pause();
      const node = await ensureBgmNode();
      if (node) {
        node.previewGain.gain.value = mode === "preview" ? bgmVolume : 0;
        node.recordGain.gain.value = mode === "export" ? bgmVolume : 0;
      } else {
        bgm.volume = mode === "preview" ? bgmVolume : 0;
      }
    } else if (bgm) {
      bgm.pause();
      const node = audioGraphRef.current?.bgmNode;
      if (node) {
        node.previewGain.gain.value = 0;
        node.recordGain.gain.value = 0;
      }
    }
  }, [timeline, bgmId, bgmVolume, ensureMediaAudioNode, ensureBgmNode]);

  const stopPlayback = React.useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    setPlaying(false);
    playingRef.current = false;
    syncMedia(currentTimeRef.current, "paused");
  }, [syncMedia]);

  const togglePlayback = async () => {
    if (!clips.length) return;
    if (playingRef.current) {
      stopPlayback();
      return;
    }
    await ensureAudioGraph();
    const start = currentTimeRef.current >= timeline.total - .05
      ? 0
      : currentTimeRef.current;
    setCurrentTime(start);
    currentTimeRef.current = start;
    playClockRef.current = { startedAt: performance.now(), baseTime: start };
    setPlaying(true);
    playingRef.current = true;
    await syncMedia(start, "preview");

    const tick = (now) => {
      if (!playingRef.current) return;
      const nextTime = playClockRef.current.baseTime +
        (now - playClockRef.current.startedAt) / 1000;
      if (nextTime >= timeline.total) {
        setCurrentTime(timeline.total);
        currentTimeRef.current = timeline.total;
        drawPreview(timeline.total);
        stopPlayback();
        return;
      }
      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      drawPreview(nextTime);
      syncMedia(nextTime, "preview");
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  };

  const seekTo = async (value) => {
    stopPlayback();
    const next = Math.max(0, Math.min(timeline.total, Number(value)));
    currentTimeRef.current = next;
    setCurrentTime(next);
    await syncMedia(next, "paused");
    timeline.items.filter((item) =>
      item.clip.type === "video" && next >= item.start && next <= item.end
    ).forEach((item) => {
      const element = mediaRefs.current.get(item.clip.id);
      if (element) {
        const wanted = (item.clip.trimStart || 0) + next - item.start;
        try {
          element.currentTime = wanted;
        } catch (e) {}
      }
    });
    setTimeout(() => drawPreview(next), 80);
  };

  const selectClip = (clip) => {
    setSelectedId(clip.id);
    const item = timeline.items.find((entry) => entry.clip.id === clip.id);
    if (
      !item || currentTimeRef.current >= item.start &&
        currentTimeRef.current <= item.end
    ) return;
    seekTo(Math.min(item.end, item.start + .02));
  };

  const startImageDrag = (event) => {
    if (selectedClip?.type !== "image") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    imageDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: selectedClip.imageOffsetX ?? 0,
      offsetY: selectedClip.imageOffsetY ?? 0,
    };
    setImageDragging(true);
  };

  const moveImageDrag = (event) => {
    const drag = imageDragRef.current;
    if (!drag || selectedClip?.type !== "image") return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const nextX = Math.max(
      -1,
      Math.min(
        1,
        drag.offsetX + (event.clientX - drag.startX) / (bounds.width / 2),
      ),
    );
    const nextY = Math.max(
      -1,
      Math.min(
        1,
        drag.offsetY + (event.clientY - drag.startY) / (bounds.height / 2),
      ),
    );
    updateClip(selectedClip.id, {
      imageOffsetX: nextX,
      imageOffsetY: nextY,
    });
  };

  const endImageDrag = (event) => {
    if (!imageDragRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    imageDragRef.current = null;
    setImageDragging(false);
  };

  const addFiles = (files) => {
    const incoming = Array.from(files || []);
    const accepted = incoming.filter((file) =>
      (file.type.startsWith("image/") || file.type.startsWith("video/")) &&
      file.size <= 500 * 1024 * 1024
    ).slice(0, Math.max(0, 12 - clips.length));
    if (incoming.length && !accepted.length) {
      alert(
        "지원되는 사진·영상 파일인지, 파일 크기가 500MB 이하인지 확인해주세요.",
      );
    }
    if (!accepted.length) return;
    const added = accepted.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      const isVideo = file.type.startsWith("video/");
      return {
        id: bmdVideoId(),
        file,
        url,
        name: file.name,
        type: isVideo ? "video" : "image",
        duration: isVideo ? 5 : 3,
        sourceDuration: isVideo ? 5 : null,
        trimStart: 0,
        trimEnd: isVideo ? 5 : null,
        transition: "crossfade",
        transitionDuration: .5,
        originalAudio: true,
        volume: .75,
        imageScale: 1,
        imageOffsetX: 0,
        imageOffsetY: 0,
      };
    });
    setClips((list) => [...list, ...added]);
    if (!selectedId) setSelectedId(added[0].id);
  };

  const deleteClip = (id) => {
    stopPlayback();
    const clip = clips.find((item) => item.id === id);
    if (clip?.url) {
      URL.revokeObjectURL(clip.url);
      objectUrls.current.delete(clip.url);
    }
    imageRefs.current.delete(id);
    mediaRefs.current.delete(id);
    const next = clips.filter((item) => item.id !== id);
    setClips(next);
    if (selectedId === id) setSelectedId(next[0]?.id || null);
    setCurrentTime(0);
  };

  const moveClip = (id, direction) => {
    setClips((list) => {
      const index = list.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setCurrentTime(0);
  };

  const selectBgm = (id) => {
    stopPlayback();
    setBgmId(id);
    const nextUrl = getBgmUrl(id);
    if (bgmElementRef.current) {
      bgmElementRef.current.pause();
      bgmElementRef.current.src = nextUrl || "";
      bgmElementRef.current.load();
    }
  };

  const previewBgm = async (event, id) => {
    event.stopPropagation();
    if (id !== bgmId) selectBgm(id);
    const url = getBgmUrl(id);
    if (!url || !bgmElementRef.current) return;
    await ensureAudioGraph();
    bgmElementRef.current.src = url;
    bgmElementRef.current.currentTime = 0;
    const node = await ensureBgmNode();
    if (node) node.previewGain.gain.value = bgmVolume;
    else bgmElementRef.current.volume = bgmVolume;
    bgmElementRef.current.play().catch(() => {});
    setTimeout(() => {
      if (!playingRef.current) {
        bgmElementRef.current?.pause();
        if (node) node.previewGain.gain.value = 0;
      }
    }, 5000);
  };

  const chooseMusicFile = (file) => {
    if (!file) return;
    if (customBgm?.url) {
      URL.revokeObjectURL(customBgm.url);
      objectUrls.current.delete(customBgm.url);
    }
    const url = URL.createObjectURL(file);
    objectUrls.current.add(url);
    setCustomBgm({ name: file.name, url });
    setBgmId("custom");
    if (bgmElementRef.current) {
      bgmElementRef.current.src = url;
      bgmElementRef.current.load();
    }
  };

  const handleVideoMetadata = (clip, element) => {
    mediaRefs.current.set(clip.id, element);
    const duration = Number.isFinite(element.duration)
      ? Math.min(element.duration, 60)
      : 5;
    if (Math.abs((clip.sourceDuration || 0) - duration) > .05) {
      updateClip(clip.id, {
        sourceDuration: duration,
        duration,
        trimEnd: duration,
      });
    }
  };

  const exportVideo = async () => {
    if (!clips.length || exportState) return;
    if (timeline.total > 60) {
      alert(
        "검토용 버전에서는 안정적인 출력을 위해 전체 영상을 60초 이내로 맞춰주세요.",
      );
      return;
    }
    stopPlayback();
    exportCancelRef.current = false;
    const dimensions = quality === "1080"
      ? { width: 1080, height: 1920, bitrate: 8500000 }
      : { width: 720, height: 1280, bitrate: 4500000 };
    const mimeOptions = [
      { mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: "mp4" },
      { mime: "video/mp4", ext: "mp4" },
      { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
      { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
      { mime: "video/webm", ext: "webm" },
    ];
    const output = mimeOptions.find((option) =>
      window.MediaRecorder?.isTypeSupported(option.mime)
    );
    if (!output || !canvasRef.current?.captureStream) {
      alert(
        "이 브라우저에서는 영상 출력 기능을 사용할 수 없습니다. 최신 Chrome 또는 Edge를 이용해주세요.",
      );
      return;
    }

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = dimensions.width;
    exportCanvas.height = dimensions.height;
    const stream = exportCanvas.captureStream(30);
    const graph = await ensureAudioGraph();
    if (graph?.recordDestination.stream.getAudioTracks()[0]) {
      stream.addTrack(graph.recordDestination.stream.getAudioTracks()[0]);
    }

    const chunks = [];
    let recorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: output.mime,
        videoBitsPerSecond: dimensions.bitrate,
        audioBitsPerSecond: 128000,
      });
    } catch (error) {
      alert(
        "영상 변환기를 시작하지 못했습니다. 브라우저를 다시 실행한 뒤 시도해주세요.",
      );
      return;
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      setExportState(null);
      alert("영상 출력 중 오류가 발생했습니다.");
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      syncMedia(0, "paused");
      if (!exportCancelRef.current && chunks.length) {
        const blob = new Blob(chunks, { type: output.mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `bmd-reels-${
          new Date().toISOString().slice(0, 10)
        }.${output.ext}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
      setExportState(null);
      recorderRef.current = null;
    };

    const total = timeline.total;
    setExportState({
      progress: 0,
      status: "미디어 준비 중…",
      format: output.ext.toUpperCase(),
    });
    await syncMedia(0, "export");
    recorder.start(500);
    const startedAt = performance.now();

    const step = async (now) => {
      if (exportCancelRef.current) {
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      const time = Math.min(total, (now - startedAt) / 1000);
      renderFrame(time, exportCanvas);
      await syncMedia(time, "export");
      const progress = total ? time / total : 1;
      setExportState({
        progress,
        status: progress < .78
          ? "영상과 전환 효과 합성 중…"
          : "웹용 영상 최적화 중…",
        format: output.ext.toUpperCase(),
      });
      if (time >= total) {
        setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, 300);
        return;
      }
      animationRef.current = requestAnimationFrame(step);
    };
    animationRef.current = requestAnimationFrame(step);
  };

  const cancelExport = () => {
    exportCancelRef.current = true;
    cancelAnimationFrame(animationRef.current);
    if (recorderRef.current?.state !== "inactive") recorderRef.current.stop();
  };

  const bgmUrl = getBgmUrl(bgmId);

  return (
    <>
      <div className="video-editor-dev-note">
        검토용 영상 편집 프로토타입 · 모든 미디어는 이 브라우저 안에서만
        처리됩니다
      </div>
      <div
        className="video-editor"
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <aside className="video-media-panel">
          <div className="video-panel-heading">
            <span>미디어</span>
            <span>{clips.length} / 12</span>
          </div>
          <button
            className="video-add-button"
            type="button"
            onClick={() => mediaInputRef.current?.click()}
          >
            ＋ 사진·영상 추가
          </button>
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="video-add-note">
            파일을 이 화면으로 끌어다 놓아도 됩니다
          </div>

          {!clips.length
            ? (
              <div className="video-empty">
                사진이나 촬영 영상을 추가하면<br />여기에 재생 순서가
                표시됩니다.
              </div>
            )
            : clips.map((clip, index) => (
              <React.Fragment key={clip.id}>
                <div
                  className={`video-clip-row ${
                    selectedId === clip.id ? "is-selected" : ""
                  }`}
                  onClick={() => selectClip(clip)}
                >
                  <div className="video-clip-top">
                    <div className="video-clip-thumb">
                      {clip.type === "image"
                        ? <img src={clip.url} alt="" />
                        : <video src={clip.url} muted preload="metadata" />}
                      <span className="video-clip-type">
                        {clip.type === "video" ? "영상" : "사진"}
                      </span>
                    </div>
                    <div className="video-clip-info">
                      <div className="video-clip-name">{clip.name}</div>
                      <div className="video-clip-meta">
                        {bmdVideoTime(bmdClipDuration(clip))} ·{" "}
                        {clip.type === "video"
                          ? (clip.originalAudio ? "소리 켜짐" : "소리 꺼짐")
                          : "세로 채우기"}
                      </div>
                    </div>
                    <div className="video-clip-actions">
                      <button
                        className="video-icon-button"
                        type="button"
                        title="앞으로"
                        disabled={index === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveClip(clip.id, -1);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        className="video-icon-button"
                        type="button"
                        title="뒤로"
                        disabled={index === clips.length - 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveClip(clip.id, 1);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        className="video-icon-button danger"
                        type="button"
                        title="삭제"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteClip(clip.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
                {index < clips.length - 1 && (
                  <div className="video-transition-label">
                    ↕ {{
                      crossfade: "디졸브",
                      fade: "페이드",
                      slide: "좌우 밀기",
                      none: "효과 없음",
                    }[clip.transition]} {clip.transition !== "none" &&
                      `${clip.transitionDuration.toFixed(1)}초`}
                  </div>
                )}
              </React.Fragment>
            ))}
        </aside>

        <section className="video-preview-panel">
          <div className="video-preview-toolbar">
            <button className="video-format-chip active" type="button">
              9:16 릴스
            </button>
            <button className="video-format-chip" type="button">
              세로 채우기
            </button>
            <span className="video-total-time">
              총 {bmdVideoTime(timeline.total)}
            </span>
          </div>
          <div className="video-preview-stage-wrap">
            <div
              className={`video-canvas-shell ${
                selectedClip?.type === "image" ? "can-adjust-image" : ""
              } ${imageDragging ? "is-dragging" : ""}`}
              onPointerDown={startImageDrag}
              onPointerMove={moveImageDrag}
              onPointerUp={endImageDrag}
              onPointerCancel={endImageDrag}
            >
              <canvas
                ref={canvasRef}
                className="video-preview-canvas"
                width="360"
                height="640"
              />
              {!clips.length && (
                <div className="video-drop-hint">
                  <strong>
                    {dragOver ? "여기에 놓으세요" : "릴스 미리보기"}
                  </strong>
                  <span>사진과 영상을 추가해주세요</span>
                </div>
              )}
              {clips.length > 0 && selectedClip?.type === "image" && (
                <div className="video-image-drag-badge">
                  드래그해서 사진 위치 조정
                </div>
              )}
            </div>
          </div>
          <div className="video-transport">
            <button
              className="video-play-button"
              type="button"
              disabled={!clips.length}
              onClick={togglePlayback}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <input
              className="video-scrubber"
              type="range"
              min="0"
              max={Math.max(.1, timeline.total)}
              step="0.01"
              value={Math.min(currentTime, timeline.total)}
              disabled={!clips.length}
              onChange={(event) => seekTo(event.target.value)}
            />
            <span className="video-timecode">
              {bmdVideoTime(currentTime)} / {bmdVideoTime(timeline.total)}
            </span>
          </div>
        </section>

        <aside className="video-settings-panel">
          <div className="video-panel-heading">
            <span>영상 설정</span>
            <span>{resellerName}</span>
          </div>

          <section className="video-settings-section">
            <div className="video-settings-title">출력 화질</div>
            <div className="video-segmented">
              <button
                className={quality === "720" ? "active" : ""}
                type="button"
                onClick={() => setQuality("720")}
              >
                720p 빠르게
              </button>
              <button
                className={quality === "1080" ? "active" : ""}
                type="button"
                onClick={() => setQuality("1080")}
              >
                1080p 고화질
              </button>
            </div>
          </section>

          {selectedClip && (
            <section className="video-settings-section">
              <div className="video-settings-title">
                선택한 {selectedClip.type === "video" ? "영상" : "사진"}
              </div>
              {selectedClip.type === "image"
                ? (
                  <>
                    <div className="video-control-row">
                      <span className="video-control-label">표시 시간</span>
                      <input
                        className="video-number-input"
                        type="number"
                        min="1"
                        max="10"
                        step=".5"
                        value={selectedClip.duration}
                        onChange={(event) =>
                          updateClip(selectedClip.id, {
                            duration: Math.max(
                              1,
                              Math.min(10, Number(event.target.value)),
                            ),
                          })}
                      />
                    </div>
                    <label className="video-image-slider">
                      <span>
                        <b>확대/축소</b>
                        <em>{(selectedClip.imageScale ?? 1).toFixed(2)}×</em>
                      </span>
                      <input
                        className="video-range"
                        type="range"
                        min=".2"
                        max="3"
                        step=".01"
                        value={selectedClip.imageScale ?? 1}
                        onChange={(event) =>
                          updateClip(selectedClip.id, {
                            imageScale: Number(event.target.value),
                          })}
                      />
                    </label>
                    <label className="video-image-slider">
                      <span>
                        <b>좌우 위치</b>
                        <em>
                          {Math.round((selectedClip.imageOffsetX ?? 0) * 100)}
                        </em>
                      </span>
                      <input
                        className="video-range"
                        type="range"
                        min="-1"
                        max="1"
                        step=".01"
                        value={selectedClip.imageOffsetX ?? 0}
                        onChange={(event) =>
                          updateClip(selectedClip.id, {
                            imageOffsetX: Number(event.target.value),
                          })}
                      />
                    </label>
                    <label className="video-image-slider">
                      <span>
                        <b>상하 위치</b>
                        <em>
                          {Math.round((selectedClip.imageOffsetY ?? 0) * 100)}
                        </em>
                      </span>
                      <input
                        className="video-range"
                        type="range"
                        min="-1"
                        max="1"
                        step=".01"
                        value={selectedClip.imageOffsetY ?? 0}
                        onChange={(event) =>
                          updateClip(selectedClip.id, {
                            imageOffsetY: Number(event.target.value),
                          })}
                      />
                    </label>
                    <div className="video-image-help">
                      20%까지 줄일 수 있으며, 미리보기의 사진을 마우스로 끌어서
                      위치를 바꿀 수도 있습니다.
                    </div>
                    <button
                      className="video-image-reset"
                      type="button"
                      onClick={() =>
                        updateClip(selectedClip.id, {
                          imageScale: 1,
                          imageOffsetX: 0,
                          imageOffsetY: 0,
                        })}
                    >
                      사진 위치·크기 초기화
                    </button>
                  </>
                )
                : (
                  <>
                    <div className="video-control-row">
                      <span className="video-control-label">시작 위치</span>
                      <input
                        className="video-number-input"
                        type="number"
                        min="0"
                        max={Math.max(0, selectedClip.trimEnd - .2)}
                        step=".1"
                        value={(selectedClip.trimStart || 0).toFixed(1)}
                        onChange={(event) =>
                          updateClip(selectedClip.id, {
                            trimStart: Math.max(
                              0,
                              Math.min(
                                selectedClip.trimEnd - .2,
                                Number(event.target.value),
                              ),
                            ),
                          })}
                      />
                    </div>
                    <div className="video-control-row">
                      <span className="video-control-label">끝 위치</span>
                      <input
                        className="video-number-input"
                        type="number"
                        min={(selectedClip.trimStart || 0) + .2}
                        max={selectedClip.sourceDuration}
                        step=".1"
                        value={(selectedClip.trimEnd ||
                          selectedClip.sourceDuration).toFixed(1)}
                        onChange={(event) =>
                          updateClip(selectedClip.id, {
                            trimEnd: Math.max(
                              (selectedClip.trimStart || 0) + .2,
                              Math.min(
                                selectedClip.sourceDuration,
                                Number(event.target.value),
                              ),
                            ),
                          })}
                      />
                    </div>
                    <div className="video-control-row">
                      <span className="video-control-label">원본 소리</span>
                      <button
                        className={`video-toggle ${
                          selectedClip.originalAudio ? "active" : ""
                        }`}
                        type="button"
                        aria-label="원본 소리 켜기 또는 끄기"
                        onClick={() =>
                          updateClip(selectedClip.id, {
                            originalAudio: !selectedClip.originalAudio,
                          })}
                      />
                    </div>
                    <input
                      className="video-range"
                      type="range"
                      min="0"
                      max="1"
                      step=".01"
                      value={selectedClip.volume ?? .75}
                      disabled={!selectedClip.originalAudio}
                      onChange={(event) =>
                        updateClip(selectedClip.id, {
                          volume: Number(event.target.value),
                        })}
                    />
                    <div className="video-range-caption">
                      <span>작게</span>
                      <span>
                        {Math.round((selectedClip.volume ?? .75) * 100)}%
                      </span>
                    </div>
                  </>
                )}
            </section>
          )}

          {selectedClip &&
            clips.findIndex((clip) => clip.id === selectedClip.id) <
              clips.length - 1 &&
            (
              <section className="video-settings-section">
                <div className="video-settings-title">다음 장면 전환</div>
                <div className="video-control-row">
                  <span className="video-control-label">효과</span>
                  <select
                    className="video-select"
                    value={selectedClip.transition}
                    onChange={(event) =>
                      updateClip(selectedClip.id, {
                        transition: event.target.value,
                      })}
                  >
                    <option value="crossfade">디졸브</option>
                    <option value="fade">페이드</option>
                    <option value="slide">좌우 밀기</option>
                    <option value="none">효과 없음</option>
                  </select>
                </div>
                {selectedClip.transition !== "none" && (
                  <div className="video-control-row">
                    <span className="video-control-label">효과 길이</span>
                    <input
                      className="video-number-input"
                      type="number"
                      min=".2"
                      max="1.2"
                      step=".1"
                      value={selectedClip.transitionDuration}
                      onChange={(event) =>
                        updateClip(selectedClip.id, {
                          transitionDuration: Math.max(
                            .2,
                            Math.min(1.2, Number(event.target.value)),
                          ),
                        })}
                    />
                  </div>
                )}
              </section>
            )}

          <section className="video-settings-section">
            <div className="video-settings-title">배경음악</div>
            {BMD_VIDEO_TRACKS.map((track) => (
              <div
                key={track.id}
                className={`video-music-card ${
                  bgmId === track.id ? "active" : ""
                }`}
                role="button"
                tabIndex="0"
                onClick={() => selectBgm(track.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    selectBgm(
                      track.id,
                    );
                  }
                }}
              >
                <span className="video-music-icon">{track.icon}</span>
                <span className="video-music-info">
                  <span className="video-music-name">{track.name}</span>
                  <span className="video-music-meta">{track.meta}</span>
                </span>
                {track.id !== "none" && (
                  <button
                    className="video-music-play"
                    type="button"
                    aria-label={`${track.name} 미리 듣기`}
                    onClick={(event) => previewBgm(event, track.id)}
                  >
                    ▶
                  </button>
                )}
              </div>
            ))}
            {customBgm && (
              <div
                className={`video-music-card ${
                  bgmId === "custom" ? "active" : ""
                }`}
                role="button"
                tabIndex="0"
                onClick={() => selectBgm("custom")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    selectBgm("custom");
                  }
                }}
              >
                <span className="video-music-icon">♪</span>
                <span className="video-music-info">
                  <span className="video-music-name">{customBgm.name}</span>
                  <span className="video-music-meta">내 음악 파일</span>
                </span>
              </div>
            )}
            <button
              className="video-music-upload"
              type="button"
              onClick={() => musicInputRef.current?.click()}
            >
              내 MP3·WAV 업로드
            </button>
            <input
              ref={musicInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(event) => {
                chooseMusicFile(event.target.files[0]);
                event.target.value = "";
              }}
            />
            <input
              className="video-range"
              type="range"
              min="0"
              max="1"
              step=".01"
              value={bgmVolume}
              disabled={bgmId === "none"}
              onChange={(event) => setBgmVolume(Number(event.target.value))}
            />
            <div className="video-range-caption">
              <span>배경음악 작게</span>
              <span>{Math.round(bgmVolume * 100)}%</span>
            </div>
          </section>

          <div className="video-export-wrap">
            <button
              className="video-export-button"
              type="button"
              disabled={!clips.length || !!exportState}
              onClick={exportVideo}
            >
              {exportState ? "영상 만드는 중…" : "웹 영상 만들기"}
            </button>
            <div className="video-export-note">
              {quality === "1080" ? "1080 × 1920" : "720 × 1280"}{" "}
              · 30fps<br />브라우저 지원 시 MP4, 그 외 WebM으로 저장됩니다
            </div>
          </div>
        </aside>

        {clips.filter((clip) => clip.type === "video").map((clip) => (
          <video
            key={`media-${clip.id}`}
            ref={(element) => {
              if (element) mediaRefs.current.set(clip.id, element);
            }}
            src={clip.url}
            preload="auto"
            playsInline
            style={{ display: "none" }}
            onLoadedMetadata={(event) =>
              handleVideoMetadata(clip, event.currentTarget)}
            onSeeked={() => drawPreview(currentTimeRef.current)}
          />
        ))}
        <audio
          ref={bgmElementRef}
          src={bgmUrl || ""}
          preload="auto"
          loop
          style={{ display: "none" }}
        />
      </div>

      {exportState && (
        <div className="video-export-overlay">
          <div className="video-export-dialog">
            <div className="video-export-title">
              릴스 영상을 만들고 있습니다
            </div>
            <div className="video-export-copy">
              실제 재생 속도로 장면과 소리를 합성합니다. 이 창을 닫지 마세요.
            </div>
            <div className="video-progress-track">
              <div
                className="video-progress-fill"
                style={{ width: `${Math.round(exportState.progress * 100)}%` }}
              />
            </div>
            <div className="video-progress-meta">
              <span>{exportState.status}</span>
              <span>
                {Math.round(exportState.progress * 100)}% · {exportState.format}
              </span>
            </div>
            <button
              className="video-cancel-button"
              type="button"
              onClick={cancelExport}
            >
              변환 취소
            </button>
          </div>
        </div>
      )}
    </>
  );
}
