const canvasWidth = 1080;
const canvasHeight = 1740;
const scale = 2.5;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = src;
  });
}

function drawCover(context, image, x, y, width, height) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  const sourceWidth = imageRatio > targetRatio
    ? image.naturalHeight * targetRatio
    : image.naturalWidth;
  const sourceHeight = imageRatio > targetRatio
    ? image.naturalHeight
    : image.naturalWidth / targetRatio;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function titleLines(context, title, maxWidth) {
  const words = title.split(/\s+/).filter(Boolean);
  for (let fontSize = 48; fontSize >= 36; fontSize -= 1) {
    context.font = `500 ${fontSize}px "Spectral SC"`;
    const lines = [];
    words.forEach((word) => {
      const current = lines.at(-1);
      if (current && context.measureText(`${current} ${word}`).width <= maxWidth) {
        lines[lines.length - 1] = `${current} ${word}`;
      } else {
        lines.push(word);
      }
    });
    if (lines.length <= 2 && lines.every((line) => context.measureText(line).width <= maxWidth)) {
      return { fontSize, lines };
    }
  }
  return { fontSize: 36, lines: [title] };
}

function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

export async function createDailyShareCardFile(card, tag) {
  if (!card?.image || typeof File === "undefined") return null;

  try {
    await Promise.all([
      document.fonts.load('500 48px "Spectral SC"'),
      document.fonts.load('400 14px "Inter Display"'),
    ]);
    const [background, frame, artwork, icon] = await Promise.all([
      loadImage("/ritual/share/background.webp"),
      loadImage("/ritual/share/card-frame.webp"),
      loadImage(`/${card.image.replace(/^\/+/, "")}`),
      tag.icon ? loadImage(tag.icon.replace(/^\.\//, "/ritual/")) : Promise.resolve(null),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.scale(scale, scale);

    const title = card.result?.title || card.name;
    const fittedTitle = titleLines(context, title, 354);
    const lineHeight = fittedTitle.fontSize * 1.125;
    const groupHeight = 422.9 + 32 + 36 + 12 + fittedTitle.lines.length * lineHeight;
    const groupTop = (696 - groupHeight) / 2;

    context.fillStyle = "#fff";
    context.fillRect(0, 0, 432, 696);
    context.drawImage(background, 0, 0, 432, 696);
    context.drawImage(frame, 64.3, groupTop - 21.7, 303.3, 472.3);

    context.save();
    context.beginPath();
    context.roundRect(98.3, groupTop + 9.3, 235.4, 404.4, 12.3);
    context.clip();
    drawCover(context, artwork, 98.3, groupTop + 9.3, 235.4, 404.4);
    context.restore();
    context.strokeStyle = "rgba(255,255,255,0.32)";
    context.lineWidth = 0.8;
    context.beginPath();
    context.roundRect(98.3, groupTop + 9.3, 235.4, 404.4, 12.3);
    context.stroke();

    context.font = '400 14px "Inter Display"';
    const tagWidth = 12 + (icon ? 24 + 6 : 0) + context.measureText(tag.label).width + 16;
    const tagX = (432 - tagWidth) / 2;
    const tagY = groupTop + 454.9;
    context.fillStyle = "rgba(255,255,255,0.08)";
    context.strokeStyle = "rgba(255,255,255,0.5)";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(tagX, tagY, tagWidth, 36, 18);
    context.fill();
    context.stroke();
    if (icon) context.drawImage(icon, tagX + 12, tagY + 6, 24, 24);
    context.fillStyle = "#fff";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(tag.label, tagX + 12 + (icon ? 30 : 0), tagY + 18);

    context.font = `500 ${fittedTitle.fontSize}px "Spectral SC"`;
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = "rgba(0,0,0,0.82)";
    context.shadowBlur = 38.7;
    fittedTitle.lines.forEach((line, index) => {
      context.fillText(line, 216, tagY + 48 + lineHeight / 2 + index * lineHeight);
    });

    const blob = await canvasBlob(canvas);
    return blob ? new File([blob], `mora-${card.id}.jpg`, { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}
