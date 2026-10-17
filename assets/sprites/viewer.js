(() => {
  const enlargement = 8;
  const frameLength = 1000 / 60;
  const { colors, faded } = globalThis.palette;
  const [[name, sprite]] = Object.entries(globalThis.sprites);

  const style = document.createElement('style');
  // No palette color is close to magenta or lime, so every sprite pixel stands out against the checkerboard.
  style.textContent = `
    body { margin: 16px; background: #f5f2e9; color: #1c1a2e; font-family: sans-serif; }
    .entry { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .entry p { width: 100%; margin: 0; }
    canvas { image-rendering: pixelated; background: repeating-conic-gradient(#ff00ff 0 25%, #00ff00 0 50%) 0 0 / 8px 8px; }
  `;
  document.head.append(style);
  document.title = name;

  const channels = (code) => [1, 3, 5].map((start) => Number.parseInt(colors[code].slice(start, start + 2), 16));

  function paint(rows, legend, color) {
    const image = new ImageData(rows[0].length, rows.length);
    rows.forEach((row, y) =>
      [...row].forEach((symbol, x) => {
        if (symbol !== '.') image.data.set([...color(legend[symbol]), 255], (y * row.length + x) * 4);
      }),
    );
    return image;
  }

  // Grayscale only serves the contrast review, so it is computed here instead of being authored.
  function grayscale(image) {
    const gray = new ImageData(image.width, image.height);
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const [red, green, blue, alpha] = image.data.subarray(offset, offset + 4);
      const light = 0.299 * red + 0.587 * green + 0.114 * blue;
      gray.data.set([light, light, light, alpha], offset);
    }
    return gray;
  }

  const images = Object.fromEntries(
    Object.entries(sprite.frames).map(([frame, rows]) => {
      const colored = paint(rows, sprite.legend, channels);
      const correction = sprite.faded[frame];
      const fadedImage = correction
        ? paint(correction.rows, correction.legend, channels)
        : paint(rows, sprite.legend, (code) => channels(faded[code] ?? code));
      return [frame, [colored, fadedImage, grayscale(colored)]];
    }),
  );

  // Sizing in device pixels keeps every game pixel the same whole number of device pixels on any screen.
  function canvas(width, height, scale, mirrored) {
    const created = document.createElement('canvas');
    created.width = width;
    created.height = height;
    created.style.width = `${(width * scale) / window.devicePixelRatio}px`;
    created.style.height = `${(height * scale) / window.devicePixelRatio}px`;
    if (mirrored) created.style.transform = 'scaleX(-1)';
    return created;
  }

  const main = document.createElement('main');
  const heading = document.createElement('h1');
  heading.textContent = name;
  main.append(heading);
  document.body.append(main);

  function entry(label, frames, length) {
    const [first] = images[frames[0]];
    const element = document.createElement('div');
    element.className = 'entry';
    const caption = document.createElement('p');
    caption.textContent = frames.length > 1 ? `${label}, ${frames.length} frames of ${length} game frames` : label;
    element.append(caption);
    const contexts = [0, 1, 2].map(() => {
      const views = [
        canvas(first.width, first.height, 1, false),
        canvas(first.width, first.height, enlargement, false),
        canvas(first.width, first.height, enlargement, true),
      ];
      element.append(...views);
      return views.map((view) => view.getContext('2d'));
    });
    main.append(element);
    let shown = -1;
    return (tick) => {
      const index = Math.floor(tick / length) % frames.length;
      if (index === shown) return;
      shown = index;
      contexts.forEach((views, version) => {
        for (const context of views) context.putImageData(images[frames[index]][version], 0, 0);
      });
    };
  }

  const entries = [
    ...Object.keys(sprite.frames).map((frame) => entry(frame, [frame], 1)),
    ...Object.entries(sprite.animations).map(([animation, { frames, length }]) => entry(animation, frames, length)),
  ];

  let tick = 0;
  let pending = 0;
  let previous = performance.now();
  const animate = (now) => {
    pending = Math.min(pending + now - previous, frameLength * 10);
    previous = now;
    while (pending >= frameLength) {
      tick++;
      pending -= frameLength;
    }
    entries.forEach((update) => update(tick));
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
})();
