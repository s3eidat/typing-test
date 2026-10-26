/* Typing Test — words from built-in lists, timing from Date.now(), nothing leaves the page. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;
  var EN = ("the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about " +
    "who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two " +
    "how our work first well way even new want because any these give day most us is was are been has had were said did made find long down very still place great small every found " +
    "those never under might while last right life show before need home same around another came three high again world hand house keep point always large often together asked " +
    "school important until form food water story young night watch example light second number book through change move answer study learn plant cover state never begin city " +
    "earth eye open seem walk paper group music those both mark letter river mile feet care family close leave talk car friend start real light question idea between follow list").split(" ");
  var AR = ("في من على إلى أن هذا التي الذي كان مع هذه عن قد كل بين بعد ما لا هو هي نحن أنا أنت يوم سنة الوقت الناس العالم البيت المدرسة الكتاب الماء الشمس القمر الليل النهار " +
    "صباح مساء جميل كبير صغير جديد قديم طويل قصير سريع بطيء سعيد أول آخر كثير قليل اليوم غدا أمس الآن هنا هناك لماذا كيف متى أين ماذا نعم شكرا مرحبا " +
    "يكتب يقرأ يذهب يأتي يعمل يدرس يحب يريد يعرف يقول يرى يسمع يفكر يلعب يأكل يشرب ينام يجلس يمشي يركض يتكلم يسأل يجيب يفتح يغلق يبدأ ينتهي " +
    "أب أم أخ أخت صديق معلم طالب طبيب مدينة شارع سوق باب نافذة سيارة طريق بحر جبل شجرة وردة طعام خبز قهوة شاي عمل درس قلم ورقة لون أحمر أخضر أزرق أبيض " +
    "عربي لغة كلمة جملة سؤال جواب فكرة قصة حياة وطن سلام حب علم نور قلب يد عين رأس وجه صوت ساعة دقيقة شهر أسبوع صيف شتاء ربيع خريف مطر ريح سماء أرض نجمة طائر قطة حصان مكتب غرفة مطبخ حديقة ملعب مستشفى جامعة").split(" ");
  var MODES = { t15: { time: 15 }, t30: { time: 30 }, t60: { time: 60 }, w10: { words: 10 }, w25: { words: 25 }, w50: { words: 50 } };

  var mode = MODES[S3.store("tt.mode")] ? S3.store("tt.mode") : "t30";
  var lang = S3.store("tt.lang") === "ar" ? "ar" : "en";
  var pbs = S3.store("tt.pb") || {};
  var st, spans = [], timer = null;

  // ---------- fair random ----------
  function randInt(n) { // uniform 0..n-1 via rejection sampling
    var lim = Math.floor(0x100000000 / n) * n, b = new Uint32Array(1);
    do crypto.getRandomValues(b); while (b[0] >= lim);
    return b[0] % n;
  }
  function genWords(list, n) { var out = [], last = -1; while (out.length < n) { var i = randInt(list.length); if (i !== last) { out.push(list[i]); last = i; } } return out; }

  // ---------- pure scoring ----------
  // Apply a new input value: count added keystrokes and which expected keys were missed.
  function diffInput(oldV, newV, target, acc) {
    var k = 0; while (k < oldV.length && k < newV.length && oldV[k] === newV[k]) k++;
    for (var i = k; i < newV.length; i++) {
      acc.keys++;
      if (newV[i] !== target[i]) { acc.errs++; var t = target[i] === " " ? "space" : target[i]; if (t) acc.missed[t] = (acc.missed[t] || 0) + 1; }
    }
    return acc;
  }
  function score(target, typed, ms, keys, errs) {
    var correct = 0;
    for (var i = 0; i < typed.length; i++) if (typed[i] === target[i]) correct++;
    var min = Math.max(ms, 1) / 60000;
    return { correct: correct, wrong: typed.length - correct, net: correct / 5 / min, raw: typed.length / 5 / min, acc: keys ? (keys - errs) / keys : 1 };
  }

  // ---------- test lifecycle ----------
  function reset() {
    clearInterval(timer); timer = null;
    var m = MODES[mode], words = genWords(lang === "ar" ? AR : EN, m.words || 400);
    st = { target: words.join(" "), typed: "", start: 0, end: 0, keys: 0, errs: 0, missed: {}, done: false };
    var box = $("#words"); box.innerHTML = ""; box.dir = lang === "ar" ? "rtl" : "ltr"; box.scrollTop = 0;
    spans = [];
    words.forEach(function (w, wi) {
      var ws = S3.h("span", { "class": "w" });
      for (var i = 0; i < w.length; i++) { var c = S3.h("span", { "class": "c", text: w[i] }); spans.push(c); ws.appendChild(c); }
      box.appendChild(ws);
      if (wi < words.length - 1) { var sp = S3.h("span", { "class": "c sp", text: " " }); spans.push(sp); box.appendChild(sp); }
    });
    var end = S3.h("span", { "class": "c end", text: "" }); spans.push(end); box.appendChild(end);
    $("#typer").value = ""; $("#typer").dir = box.dir;
    $("#arena").classList.remove("running", "done");
    $("#results").hidden = true;
    paint(0); live(); showPb();
  }
  function paint(from) {
    for (var i = from; i < spans.length; i++) {
      var s = spans[i], t = st.typed[i];
      s.classList.toggle("ok", t !== undefined && t === st.target[i]);
      s.classList.toggle("bad", t !== undefined && t !== st.target[i]);
      s.classList.toggle("cur", i === st.typed.length);
      if (i > st.typed.length + 1 && !s.classList.contains("ok") && !s.classList.contains("bad")) break;
    }
    var cur = spans[Math.min(st.typed.length, spans.length - 1)], box = $("#words");
    var lh = parseFloat(getComputedStyle(box).lineHeight) || 44;
    if (cur) box.scrollTop = Math.max(0, Math.floor((cur.offsetTop - box.offsetTop) / lh) - 1) * lh;
  }
  function elapsed() { return st.start ? (st.end || Date.now()) - st.start : 0; }
  function live() {
    var m = MODES[mode], ms = elapsed();
    if (m.time) {
      var left = Math.max(0, m.time - ms / 1000);
      $("#lTime").textContent = Math.ceil(left); $("#lTimeLbl").textContent = "seconds";
      if (st.start && !st.done && left <= 0) finish();
    } else {
      var typedWords = st.typed ? st.typed.split(" ").length - (st.typed.slice(-1) === " " ? 1 : 0) : 0;
      $("#lTime").textContent = Math.min(typedWords, m.words) + "/" + m.words; $("#lTimeLbl").textContent = "words";
    }
    var s = score(st.target, st.typed, ms, st.keys, st.errs);
    $("#lWpm").textContent = ms > 1500 ? Math.round(s.net) : 0;
    $("#lAcc").textContent = Math.round(s.acc * 100) + "%";
  }
  function onInput() {
    if (st.done) { $("#typer").value = st.typed; return; }
    var v = $("#typer").value;
    if (v.length > st.target.length) { v = v.slice(0, st.target.length); $("#typer").value = v; }
    if (!st.start && v.length) { st.start = Date.now(); $("#arena").classList.add("running"); timer = setInterval(live, 100); }
    var k = 0; while (k < st.typed.length && k < v.length && st.typed[k] === v[k]) k++;
    diffInput(st.typed, v, st.target, st);
    st.typed = v;
    paint(Math.max(0, k - 1)); live();
    if (MODES[mode].words && v.length === st.target.length) finish();
  }
  function finish() {
    if (st.done) return;
    st.done = true; st.end = MODES[mode].time ? st.start + MODES[mode].time * 1000 : Date.now();
    clearInterval(timer); timer = null;
    $("#arena").classList.remove("running"); $("#arena").classList.add("done");
    live(); showResults(); S3.done();
  }
  function stat(label, v) { return '<div class="stat"><b>' + S3.esc(v) + "</b><span>" + S3.esc(label) + "</span></div>"; }
  function showResults() {
    var ms = elapsed(), s = score(st.target, st.typed, ms, st.keys, st.errs), key = mode + "-" + lang;
    var wpm = Math.round(s.net), best = pbs[key], isPb = st.typed.length >= 10 && (!best || wpm > best.wpm);
    if (isPb) { pbs[key] = { wpm: wpm, acc: Math.round(s.acc * 100), date: new Date().toISOString().slice(0, 10) }; S3.store("tt.pb", pbs); }
    $("#newPb").hidden = !isPb;
    $("#resMode").textContent = (MODES[mode].time ? MODES[mode].time + " seconds" : MODES[mode].words + " words") + " · " + (lang === "ar" ? "Arabic" : "English");
    $("#resStats").innerHTML = stat("net WPM", wpm) + stat("raw WPM", Math.round(s.raw)) + stat("accuracy", Math.round(s.acc * 100) + "%") +
      stat("correct / wrong chars", s.correct + " / " + s.wrong) + stat("time", (ms / 1000).toFixed(1) + "s");
    var miss = Object.keys(st.missed).sort(function (a, b) { return st.missed[b] - st.missed[a]; }).slice(0, 10), box = $("#missed");
    box.innerHTML = "";
    if (!miss.length) box.appendChild(S3.h("span", { "class": "muted", text: "None. Flawless!" }));
    miss.forEach(function (k) { box.appendChild(S3.h("span", { "class": "chip bad" }, [S3.h("b", { "class": "key", text: k }), " × " + st.missed[k]])); });
    $("#results").hidden = false;
    st.result = "Typing Test (" + $("#resMode").textContent + "): " + wpm + " WPM, " + Math.round(s.acc * 100) + "% accuracy";
    showPb();
  }
  function showPb() {
    var b = pbs[mode + "-" + lang];
    $("#pb").textContent = b ? "Best: " + b.wpm + " WPM · " + b.acc + "%" : "No personal best yet";
    $("#pb").className = b ? "chip accent" : "chip";
  }

  // ---------- wiring ----------
  function seg(sel, val, pick) {
    $$(sel + " button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === val));
      b.addEventListener("click", function () {
        $$(sel + " button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        pick(b.dataset.v); reset(); $("#typer").focus();
      });
    });
  }
  seg("#mode", mode, function (v) { mode = v; S3.store("tt.mode", v); });
  seg("#lang", lang, function (v) { lang = v; S3.store("tt.lang", v); });
  var typer = $("#typer");
  typer.addEventListener("input", onInput);
  typer.addEventListener("focus", function () { $("#arena").classList.add("focused"); });
  typer.addEventListener("blur", function () { $("#arena").classList.remove("focused"); });
  typer.addEventListener("keydown", function (e) {
    // Keep the caret at the end: the test only allows typing forward and Backspace.
    if (/^(Arrow|Home|End|PageUp|PageDown)/.test(e.key)) e.preventDefault();
  });
  typer.addEventListener("select", function () { var n = typer.value.length; if (typer.selectionStart !== n) typer.setSelectionRange(n, n); });
  typer.addEventListener("paste", function (e) { e.preventDefault(); });
  typer.addEventListener("drop", function (e) { e.preventDefault(); });
  $("#restart").addEventListener("click", function () { reset(); typer.focus(); });
  $("#copyRes").addEventListener("click", function () { if (st.result) S3.copy(st.result); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Tab" || e.key === "Escape") {
      if (e.target !== typer && e.target.closest("input, textarea, select, button, a") && e.key === "Tab") return;
      e.preventDefault(); reset(); typer.focus(); return;
    }
    if (document.activeElement !== typer && !e.target.closest("input, textarea, select, button, a") && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typer.focus();
  });

  reset();

  window.S3_DEMO = function () {
    mode = "t30"; lang = "en";
    reset();
    typer.focus();
    var typed = st.target.slice(0, 74), arr = typed.split("");
    arr[9] = arr[9] === "x" ? "y" : "x"; arr[41] = arr[41] === "q" ? "w" : "q";
    st.start = Date.now() - 14000; st.keys = 80; st.errs = 4; st.missed = { e: 2, space: 1, r: 1 };
    st.typed = arr.join(""); typer.value = st.typed;
    $("#arena").classList.add("running"); timer = setInterval(live, 100);
    paint(0); live();
    pbs["t30-en"] = pbs["t30-en"] || { wpm: 64, acc: 97, date: "2026-10-20" }; showPb();
  };

  window.S3_SELFTEST = function () {
    var acc = diffInput("the", "thx", "the cat", { keys: 0, errs: 0, missed: {} });
    var a = acc.keys === 1 && acc.errs === 1 && acc.missed.e === 1;
    diffInput("th", "the cat", "the cat", acc); var b = acc.keys === 6 && acc.errs === 1;
    diffInput("the", "theX", "the cat", acc); var b2 = acc.missed.space === 1;
    var s = score("the cat", "the cbt", 60000, 7, 1);
    var c = s.correct === 6 && s.wrong === 1 && Math.abs(s.net - 1.2) < 1e-9 && Math.abs(s.raw - 1.4) < 1e-9 && Math.abs(s.acc - 6 / 7) < 1e-9;
    var s2 = score("hello world", "hello world", 6000, 11, 0), d = Math.round(s2.net) === 22 && s2.acc === 1;
    var counts = [0, 0, 0], e = true;
    for (var i = 0; i < 3000; i++) counts[randInt(3)]++;
    counts.forEach(function (n) { if (n < 850 || n > 1150) e = false; });
    var w = genWords(["a", "b"], 50), f = w.length === 50 && w.every(function (x, j) { return !j || x !== w[j - 1]; });
    return a && b && b2 && c && d && e && f && EN.length > 150 && AR.length > 150;
  };
})();
