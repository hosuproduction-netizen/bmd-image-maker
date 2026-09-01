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

const BMD_VIDEO_LAYOUTS = [
  { id: "split", label: "사진 + 글 나누기", icon: "▣" },
  { id: "overlay", label: "사진 위에 글쓰기", icon: "▤" },
  { id: "media", label: "글 없이 사진만", icon: "▧" },
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

function bmdReorderClips(clips, id, dropIndex) {
  const fromIndex = clips.findIndex((item) => item.id === id);
  if (fromIndex < 0) return clips;
  const next = [...clips];
  const [moving] = next.splice(fromIndex, 1);
  let targetIndex = Math.max(0, Math.min(clips.length, dropIndex));
  if (fromIndex < targetIndex) targetIndex -= 1;
  next.splice(Math.max(0, Math.min(next.length, targetIndex)), 0, moving);
  return next;
}

function bmdTimelineTrimPatch(clip, edge, deltaSeconds) {
  const snap = (value) => Math.round(value * 10) / 10;
  if (clip.type === "image") {
    const direction = edge === "left" ? -1 : 1;
    return {
      duration: Math.max(
        1,
        Math.min(10, snap((clip.duration || 3) + deltaSeconds * direction)),
      ),
    };
  }
  const sourceDuration = Math.max(
    .2,
    clip.sourceDuration || clip.duration || 1,
  );
  const trimStart = clip.trimStart || 0;
  const trimEnd = clip.trimEnd || sourceDuration;
  if (edge === "left") {
    return {
      trimStart: Math.max(
        0,
        Math.min(trimEnd - .2, snap(trimStart + deltaSeconds)),
      ),
    };
  }
  return {
    trimEnd: Math.max(
      trimStart + .2,
      Math.min(sourceDuration, snap(trimEnd + deltaSeconds)),
    ),
  };
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

function bmdWrapCanvasText(ctx, text, maxWidth, maxLines) {
  const lines = [];
  String(text || "").split("\n").forEach((paragraph) => {
    if (!paragraph) {
      if (lines.length < maxLines) lines.push("");
      return;
    }
    let line = "";
    Array.from(paragraph).forEach((character) => {
      const next = line + character;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line.trimEnd());
        line = character.trimStart();
      } else {
        line = next;
      }
    });
    if (line && lines.length < maxLines) lines.push(line.trimEnd());
  });
  if (lines.length > maxLines) lines.length = maxLines;
  return lines;
}

function bmdSceneTextLayout(ctx, clip, width, height, layout, branding) {
  if (layout === "media") return null;
  const accent = clip.accentColor || "#ffffff";
  const align = clip.textAlign || "center";
  const padding = width * .08;
  const textWidth = width - padding * 2;
  const headlineSize = Math.round(width * .075 * (clip.headSizeScale ?? 1));
  const bodySize = Math.round(width * .034 * (clip.bodySizeScale ?? 1));
  const headlineLineHeight = headlineSize * 1.18;
  const bodyLineHeight = bodySize * 1.55;

  ctx.font = `900 ${headlineSize}px Pretendard, 'Noto Sans KR', sans-serif`;
  const headlineLines = bmdWrapCanvasText(
    ctx,
    clip.headline,
    textWidth,
    layout === "split" ? 3 : 4,
  );
  ctx.font = `500 ${bodySize}px Pretendard, 'Noto Sans KR', sans-serif`;
  const bodyLines = bmdWrapCanvasText(ctx, clip.body, textWidth, 5);
  const gap = headlineLines.length && bodyLines.length ? height * .022 : 0;
  const totalHeight = headlineLines.length * headlineLineHeight + gap +
    bodyLines.length * bodyLineHeight;
  const areaTop = layout === "split" ? height * .6 : height * .48;
  const hasBranding = Boolean(branding?.showBranding);
  const areaBottom = layout === "split"
    ? height * (hasBranding ? .93 : .97)
    : height * (hasBranding ? .88 : .92);
  const autoHeadlineY = areaTop +
    Math.max(0, (areaBottom - areaTop - totalHeight) / 2);
  const autoBodyY = autoHeadlineY +
    headlineLines.length * headlineLineHeight + gap;
  const autoX = align === "left"
    ? padding
    : align === "right"
    ? width - padding
    : width / 2;
  const headlineX = clip.headPos ? clip.headPos.x * width : autoX;
  const headlineY = clip.headPos ? clip.headPos.y * height : autoHeadlineY;
  const bodyX = clip.bodyPos ? clip.bodyPos.x * width : autoX;
  const bodyY = clip.bodyPos ? clip.bodyPos.y * height : autoBodyY;
  const textBounds = (lines, font, anchorX, anchorY, lineHeight) => {
    ctx.font = font;
    const measuredWidth = lines.reduce(
      (largest, line) => Math.max(largest, ctx.measureText(line).width),
      0,
    );
    const left = align === "left"
      ? anchorX
      : align === "right"
      ? anchorX - measuredWidth
      : anchorX - measuredWidth / 2;
    return lines.length
      ? {
        x: left - 6,
        y: anchorY - 6,
        width: measuredWidth + 12,
        height: lines.length * lineHeight + 12,
      }
      : null;
  };

  return {
    accent,
    align,
    headlineSize,
    bodySize,
    headlineLineHeight,
    bodyLineHeight,
    headlineLines,
    bodyLines,
    headlineX,
    headlineY,
    bodyX,
    bodyY,
    headlineBounds: textBounds(
      headlineLines,
      `900 ${headlineSize}px Pretendard, 'Noto Sans KR', sans-serif`,
      headlineX,
      headlineY,
      headlineLineHeight,
    ),
    bodyBounds: textBounds(
      bodyLines,
      `500 ${bodySize}px Pretendard, 'Noto Sans KR', sans-serif`,
      bodyX,
      bodyY,
      bodyLineHeight,
    ),
  };
}

function bmdDrawSceneText(ctx, clip, width, height, layout, branding) {
  const textLayout = bmdSceneTextLayout(
    ctx,
    clip,
    width,
    height,
    layout,
    branding,
  );
  if (!textLayout) return;
  const {
    accent,
    align,
    headlineSize,
    bodySize,
    headlineLineHeight,
    bodyLineHeight,
    headlineLines,
    bodyLines,
    headlineX,
    headlineY,
    bodyX,
    bodyY,
  } = textLayout;

  ctx.textAlign = align;
  ctx.textBaseline = "top";
  headlineLines.forEach((line, index) => {
    ctx.font = `900 ${headlineSize}px Pretendard, 'Noto Sans KR', sans-serif`;
    if (layout === "overlay") {
      ctx.fillStyle = "rgba(0,0,0,.38)";
      ctx.fillText(
        line,
        headlineX + 2,
        headlineY + index * headlineLineHeight + 2,
      );
    }
    ctx.fillStyle = accent;
    ctx.fillText(line, headlineX, headlineY + index * headlineLineHeight);
  });
  bodyLines.forEach((line, index) => {
    ctx.font = `500 ${bodySize}px Pretendard, 'Noto Sans KR', sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line, bodyX, bodyY + index * bodyLineHeight);
  });
}

function bmdDrawBrandingBar(ctx, clip, width, height, branding) {
  if (!branding?.showBranding) return;
  const stripHeight = Math.round(height * .042);
  const padding = width * .048;
  ctx.fillStyle = "rgba(8,8,8,.9)";
  ctx.fillRect(0, height - stripHeight, width, stripHeight);
  ctx.fillStyle = `${clip.accentColor || "#ffffff"}55`;
  ctx.fillRect(0, height - stripHeight, width, Math.max(1, height * .0015));
  ctx.font = `700 ${
    Math.max(6, Math.round(width * .018))
  }px Pretendard, 'Noto Sans KR', sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(
    branding.company || "하이픽셀플러스",
    padding,
    height - stripHeight / 2,
  );
  ctx.textAlign = "right";
  ctx.fillText(
    "Blackmagic Design Authorized Reseller",
    width - padding,
    height - stripHeight / 2,
  );
}

function bmdDrawProjectLogo(ctx, width, height, branding, logoImage) {
  if (!branding?.logoUrl || !logoImage) return;
  const scale = branding.logoScale ?? 1;
  const opacity = branding.logoOpacity ?? 1;
  const position = branding.logoPos || "top-right";
  const padding = Math.round(width * .04);
  const maxWidth = Math.round(width * .18 * scale);
  const maxHeight = Math.round(width * .09 * scale);
  const imageWidth = logoImage.naturalWidth || logoImage.width;
  const imageHeight = logoImage.naturalHeight || logoImage.height;
  if (!imageWidth || !imageHeight) return;
  const ratio = imageWidth / imageHeight;
  let drawWidth;
  let drawHeight;
  if (ratio > maxWidth / maxHeight) {
    drawWidth = maxWidth;
    drawHeight = Math.round(maxWidth / ratio);
  } else {
    drawHeight = maxHeight;
    drawWidth = Math.round(maxHeight * ratio);
  }
  const x = position.includes("right") ? width - padding - drawWidth : padding;
  const y = position.includes("bottom")
    ? height - padding - drawHeight
    : padding;
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.drawImage(logoImage, x, y, drawWidth, drawHeight);
  ctx.restore();
}

function bmdDrawScene(
  ctx,
  source,
  clip,
  width,
  height,
  branding,
  logoImage,
) {
  const layout = clip.layout || "media";
  const mediaHeight = layout === "split" ? Math.round(height * .6) : height;
  ctx.fillStyle = "#05070b";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, mediaHeight);
  ctx.clip();
  const drawn = bmdDrawCover(
    ctx,
    source,
    width,
    mediaHeight,
    clip.imageScale ?? 1,
    clip.imageOffsetX ?? 0,
    clip.imageOffsetY ?? 0,
  );
  ctx.restore();

  if (!drawn) {
    const gradient = ctx.createLinearGradient(0, 0, width, mediaHeight);
    gradient.addColorStop(0, "#111827");
    gradient.addColorStop(1, clip.type === "video" ? "#166534" : "#9a3412");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, mediaHeight);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = `600 ${Math.round(width * .025)}px Pretendard, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(clip.name, width / 2, mediaHeight / 2);
  }

  if (layout === "split") {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, mediaHeight, width, height - mediaHeight);
    ctx.fillStyle = `${clip.accentColor || "#ffffff"}88`;
    ctx.fillRect(0, mediaHeight, width, Math.max(2, height * .003));
  } else if (layout === "overlay") {
    const fade = ctx.createLinearGradient(0, height * .32, 0, height);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(.56, "rgba(0,0,0,.58)");
    fade.addColorStop(1, "rgba(0,0,0,.92)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, height * .32, width, height * .68);
  }
  bmdDrawSceneText(ctx, clip, width, height, layout, branding);
  bmdDrawBrandingBar(ctx, clip, width, height, branding);
  bmdDrawProjectLogo(ctx, width, height, branding, logoImage);
  return drawn;
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

function VideoEditor({
  resellerName,
  isActive = true,
  imageTextSource = null,
  branding = null,
  onBrandingChange = () => {},
}) {
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
  const [canvasLayer, setCanvasLayer] = React.useState("media");
  const [timelineDrag, setTimelineDrag] = React.useState(null);
  const [timelineTrim, setTimelineTrim] = React.useState(null);
  const [textMode, setTextMode] = React.useState("scene");
  const [commonText, setCommonText] = React.useState({
    headline: "",
    body: "",
    accentColor: "#ffffff",
    textAlign: "center",
    headSizeScale: 1,
    bodySizeScale: 1,
    headPos: null,
    bodyPos: null,
    sourceLabel: "",
  });
  const [logoImage, setLogoImage] = React.useState(null);

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
  const textDragRef = React.useRef(null);
  const brandingLogoInputRef = React.useRef(null);
  const timelineScrollRef = React.useRef(null);
  const pendingFocusRef = React.useRef(null);
  const timelineDragIdRef = React.useRef(null);
  const timelineTrimRef = React.useRef(null);
  const clipsRef = React.useRef(clips);
  const seekToRef = React.useRef(null);
  const textSettingsRef = React.useRef(null);
  const mediaSettingsRef = React.useRef(null);

  const timeline = React.useMemo(() => bmdBuildTimeline(clips), [clips]);
  const selectedClip = clips.find((clip) => clip.id === selectedId) || null;
  clipsRef.current = clips;

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
      const renderedClip = textMode === "common"
        ? {
          ...clip,
          headline: commonText.headline,
          body: commonText.body,
          accentColor: commonText.accentColor,
          textAlign: commonText.textAlign,
          headSizeScale: commonText.headSizeScale,
          bodySizeScale: commonText.bodySizeScale,
          headPos: commonText.headPos,
          bodyPos: commonText.bodyPos,
        }
        : clip;
      let source = null;
      if (clip.type === "image") source = getImage(clip);
      else source = mediaRefs.current.get(clip.id);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(translateX || 0, 0);
      bmdDrawScene(
        ctx,
        source,
        renderedClip,
        width,
        height,
        branding,
        logoImage,
      );
      ctx.restore();
    },
    [getImage, textMode, commonText, branding, logoImage],
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

  React.useEffect(() => {
    if (!branding?.logoUrl) {
      setLogoImage(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (!cancelled) setLogoImage(image);
    };
    image.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => {
        if (!cancelled) setLogoImage(fallback);
      };
      fallback.src = branding.logoUrl;
    };
    image.src = branding.logoUrl;
    return () => {
      cancelled = true;
    };
  }, [branding?.logoUrl]);

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

  React.useEffect(() => {
    if (!isActive) stopPlayback();
  }, [isActive, stopPlayback]);

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
  seekToRef.current = seekTo;

  React.useEffect(() => {
    const pending = pendingFocusRef.current;
    const clipId = pending?.clipId;
    if (!clipId) return;
    const item = timeline.items.find((entry) => entry.clip.id === clipId);
    if (!item) return;
    pendingFocusRef.current = null;
    setSelectedId(clipId);
    setCanvasLayer("media");
    seekTo(Math.min(item.end, item.start + .02));
    requestAnimationFrame(() => {
      const scroller = timelineScrollRef.current;
      if (scroller) {
        if (pending.scroll === "end") {
          scroller.scrollTo({ left: scroller.scrollWidth, behavior: "smooth" });
        } else {
          scroller.querySelector(`[data-clip-id="${clipId}"]`)?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        }
      }
    });
  }, [timeline]);

  const selectClip = (clip, seekMode = "keep") => {
    setSelectedId(clip.id);
    setCanvasLayer("media");
    const item = timeline.items.find((entry) => entry.clip.id === clip.id);
    if (item && seekMode === "center") {
      seekTo(item.start + item.duration / 2);
      return;
    }
    if (
      !item || currentTimeRef.current >= item.start &&
        currentTimeRef.current <= item.end
    ) return;
    seekTo(Math.min(item.end, item.start + .02));
  };

  const startImageDrag = (event) => {
    const activeItems = timeline.items.filter((item) =>
      currentTimeRef.current >= item.start - .02 &&
      currentTimeRef.current <= item.end + .02
    ).slice(-2);
    let activeItem = activeItems[activeItems.length - 1];
    if (activeItems.length === 2) {
      const [first, second] = activeItems;
      const transitionProgress = (currentTimeRef.current - second.start) /
        Math.max(.01, first.transitionDuration);
      activeItem = transitionProgress < .5 ? first : second;
    }
    const clip = activeItem?.clip || selectedClip;
    if (!clip) return;
    const renderedClip = textMode === "common"
      ? {
        ...clip,
        ...commonText,
      }
      : clip;
    setSelectedId(clip.id);
    const bounds = event.currentTarget.getBoundingClientRect();
    const canvas = canvasRef.current;
    const canvasX = canvas
      ? (event.clientX - bounds.left) / bounds.width * canvas.width
      : 0;
    const canvasY = canvas
      ? (event.clientY - bounds.top) / bounds.height * canvas.height
      : 0;
    const textLayout = canvas
      ? bmdSceneTextLayout(
        canvas.getContext("2d"),
        renderedClip,
        canvas.width,
        canvas.height,
        clip.layout || "media",
        branding,
      )
      : null;
    const hitsTextBounds = (textBounds) =>
      textBounds && canvasX >= textBounds.x &&
      canvasX <= textBounds.x + textBounds.width &&
      canvasY >= textBounds.y &&
      canvasY <= textBounds.y + textBounds.height;
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    const layout = clip.layout || "media";
    let nextLayer = "media";
    if (hitsTextBounds(textLayout?.headlineBounds)) {
      nextLayer = "headline";
    } else if (hitsTextBounds(textLayout?.bodyBounds)) {
      nextLayer = "body";
    } else if (layout === "split" && relativeY >= .6) {
      nextLayer = relativeY < .76 ? "headline" : "body";
    } else if (layout === "overlay" && relativeY >= .48) {
      nextLayer = relativeY < .7 ? "headline" : "body";
    }
    setCanvasLayer(nextLayer);
    requestAnimationFrame(() => {
      const target = nextLayer === "media"
        ? mediaSettingsRef.current
        : textSettingsRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    if (nextLayer !== "media") {
      const layerBounds = nextLayer === "headline"
        ? textLayout?.headlineBounds
        : textLayout?.bodyBounds;
      const anchorX = nextLayer === "headline"
        ? textLayout?.headlineX
        : textLayout?.bodyX;
      const anchorY = nextLayer === "headline"
        ? textLayout?.headlineY
        : textLayout?.bodyY;
      if (!canvas || !layerBounds || anchorX == null || anchorY == null) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      textDragRef.current = {
        clipId: clip.id,
        textMode,
        layer: nextLayer,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        positionX: anchorX / canvas.width,
        positionY: anchorY / canvas.height,
        minX: (anchorX - layerBounds.x) / canvas.width,
        maxX: 1 - (layerBounds.x + layerBounds.width - anchorX) / canvas.width,
        minY: (anchorY - layerBounds.y) / canvas.height,
        maxY: 1 -
          (layerBounds.y + layerBounds.height - anchorY) / canvas.height,
      };
      setImageDragging(true);
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    imageDragRef.current = {
      clipId: clip.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: clip.imageOffsetX ?? 0,
      offsetY: clip.imageOffsetY ?? 0,
    };
    setImageDragging(true);
  };

  const moveImageDrag = (event) => {
    const textDrag = textDragRef.current;
    if (textDrag) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: Math.max(
          textDrag.minX,
          Math.min(
            textDrag.maxX,
            textDrag.positionX +
              (event.clientX - textDrag.startX) / bounds.width,
          ),
        ),
        y: Math.max(
          textDrag.minY,
          Math.min(
            textDrag.maxY,
            textDrag.positionY +
              (event.clientY - textDrag.startY) / bounds.height,
          ),
        ),
      };
      const patch = textDrag.layer === "headline"
        ? { headPos: position }
        : { bodyPos: position };
      if (textDrag.textMode === "common") {
        setCommonText((current) => ({ ...current, ...patch }));
      } else {
        updateClip(textDrag.clipId, patch);
      }
      return;
    }
    const drag = imageDragRef.current;
    if (!drag) return;
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
    updateClip(drag.clipId, {
      imageOffsetX: nextX,
      imageOffsetY: nextY,
    });
  };

  const endImageDrag = (event) => {
    if (!imageDragRef.current && !textDragRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    imageDragRef.current = null;
    textDragRef.current = null;
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
        layout: "media",
        headline: "",
        body: "",
        accentColor: "#ffffff",
        textAlign: "center",
        headSizeScale: 1,
        bodySizeScale: 1,
        headPos: null,
        bodyPos: null,
      };
    });
    setClips((list) => [...list, ...added]);
    const lastAdded = added[added.length - 1];
    pendingFocusRef.current = { clipId: lastAdded.id, scroll: "end" };
    setSelectedId(lastAdded.id);
    setCanvasLayer("media");
  };

  const addClipboardBlobs = (blobs) => {
    const files = Array.from(blobs || []).map((blob, index) => {
      const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") ||
        "png";
      return new File(
        [blob],
        `붙여넣은-사진-${Date.now()}-${index + 1}.${extension}`,
        { type: blob.type || "image/png" },
      );
    });
    if (files.length) addFiles(files);
    return files.length;
  };

  const pasteImages = async () => {
    try {
      const items = await navigator.clipboard.read();
      const blobs = [];
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) blobs.push(await item.getType(imageType));
      }
      if (!addClipboardBlobs(blobs)) alert("복사된 사진이 없습니다.");
    } catch (error) {
      alert("사진 붙여넣기 권한을 허용해주세요.");
    }
  };

  React.useEffect(() => {
    if (!isActive) return;
    const onPaste = (event) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const blobs = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean);
      if (blobs.length) {
        event.preventDefault();
        addClipboardBlobs(blobs);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [isActive, clips.length, selectedId]);

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

  const reorderClip = (id, dropIndex) => {
    stopPlayback();
    pendingFocusRef.current = { clipId: id, scroll: "nearest" };
    setSelectedId(id);
    setCanvasLayer("media");
    setClips((list) => bmdReorderClips(list, id, dropIndex));
    timelineDragIdRef.current = null;
    setTimelineDrag(null);
  };

  const startTimelineTrim = (event, item, edge, clipWidth) => {
    event.preventDefault();
    event.stopPropagation();
    stopPlayback();
    setSelectedId(item.clip.id);
    setCanvasLayer("media");
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const pixelsPerSecond = Math.max(12, clipWidth / item.duration);
    timelineTrimRef.current = {
      clip: { ...item.clip },
      clipId: item.clip.id,
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      pixelsPerSecond,
    };
    setTimelineTrim({ clipId: item.clip.id, edge });
  };

  const moveTimelineTrim = (event) => {
    const trim = timelineTrimRef.current;
    if (!trim) return;
    event.preventDefault();
    event.stopPropagation();
    const deltaSeconds = (event.clientX - trim.startX) /
      trim.pixelsPerSecond;
    updateClip(
      trim.clipId,
      bmdTimelineTrimPatch(trim.clip, trim.edge, deltaSeconds),
    );
  };

  const endTimelineTrim = (event) => {
    const trim = timelineTrimRef.current;
    if (!trim) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(trim.pointerId);
    timelineTrimRef.current = null;
    setTimelineTrim(null);
    requestAnimationFrame(() => {
      const currentTimeline = bmdBuildTimeline(clipsRef.current);
      const item = currentTimeline.items.find((entry) =>
        entry.clip.id === trim.clipId
      );
      if (item) seekToRef.current?.(item.start + item.duration / 2);
    });
  };

  const nudgeTimelineTrim = (event, clip, edge) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const step = event.shiftKey ? .5 : .1;
    setSelectedId(clip.id);
    updateClip(clip.id, bmdTimelineTrimPatch(clip, edge, direction * step));
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
  const baseTimelineWidths = timeline.items.map((item) =>
    Math.max(76, item.duration * 64)
  );
  const baseTimelineWidth = baseTimelineWidths.reduce(
    (sum, width) => sum + width,
    0,
  );
  const timelinePixelWidth = Math.max(
    540,
    baseTimelineWidth,
  );
  const timelineClipWidths = baseTimelineWidths;
  const activeText = textMode === "common" ? commonText : selectedClip;
  const selectedRenderedClip = selectedClip && textMode === "common"
    ? { ...selectedClip, ...commonText }
    : selectedClip;
  const selectionTextLayout = canvasRef.current && selectedRenderedClip
    ? bmdSceneTextLayout(
      canvasRef.current.getContext("2d"),
      selectedRenderedClip,
      canvasRef.current.width,
      canvasRef.current.height,
      selectedClip.layout || "media",
      branding,
    )
    : null;
  const selectionTextBounds = canvasLayer === "headline"
    ? selectionTextLayout?.headlineBounds
    : canvasLayer === "body"
    ? selectionTextLayout?.bodyBounds
    : null;
  const canvasSelectionStyle = selectionTextBounds && canvasRef.current
    ? {
      left: `${selectionTextBounds.x / canvasRef.current.width * 100}%`,
      top: `${selectionTextBounds.y / canvasRef.current.height * 100}%`,
      right: "auto",
      bottom: "auto",
      width: `${selectionTextBounds.width / canvasRef.current.width * 100}%`,
      height: `${selectionTextBounds.height / canvasRef.current.height * 100}%`,
    }
    : undefined;

  const importImageTabText = () => {
    if (!imageTextSource) return;
    setCommonText({
      headline: imageTextSource.headline || "",
      body: imageTextSource.body || "",
      accentColor: imageTextSource.accentColor || "#ffffff",
      textAlign: imageTextSource.textAlign || "center",
      headSizeScale: imageTextSource.headSizeScale ?? 1,
      bodySizeScale: imageTextSource.bodySizeScale ?? 1,
      headPos: imageTextSource.headPos || null,
      bodyPos: imageTextSource.bodyPos || null,
      sourceLabel: imageTextSource.sourceLabel || "이미지 만들기",
    });
    setTextMode("common");
  };

  const chooseTextMode = (mode) => {
    if (mode === "common" && !commonText.sourceLabel && imageTextSource) {
      importImageTabText();
      return;
    }
    setTextMode(mode);
  };

  const updateActiveText = (patch) => {
    if (textMode === "common") {
      setCommonText((current) => ({ ...current, ...patch }));
    } else if (selectedClip) {
      updateClip(selectedClip.id, patch);
    }
  };

  const chooseBrandingLogo = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (event) =>
      onBrandingChange({ logoUrl: event.target.result });
    reader.readAsDataURL(file);
  };

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
            <span>장면</span>
            <span>{clips.length} / 12</span>
          </div>
          {selectedClip && (
            <section className="video-layout-section">
              <div className="video-layout-heading">레이아웃</div>
              <div className="video-layout-picker">
                {BMD_VIDEO_LAYOUTS.map((layout) => (
                  <button
                    key={layout.id}
                    className={(selectedClip.layout || "media") === layout.id
                      ? "active"
                      : ""}
                    type="button"
                    onClick={() =>
                      updateClip(selectedClip.id, { layout: layout.id })}
                  >
                    <span>{layout.icon}</span>
                    {layout.label.replace(
                      "사진",
                      selectedClip.type === "video" ? "영상" : "사진",
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
          <div className="video-media-actions">
            <button
              className="video-add-button"
              type="button"
              onClick={() => mediaInputRef.current?.click()}
            >
              ＋ 사진·영상 추가
            </button>
            <button
              className="video-paste-button"
              type="button"
              onClick={pasteImages}
            >
              📋 사진 붙여넣기
            </button>
          </div>
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
            파일을 끌어놓거나 Ctrl/⌘ + V로 사진을 붙여넣을 수 있습니다
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
                        {BMD_VIDEO_LAYOUTS.find((layout) =>
                          layout.id === (clip.layout || "media")
                        )?.label.replace(
                          "사진",
                          clip.type === "video" ? "영상" : "사진",
                        )}
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
                selectedClip ? "can-adjust-image" : ""
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
              {clips.length > 0 && selectedClip && (
                <>
                  <div
                    className={`video-canvas-selection is-${canvasLayer} layout-${
                      selectedClip.layout || "media"
                    }`}
                    style={canvasSelectionStyle}
                  />
                  <div className="video-image-drag-badge">
                    {canvasLayer === "media"
                      ? `드래그해서 ${
                        selectedClip.type === "video" ? "영상" : "사진"
                      } 위치 조정`
                      : canvasLayer === "headline"
                      ? "드래그해서 제목 위치 조정"
                      : "드래그해서 본문 위치 조정"}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="video-timeline-editor">
            <div className="video-timeline-toolbar">
              <button
                className="video-play-button"
                type="button"
                disabled={!clips.length}
                onClick={togglePlayback}
              >
                {playing ? "Ⅱ" : "▶"}
              </button>
              <div className="video-timeline-title">
                편집 타임라인
                <span>가운데는 순서 변경 · 양쪽 끝은 길이 조절</span>
              </div>
              <span className="video-timecode">
                {bmdVideoTime(currentTime)} / {bmdVideoTime(timeline.total)}
              </span>
            </div>
            <div className="video-timeline-scroll" ref={timelineScrollRef}>
              <div
                className="video-timeline-strip"
                style={{ width: `${timelinePixelWidth}px` }}
                onClick={(event) => {
                  if (event.target.closest(".video-timeline-clip")) return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(
                    0,
                    Math.min(
                      1,
                      (event.clientX - bounds.left) /
                        Math.max(1, baseTimelineWidth),
                    ),
                  );
                  seekTo(ratio * timeline.total);
                }}
              >
                {timeline.items.map((item, index) => {
                  const clip = item.clip;
                  const dropBefore = timelineDrag?.dropIndex === index;
                  const dropAfter = timelineDrag?.dropIndex === index + 1;
                  return (
                    <div
                      key={clip.id}
                      data-clip-id={clip.id}
                      className={`video-timeline-clip ${
                        selectedId === clip.id ? "is-selected" : ""
                      } ${
                        timelineDrag?.clipId === clip.id ? "is-dragging" : ""
                      } ${
                        timelineTrim?.clipId === clip.id ? "is-trimming" : ""
                      } ${dropBefore ? "drop-before" : ""} ${
                        dropAfter ? "drop-after" : ""
                      }`}
                      style={{ width: `${timelineClipWidths[index]}px` }}
                      role="button"
                      tabIndex="0"
                      aria-label={`${index + 1}번 장면, ${
                        item.duration.toFixed(1)
                      }초`}
                      draggable={timelineTrim?.clipId !== clip.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectClip(clip, "center");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectClip(clip, "center");
                        }
                      }}
                      onDragStart={(event) => {
                        if (timelineTrimRef.current) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", clip.id);
                        timelineDragIdRef.current = clip.id;
                        setTimelineDrag({ clipId: clip.id, dropIndex: index });
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        const bounds = event.currentTarget
                          .getBoundingClientRect();
                        const dropIndex = index +
                          (event.clientX > bounds.left + bounds.width / 2
                            ? 1
                            : 0);
                        if (timelineDrag?.dropIndex !== dropIndex) {
                          setTimelineDrag((current) => ({
                            clipId: timelineDragIdRef.current ||
                              current?.clipId || clip.id,
                            dropIndex,
                          }));
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const clipId = timelineDragIdRef.current ||
                          timelineDrag?.clipId ||
                          event.dataTransfer.getData("text/plain");
                        if (clipId) {
                          const bounds = event.currentTarget
                            .getBoundingClientRect();
                          const dropIndex = index +
                            (event.clientX > bounds.left + bounds.width / 2
                              ? 1
                              : 0);
                          reorderClip(clipId, dropIndex);
                        }
                      }}
                      onDragEnd={() => {
                        timelineDragIdRef.current = null;
                        setTimelineDrag(null);
                      }}
                    >
                      {["left", "right"].map((edge) => (
                        <span
                          key={edge}
                          className={`video-timeline-trim-handle is-${edge}`}
                          role="slider"
                          tabIndex="0"
                          aria-label={`${index + 1}번 장면 ${
                            edge === "left" ? "시작" : "끝"
                          } 길이 조절`}
                          aria-valuemin={clip.type === "image" ? 1 : 0}
                          aria-valuemax={clip.type === "image"
                            ? 10
                            : clip.sourceDuration || item.duration}
                          aria-valuenow={clip.type === "image"
                            ? item.duration
                            : edge === "left"
                            ? clip.trimStart || 0
                            : clip.trimEnd || clip.sourceDuration ||
                              item.duration}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) =>
                            nudgeTimelineTrim(event, clip, edge)}
                          onPointerDown={(event) =>
                            startTimelineTrim(
                              event,
                              item,
                              edge,
                              timelineClipWidths[index],
                            )}
                          onPointerMove={moveTimelineTrim}
                          onPointerUp={endTimelineTrim}
                          onPointerCancel={endTimelineTrim}
                        />
                      ))}
                      {clip.type === "image"
                        ? <img src={clip.url} alt="" draggable="false" />
                        : (
                          <video
                            src={clip.url}
                            muted
                            preload="metadata"
                            draggable="false"
                          />
                        )}
                      <span className="video-timeline-shade" />
                      <span className="video-timeline-index">{index + 1}</span>
                      <span className="video-timeline-duration">
                        {item.duration.toFixed(1)}초
                      </span>
                      <span className="video-timeline-layout">
                        {(clip.layout || "media") === "split"
                          ? `${clip.type === "video" ? "영상" : "사진"}+글`
                          : (clip.layout || "media") === "overlay"
                          ? `${clip.type === "video" ? "영상" : "사진"} 위 글`
                          : `${clip.type === "video" ? "영상" : "사진"}만`}
                      </span>
                      {index < timeline.items.length - 1 &&
                        clip.transition !== "none" && (
                        <span className="video-timeline-transition">↔</span>
                      )}
                    </div>
                  );
                })}
                {timeline.total > 0 && (
                  <span
                    className="video-timeline-playhead"
                    style={{
                      left: `${
                        Math.min(
                          timelinePixelWidth,
                          currentTime / timeline.total * baseTimelineWidth,
                        )
                      }px`,
                    }}
                  />
                )}
              </div>
            </div>
            <input
              className="video-scrubber"
              type="range"
              min="0"
              max={Math.max(.1, timeline.total)}
              step="0.01"
              value={Math.min(currentTime, timeline.total)}
              disabled={!clips.length}
              aria-label="영상 재생 위치"
              onChange={(event) => seekTo(event.target.value)}
            />
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

          {selectedClip && (selectedClip.layout || "media") !== "media" && (
            <section className="video-settings-section" ref={textSettingsRef}>
              <div className="video-settings-title">글 레이어</div>
              <div className="video-segmented video-text-mode">
                <button
                  className={textMode === "common" ? "active" : ""}
                  type="button"
                  onClick={() => chooseTextMode("common")}
                >
                  전체 장면 같은 글
                </button>
                <button
                  className={textMode === "scene" ? "active" : ""}
                  type="button"
                  onClick={() => chooseTextMode("scene")}
                >
                  장면별 다른 글
                </button>
              </div>
              {textMode === "common" && (
                <div className="video-import-text-wrap">
                  <button
                    className="video-import-text-button"
                    type="button"
                    onClick={importImageTabText}
                    disabled={!imageTextSource}
                  >
                    이미지 탭의 현재 글 가져오기
                  </button>
                  <div className="video-import-text-note">
                    {commonText.sourceLabel
                      ? `${commonText.sourceLabel}에서 가져온 뒤 영상용으로 독립 저장됩니다.`
                      : "현재 선택된 이미지 슬라이드의 제목과 본문을 복사합니다."}
                  </div>
                </div>
              )}
              <label
                className={`video-text-field ${
                  canvasLayer === "headline" ? "is-selected" : ""
                }`}
              >
                <span>제목</span>
                <textarea
                  rows="2"
                  value={activeText?.headline || ""}
                  placeholder="제목을 입력하세요"
                  onFocus={() => setCanvasLayer("headline")}
                  onChange={(event) =>
                    updateActiveText({
                      headline: event.target.value,
                    })}
                />
              </label>
              <label
                className={`video-text-field ${
                  canvasLayer === "body" ? "is-selected" : ""
                }`}
              >
                <span>본문</span>
                <textarea
                  rows="3"
                  value={activeText?.body || ""}
                  placeholder="본문을 입력하세요"
                  onFocus={() => setCanvasLayer("body")}
                  onChange={(event) =>
                    updateActiveText({ body: event.target.value })}
                />
              </label>
              <label className="video-image-slider">
                <span>
                  <b>제목 크기</b>
                  <em>
                    {Math.round((activeText?.headSizeScale ?? 1) * 100)}%
                  </em>
                </span>
                <input
                  className="video-range"
                  type="range"
                  min=".5"
                  max="2"
                  step=".05"
                  value={activeText?.headSizeScale ?? 1}
                  onFocus={() => setCanvasLayer("headline")}
                  onChange={(event) =>
                    updateActiveText({
                      headSizeScale: Number(event.target.value),
                    })}
                />
              </label>
              <button
                className="video-image-reset"
                type="button"
                onClick={() => {
                  setCanvasLayer("headline");
                  updateActiveText({ headPos: null });
                }}
              >
                제목 위치 초기화
              </button>
              <label className="video-image-slider">
                <span>
                  <b>본문 크기</b>
                  <em>
                    {Math.round((activeText?.bodySizeScale ?? 1) * 100)}%
                  </em>
                </span>
                <input
                  className="video-range"
                  type="range"
                  min=".5"
                  max="2"
                  step=".05"
                  value={activeText?.bodySizeScale ?? 1}
                  onFocus={() => setCanvasLayer("body")}
                  onChange={(event) =>
                    updateActiveText({
                      bodySizeScale: Number(event.target.value),
                    })}
                />
              </label>
              <button
                className="video-image-reset"
                type="button"
                onClick={() => {
                  setCanvasLayer("body");
                  updateActiveText({ bodyPos: null });
                }}
              >
                본문 위치 초기화
              </button>
              <div className="video-control-row">
                <span className="video-control-label">제목 색상</span>
                <div className="video-color-options">
                  {["#ffffff", "#f5c518", "#00d4ff", "#ff3b3b"].map(
                    (color) => (
                      <button
                        key={color}
                        className={(activeText?.accentColor || "#ffffff") ===
                            color
                          ? "active"
                          : ""}
                        type="button"
                        aria-label={`제목 색상 ${color}`}
                        style={{ background: color }}
                        onClick={() => updateActiveText({ accentColor: color })}
                      />
                    ),
                  )}
                </div>
              </div>
              <div className="video-segmented three">
                {[
                  { id: "left", label: "왼쪽" },
                  { id: "center", label: "가운데" },
                  { id: "right", label: "오른쪽" },
                ].map((alignment) => (
                  <button
                    key={alignment.id}
                    className={(activeText?.textAlign || "center") ===
                        alignment.id
                      ? "active"
                      : ""}
                    type="button"
                    onClick={() =>
                      updateActiveText({ textAlign: alignment.id })}
                  >
                    {alignment.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {selectedClip && (
            <section className="video-settings-section" ref={mediaSettingsRef}>
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
                    <label className="video-image-slider">
                      <span>
                        <b>영상 확대/축소</b>
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
                      영상 위치·크기 초기화
                    </button>
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
            <div className="video-settings-title">이미지 탭 브랜딩·로고</div>
            <div className="video-shared-setting-note">
              두 탭이 같은 설정을 사용하며 변경 내용이 서로 즉시 반영됩니다.
            </div>
            <div className="video-control-row">
              <span className="video-control-label">하단 브랜딩 바</span>
              <button
                className={`video-toggle ${
                  branding?.showBranding ? "active" : ""
                }`}
                type="button"
                aria-label="하단 브랜딩 바 켜기 또는 끄기"
                onClick={() => onBrandingChange({
                  showBranding: !branding?.showBranding,
                })}
              />
            </div>
            <label className="video-text-field">
              <span>회사명</span>
              <input
                type="text"
                value={branding?.company || ""}
                placeholder={resellerName || "회사명을 입력하세요"}
                onChange={(event) =>
                  onBrandingChange({ company: event.target.value })}
              />
            </label>
            <input
              ref={brandingLogoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                chooseBrandingLogo(event.target.files[0]);
                event.target.value = "";
              }}
            />
            <div className="video-brand-logo-row">
              <button
                className="video-logo-upload"
                type="button"
                onClick={() => brandingLogoInputRef.current?.click()}
              >
                {branding?.logoUrl ? "회사 로고 교체" : "회사 로고 가져오기"}
              </button>
              {branding?.logoUrl && (
                <button
                  className="video-logo-remove"
                  type="button"
                  aria-label="회사 로고 삭제"
                  onClick={() => onBrandingChange({ logoUrl: null })}
                >
                  ×
                </button>
              )}
            </div>
            {branding?.logoUrl && (
              <>
                <div className="video-logo-preview">
                  <img src={branding.logoUrl} alt="회사 로고" />
                </div>
                <div className="video-logo-position-grid">
                  {[
                    { id: "top-left", label: "좌상단" },
                    { id: "top-right", label: "우상단" },
                    { id: "bottom-left", label: "좌하단" },
                    { id: "bottom-right", label: "우하단" },
                  ].map((position) => (
                    <button
                      key={position.id}
                      className={(branding.logoPos || "top-right") ===
                          position.id
                        ? "active"
                        : ""}
                      type="button"
                      onClick={() => onBrandingChange({ logoPos: position.id })}
                    >
                      {position.label}
                    </button>
                  ))}
                </div>
                <label className="video-image-slider">
                  <span>
                    <b>로고 크기</b>
                    <em>{Math.round((branding.logoScale ?? 1) * 100)}%</em>
                  </span>
                  <input
                    className="video-range"
                    type="range"
                    min=".3"
                    max="3"
                    step=".05"
                    value={branding.logoScale ?? 1}
                    onChange={(event) =>
                      onBrandingChange({
                        logoScale: Number(event.target.value),
                      })}
                  />
                </label>
                <label className="video-image-slider">
                  <span>
                    <b>로고 투명도</b>
                    <em>{Math.round((branding.logoOpacity ?? 1) * 100)}%</em>
                  </span>
                  <input
                    className="video-range"
                    type="range"
                    min=".1"
                    max="1"
                    step=".05"
                    value={branding.logoOpacity ?? 1}
                    onChange={(event) =>
                      onBrandingChange({
                        logoOpacity: Number(event.target.value),
                      })}
                  />
                </label>
              </>
            )}
          </section>

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
