/*
 * AudioRanobe embeddable widgets, served by /embed (app/embed/route.ts):
 * ?type=narrator&id=…, ?type=collection&id=…, or the volume player below.
 * Lists every chapter of one volume but plays only those before the gate (the
 * LIMIT-th chapter, or the last one in a shorter volume). Reaching the gate
 * blurs the widget and sends the listener to the site; chapters past it link
 * there directly. All data goes into the DOM as text, never HTML.
 */
(function () {
  'use strict';

  var API = window.AR_API;
  var SITE = location.origin;
  var LIMIT = 10;
  var app = document.getElementById('app');
  var params = new URLSearchParams(location.search);
  var titleRef = params.get('title') || '';
  var volumeId = Number(params.get('volume'));
  var versionId = Number(params.get('version') || 0);

  var ICONS = {
    play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
    pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',
    prev: '<path d="M19 20 9 12l10-8zM5 19V5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    next: '<path d="m5 4 10 8-10 8zM19 5v14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    vol: '<path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    check: '<path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="2" fill="none"/>',
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function icon(name, size) {
    var s = size || 16;
    var span = el('span');
    span.style.display = 'inline-flex';
    span.innerHTML =
      '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
    return span;
  }

  // A cover image, or a headphones placeholder of the same box when there is none.
  function cover(url, cls, iconSize) {
    if (!url) {
      var ph = el('span', cls + ' ar-noimg');
      ph.appendChild(icon('headphones', iconSize));
      return ph;
    }
    var img = el('img', cls);
    img.src = url;
    img.alt = '';
    return img;
  }

  function link(href, cls, text) {
    var a = el('a', cls, text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  }

  function showState(text, href, linkText) {
    app.textContent = '';
    var box = el('div', 'ar-state', text);
    if (href) {
      box.appendChild(document.createElement('br'));
      box.appendChild(link(href, '', linkText));
    }
    app.appendChild(box);
  }

  // Same overlay the title page applies (TitlePageClient displayVolumes),
  // narrowed to one volume: a standalone alt volume lists its own chapters,
  // otherwise the alt's ready chapters replace main slots one by one.
  function volumeChapters(t, vol) {
    var alt = function (ver) {
      return (t.alt_chapters && t.alt_chapters[String(ver)]) || [];
    };
    var standaloneIn = function (ver) {
      var v = t.versions.find(function (x) { return x.id === ver; });
      return !!v && (v.standalone_volume_ids || []).indexOf(vol.id) !== -1;
    };
    var own = 0;
    if (versionId !== 0 && standaloneIn(versionId)) own = versionId;
    else if (vol.chapters.length === 0) {
      var filler = t.versions.find(function (x) { return (x.standalone_volume_ids || []).indexOf(vol.id) !== -1; });
      own = filler ? filler.id : 0;
    }
    if (own !== 0) {
      return alt(own)
        .filter(function (c) { return c.volume_id === vol.id; })
        .sort(function (a, b) { return a.number - b.number; });
    }
    if (versionId === 0) return vol.chapters;
    var byNum = {};
    alt(versionId).forEach(function (c) {
      if (c.volume_id === vol.id) byNum[c.number] = c;
    });
    return vol.chapters.map(function (c) {
      var a = byNum[c.number];
      if (!a || a.audio_status !== 'ready') return c;
      return Object.assign({}, a, { name: c.name, number: c.number, number_end: c.number_end });
    });
  }

  function chapterNum(c) {
    return c.number_end ? c.number + '–' + c.number_end : String(c.number);
  }

  function chapterName(c) {
    return c.name || 'Глава ' + chapterNum(c);
  }

  function render(t) {
    var vol = t.volumes.find(function (v) { return v.id === volumeId; });
    if (!vol) return showState('Том не найден.', SITE + '/title/' + t.slug, 'Открыть тайтл');

    var chapters = volumeChapters(t, vol).filter(function (c) { return !c.is_deleted; });
    var titleUrl = SITE + '/title/' + t.slug;
    var gated = t.is_nsfw || t.has_sensitive_genre;
    var gate = Math.min(LIMIT, chapters.length) - 1;
    var gateUrl = gate >= 0 ? SITE + '/chapter/' + chapters[gate].id : titleUrl;
    var volLabel = vol.name || t.volume_label + ' ' + vol.number;
    var subParts = [volLabel];
    if (t.versions.length > 0) {
      var ver = t.versions.find(function (v) { return v.id === versionId; });
      subParts.push(ver ? ver.name : t.version_name);
    }
    subParts.push(chapters.length + ' гл.');

    app.textContent = '';
    document.title = t.name + ' — ' + volLabel + ' · AudioRanobe';

    // ---- head
    var head = el('div', 'ar-head');
    var coverLink = link(titleUrl);
    coverLink.appendChild(cover(vol.cover_thumb_url || t.cover_thumb_url || t.cover_url, 'ar-cover', 26));
    head.appendChild(coverLink);

    var meta = el('div', 'ar-meta');
    meta.appendChild(link(titleUrl, 'ar-title', t.name));
    var narrators = [];
    var seen = {};
    chapters.forEach(function (c) {
      (c.narrators || []).forEach(function (n) {
        if (!seen[n.id]) {
          seen[n.id] = true;
          narrators.push(n);
        }
      });
    });
    var sub = el('div', 'ar-sub', subParts.join(' · '));
    narrators.forEach(function (n, i) {
      sub.appendChild(document.createTextNode(i === 0 ? ' · ' : ', '));
      sub.appendChild(link(SITE + '/narrator/' + n.slug, 'ar-narr', n.name));
    });
    meta.appendChild(sub);
    var now = el('div', 'ar-now', gated ? 'Этот тайтл слушают на сайте после входа.' : 'Выберите главу');
    meta.appendChild(now);

    var controls = el('div', 'ar-controls');
    var prevBtn = el('button', 'ar-btn');
    prevBtn.appendChild(icon('prev'));
    prevBtn.setAttribute('aria-label', 'Предыдущая глава');
    var playBtn = el('button', 'ar-btn ar-play');
    playBtn.setAttribute('aria-label', 'Слушать');
    var nextBtn = el('button', 'ar-btn');
    nextBtn.appendChild(icon('next'));
    nextBtn.setAttribute('aria-label', 'Следующая глава');
    var seek = el('input', 'ar-seek');
    seek.type = 'range';
    seek.min = '0';
    seek.max = '0';
    seek.step = '1';
    seek.value = '0';
    seek.setAttribute('aria-label', 'Позиция');
    var time = el('span', 'ar-time', '0:00');
    var volBox = el('span', 'ar-volume');
    volBox.appendChild(icon('vol', 15));
    var vol = el('input', 'ar-vol');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '1';
    vol.step = '0.05';
    vol.value = '1';
    vol.setAttribute('aria-label', 'Громкость');
    volBox.appendChild(vol);
    controls.append(prevBtn, playBtn, nextBtn, seek, time, volBox);
    meta.appendChild(controls);
    head.appendChild(meta);
    app.appendChild(head);

    // ---- list
    var list = el('ul', 'ar-list');
    var rows = [];
    if (chapters.length === 0) list.appendChild(el('li', 'ar-state', 'В этом томе пока нет глав.'));
    chapters.forEach(function (c, i) {
      var li = el('li');
      var row;
      if (i <= gate && !gated) {
        row = el('button', 'ar-row');
        row.type = 'button';
        row.disabled = i !== gate && c.audio_status !== 'ready';
        row.addEventListener('click', function () { load(i); });
      } else {
        row = link(SITE + '/chapter/' + c.id, 'ar-row is-locked');
      }
      row.appendChild(el('span', 'ar-num', chapterNum(c)));
      row.appendChild(el('span', 'ar-name', chapterName(c)));
      if (i >= gate || gated) row.appendChild(icon('lock', 13));
      else row.appendChild(el('span', 'ar-dur', fmt(c.duration_seconds)));
      li.appendChild(row);
      list.appendChild(li);
      rows.push(row);
    });
    app.appendChild(list);

    // ---- foot
    app.appendChild(foot(titleUrl, 'Слушать на сайте ↗'));

    // ---- shown once playback runs out
    var outro = el('div', 'ar-outro');
    outro.appendChild(el('div', 'ar-outro-text', 'Продолжите слушать на AudioRanobe'));
    outro.appendChild(link(gateUrl, 'ar-outro-cta', 'Перейти на сайт'));
    var outroClose = el('button', 'ar-outro-close', 'Закрыть');
    outroClose.type = 'button';
    outroClose.addEventListener('click', function () { outro.classList.remove('is-open'); });
    outro.appendChild(outroClose);
    app.appendChild(outro);

    // ---- player
    var audio = new Audio();
    audio.preload = 'none';
    var cur = -1;
    var loadSeq = 0;
    var dragging = false;

    var playable = function (i) {
      return !gated && i >= 0 && i < gate && chapters[i].audio_status === 'ready';
    };
    var step = function (from, dir) {
      for (var j = from + dir; j >= 0 && j <= gate; j += dir) {
        if (playable(j) || j === gate) return j;
      }
      return -1;
    };

    function sync() {
      var playing = !audio.paused;
      playBtn.textContent = '';
      playBtn.appendChild(icon(playing ? 'pause' : 'play', 16));
      playBtn.setAttribute('aria-label', playing ? 'Пауза' : 'Слушать');
      playBtn.disabled = step(-1, 1) === -1;
      prevBtn.disabled = step(cur, -1) === -1;
      nextBtn.disabled = cur === -1 || step(cur, 1) === -1;
      rows.forEach(function (r, i) { r.classList.toggle('is-current', i === cur); });
    }

    function load(i) {
      if (i === gate && !gated) {
        audio.pause();
        outro.classList.add('is-open');
        return;
      }
      if (!playable(i)) return;
      cur = i;
      var seq = ++loadSeq;
      var c = chapters[i];
      now.textContent = chapterNum(c) + '. ' + chapterName(c);
      seek.value = '0';
      sync();
      fetch(API + '/chapters/' + c.id + '?embed=1', { credentials: 'omit' })
        .then(function (r) {
          if (!r.ok) throw r.status;
          return r.json();
        })
        .then(function (d) {
          if (seq !== loadSeq) return;
          audio.src = d.audio_url;
          return audio.play().then(function () { countPlay(c.id); });
        })
        .catch(function () {
          if (seq === loadSeq) now.textContent = 'Не удалось загрузить главу.';
        });
    }

    playBtn.addEventListener('click', function () {
      if (cur === -1) return load(step(-1, 1));
      if (audio.paused) audio.play().catch(function () {});
      else audio.pause();
    });
    prevBtn.addEventListener('click', function () { load(step(cur, -1)); });
    nextBtn.addEventListener('click', function () { load(step(cur, 1)); });

    audio.addEventListener('play', sync);
    audio.addEventListener('pause', sync);
    audio.addEventListener('loadedmetadata', function () { seek.max = String(Math.floor(audio.duration || 0)); });
    audio.addEventListener('timeupdate', function () {
      if (!dragging) seek.value = String(Math.floor(audio.currentTime));
      time.textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration);
    });
    audio.addEventListener('ended', function () {
      var n = step(cur, 1);
      if (n !== -1) return load(n);
      outro.classList.add('is-open');
    });
    vol.addEventListener('input', function () { audio.volume = Number(vol.value); });
    seek.addEventListener('input', function () { dragging = true; });
    seek.addEventListener('change', function () {
      dragging = false;
      audio.currentTime = Number(seek.value);
    });

    sync();
  }

  // One play beacon per chapter per widget load; the host page's domain is
  // whatever the browser passes as the iframe's referrer (may be empty).
  var counted = {};
  var embedHost = '';
  try {
    var parent = document.referrer || (location.ancestorOrigins && location.ancestorOrigins[0]) || '';
    embedHost = parent ? new URL(parent).hostname : '';
  } catch (e) {}
  function countPlay(chapterId) {
    if (counted[chapterId]) return;
    counted[chapterId] = true;
    fetch(API + '/embed/plays', {
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter_id: chapterId, host: embedHost }),
    }).catch(function () {});
    if (window.umami) window.umami.track('widget-play', { host: embedHost || 'unknown', chapter: chapterId, title: titleRef });
  }

  function foot(href, label) {
    var f = el('div', 'ar-foot');
    var brand = link(href, 'ar-brand', 'AUDIO');
    brand.appendChild(el('b', '', 'RANOBE'));
    f.appendChild(brand);
    f.appendChild(link(href, '', label));
    return f;
  }

  function plural(n, forms) {
    var m10 = n % 10;
    var m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }

  function hours(sec) {
    if (!sec) return '0';
    var h = sec / 3600;
    return h < 1 ? '<1' : String(Math.round(h));
  }

  function renderNarrator(n) {
    var url = SITE + '/narrator/' + n.slug;
    app.textContent = '';
    document.title = n.name + ' · AudioRanobe';

    var card = el('div', 'ar-profile');
    if (n.cover_url) {
      var banner = el('img', 'ar-banner');
      banner.src = n.cover_url;
      banner.alt = '';
      card.appendChild(banner);
      card.appendChild(el('div', 'ar-banner-shade'));
    }
    var ava = link(url, 'ar-avatar');
    if (n.avatar_thumb_url || n.avatar_url) {
      var img = el('img');
      img.src = n.avatar_thumb_url || n.avatar_url;
      img.alt = '';
      ava.appendChild(img);
    } else {
      ava.textContent = (n.name || '?').charAt(0).toUpperCase();
    }
    card.appendChild(ava);

    var info = el('div', 'ar-meta');
    var nameRow = el('div', 'ar-name-row');
    nameRow.appendChild(link(url, 'ar-title', n.name));
    if (n.is_verified) {
      var mark = el('span', 'ar-verified');
      mark.title = 'Личность подтверждена администрацией';
      mark.appendChild(icon('check', 15));
      nameRow.appendChild(mark);
    }
    if (n.is_ai) nameRow.appendChild(el('span', 'ar-badge', 'ИИ'));
    info.appendChild(nameRow);

    var stats = el('div', 'ar-stats');
    [
      [String(n.titles_count), 'тайтлы'],
      [String(n.subscribers_count), 'подписчики'],
      [hours(n.seconds_narrated), 'часов озвучки'],
    ].forEach(function (st) {
      var box = el('div', 'ar-stat');
      box.appendChild(el('div', 'ar-stat-num', st[0]));
      box.appendChild(el('div', 'ar-stat-label', st[1]));
      stats.appendChild(box);
    });
    info.appendChild(stats);
    card.appendChild(info);
    app.appendChild(card);
    app.appendChild(foot(url, 'Профиль на сайте ↗'));
  }

  function renderCollection(c) {
    var url = SITE + '/collections/' + c.id;
    app.textContent = '';
    document.title = c.name + ' · AudioRanobe';

    var head = el('div', 'ar-head ar-head-col');
    var meta = el('div', 'ar-meta');
    meta.appendChild(link(url, 'ar-title', c.name));
    var subParts = [];
    if (c.user) subParts.push(c.user.display_name || c.user.username);
    subParts.push(c.items_count + ' ' + plural(c.items_count, ['тайтл', 'тайтла', 'тайтлов']));
    if (c.likes_count) subParts.push('♥ ' + c.likes_count);
    meta.appendChild(el('div', 'ar-sub', subParts.join(' · ')));
    head.appendChild(meta);
    app.appendChild(head);

    var list = el('ul', 'ar-list');
    var items = (c.items || []).filter(function (it) { return it.title; });
    if (items.length === 0) list.appendChild(el('li', 'ar-state', 'Подборка пока пуста.'));
    items.forEach(function (it) {
      var t = it.title;
      var li = el('li');
      var row = link(SITE + '/title/' + t.slug, 'ar-row');
      row.appendChild(cover(t.cover_thumb_url || t.cover_url, 'ar-thumb', 15));
      var text = el('span', 'ar-row-text');
      text.appendChild(el('span', 'ar-name', t.name));
      if (t.author) text.appendChild(el('span', 'ar-row-sub', t.author.name));
      row.appendChild(text);
      li.appendChild(row);
      list.appendChild(li);
    });
    app.appendChild(list);
    app.appendChild(foot(url, 'Подборка на сайте ↗'));
  }

  function load(path, fn, what) {
    fetch(API + path + '?embed=1', { credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) throw r.status;
        return r.json();
      })
      .then(fn)
      .catch(function () {
        showState('Не удалось загрузить ' + what + '.', SITE, 'AudioRanobe');
      });
  }

  var type = params.get('type') || 'volume';
  var id = params.get('id') || '';
  if (type === 'narrator' || type === 'collection') {
    if (!/^\d+$/.test(id)) return showState('Виджет не настроен.', SITE + '/dev/widgets', 'Настроить');
    if (type === 'narrator') load('/narrators/' + id, renderNarrator, 'карточку чтеца');
    else load('/collections/' + id, renderCollection, 'подборку');
    return;
  }

  if (!/^\d+$/.test(titleRef) || !volumeId) {
    showState('Плеер не настроен.', SITE + '/dev/widgets', 'Настроить');
    return;
  }
  load('/titles/' + titleRef, render, 'плеер');
})();
