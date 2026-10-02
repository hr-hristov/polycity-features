// The Polycity features site's moving parts. Without this script every page
// still reads: the table lists every row, the films play with their own
// controls, and the reel shows its first still.
//
// - The reel plays eight silent seconds of each of the four newest films in
//   turn, and lights the one playing in the list beside it.
// - A preview plays only in view (cards and tiles) or under the pointer (the
//   table), and nothing moves on its own when the device asks for less motion.
// - The table is filtered by part of the product, kind of change and words.
// - A film's page lights the chapter on screen and jumps to any pressed.
const still = matchMedia('(prefers-reduced-motion: reduce)');
const REEL_SECONDS = 8;

// The phone's menu.
const head = document.querySelector('.hd');
head?.querySelector('.menu')?.addEventListener('click', event => {
  const open = !head.hasAttribute('data-open');
  head.toggleAttribute('data-open', open);
  event.currentTarget.setAttribute('aria-expanded', String(open));
});
head?.querySelectorAll('.nav a').forEach(link => link.addEventListener('click', () => head.removeAttribute('data-open')));

/* ---------------------------------------------------------- previews */

// A preview's video, made the first time it is wanted.
const videoOf = holder => {
  let video = holder.querySelector('video[data-preview-video]');
  if (!video) {
    video = document.createElement('video');
    video.dataset.previewVideo = '';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.setAttribute('aria-hidden', 'true');
    video.src = holder.dataset.preview;
    // The still stays under it until the first picture is drawn.
    const picture = holder.querySelector('img');
    if (picture) picture.after(video);
    else holder.prepend(video);
  }
  return video;
};
const start = holder => {
  if (still.matches || !holder.dataset.preview) return;
  const video = videoOf(holder);
  video.play().then(() => holder.classList.add('playing')).catch(() => {});
};
const stop = holder => {
  const video = holder.querySelector('video[data-preview-video]');
  if (!video) return;
  video.pause();
  holder.classList.remove('playing');
};

// Cards and tiles play while in view.
const inView = new IntersectionObserver(entries => {
  for (const entry of entries) (entry.isIntersecting ? start : stop)(entry.target);
}, { threshold: 0.6 });
document.querySelectorAll('.card .still[data-preview], .tile .pic[data-preview]').forEach(holder => inView.observe(holder));

// A table row plays under the pointer.
document.querySelectorAll('tbody tr').forEach(row => {
  const holder = row.querySelector('[data-preview]');
  if (!holder) return;
  row.addEventListener('pointerenter', () => start(holder));
  row.addEventListener('pointerleave', () => stop(holder));
  row.addEventListener('click', event => {
    if (event.target.closest('a')) return;
    location.href = row.dataset.href;
  });
});

/* ---------------------------------------------------------- the reel */

const reelData = document.getElementById('reel-data');
if (reelData) {
  const reel = JSON.parse(reelData.textContent);
  const frame = document.querySelector('[data-reel-frame]');
  const videos = [...frame.querySelectorAll('.reel-video')];
  const items = [...document.querySelectorAll('[data-reel]')];
  const segments = [...document.querySelectorAll('.seg i b')];
  const nowName = document.querySelector('[data-reel-now]');
  const nowOf = document.querySelector('[data-reel-of]');
  let at = 0, timer = 0, began = 0;

  const show = index => {
    at = (index + reel.length) % reel.length;
    videos.forEach((video, i) => {
      video.classList.toggle('on', i === at);
      if (i !== at) video.pause();
    });
    items.forEach((item, i) => item.classList.toggle('on', i === at));
    segments.forEach((segment, i) => (segment.style.width = i < at ? '100%' : '0'));
    frame.href = `${reel[at].id}/`;
    frame.setAttribute('aria-label', `Open ${reel[at].title}`);
    if (nowName) nowName.textContent = reel[at].title;
    if (nowOf) nowOf.textContent = `${at + 1} of ${reel.length}`;
    if (still.matches) return;
    const video = videos[at];
    if (!video.src) video.src = video.dataset.src;
    video.currentTime = 0;
    video.play().catch(() => {});
    // The next film is fetched while this one plays.
    const next = videos[(at + 1) % videos.length];
    if (!next.src) { next.preload = 'auto'; next.src = next.dataset.src; }
    began = performance.now();
  };

  // The bar under the film playing fills over its eight seconds.
  const tick = now => {
    if (!still.matches && !document.hidden) {
      const share = Math.min(1, (now - began) / (REEL_SECONDS * 1000));
      const bar = items[at]?.querySelector('.bar i');
      if (bar) bar.style.width = `${share * 100}%`;
      if (segments[at]) segments[at].style.width = `${share * 100}%`;
      if (share >= 1) show(at + 1);
    }
    timer = requestAnimationFrame(tick);
  };

  // Pointing at a film in the list plays it in the frame.
  items.forEach((item, i) => item.addEventListener('pointerenter', () => { if (i !== at) show(i); }));
  // Off screen, the reel waits.
  new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(timer);
    if (entry.isIntersecting) {
      began = performance.now() - 0;
      timer = requestAnimationFrame(tick);
      if (!still.matches) videos[at].play().catch(() => {});
    } else {
      videos[at].pause();
    }
  }, { threshold: 0.3 }).observe(frame);
  show(0);
}

/* ---------------------------------------------------------- the table */

const table = document.querySelector('#every-workflow table');
if (table) {
  const section = document.getElementById('every-workflow');
  const index = section.querySelector('.idx');
  const tabs = [...section.querySelectorAll('[data-tab]')];
  const kindButtons = [...section.querySelectorAll('.rail [data-kind]')];
  const find = section.querySelector('.find');
  // On a phone the parts and the kinds are two lists to choose from.
  const areaPick = section.querySelector('.pick-area');
  const kindPick = section.querySelector('.pick-kind');
  const none = section.querySelector('.none');
  const rows = [...table.querySelectorAll('tbody tr')];
  const chosen = { area: '', kind: '', words: '' };

  const apply = () => {
    let shown = 0;
    const words = chosen.words.toLowerCase().split(/\s+/).filter(Boolean);
    for (const row of rows) {
      const fits = (!chosen.area || row.dataset.area === chosen.area)
        && (!chosen.kind || row.dataset.kind === chosen.kind)
        && words.every(word => row.dataset.words.includes(word));
      row.hidden = !fits;
      if (fits) shown++;
    }
    none.hidden = shown > 0;
    tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.tab === chosen.area)));
    kindButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.kind === chosen.kind)));
    if (areaPick) areaPick.value = chosen.area;
    if (kindPick) kindPick.value = chosen.kind;
    // The kinds stand beside the table only for the editor's measures.
    index.classList.toggle('flat', chosen.area !== 'editor');
  };
  const chooseArea = area => {
    chosen.area = area;
    chosen.kind = '';
    apply();
  };

  tabs.forEach(tab => tab.addEventListener('click', () => chooseArea(tab.dataset.tab)));
  kindButtons.forEach(button => button.addEventListener('click', () => { chosen.kind = button.dataset.kind; apply(); }));
  find.addEventListener('input', () => { chosen.words = find.value; apply(); });
  areaPick?.addEventListener('change', () => chooseArea(areaPick.value));
  kindPick?.addEventListener('change', () => { chosen.kind = kindPick.value; apply(); });
  // A tile opens the table on its part of the product.
  document.querySelectorAll('.tile[data-area]').forEach(tile => tile.addEventListener('click', () => chooseArea(tile.dataset.area)));
  apply();
}

/* ---------------------------------------------------------- a film's chapters */

const film = document.querySelector('.mst video');
const chapters = [...document.querySelectorAll('.chap li')];
if (film && chapters.length) {
  const times = chapters.map(item => Number(item.querySelector('button').dataset.at));
  const light = () => {
    const now = film.currentTime;
    let on = 0;
    times.forEach((t, i) => { if (now >= t - 0.05) on = i; });
    chapters.forEach((item, i) => {
      item.classList.toggle('now', i === on);
      item.classList.toggle('past', i < on);
      item.querySelector('button').toggleAttribute('aria-current', i === on);
    });
  };
  chapters.forEach((item, i) => item.querySelector('button').addEventListener('click', () => {
    film.currentTime = times[i];
    film.play().catch(() => {});
    light();
  }));
  film.addEventListener('timeupdate', light);
  film.addEventListener('seeked', light);
  light();
}
