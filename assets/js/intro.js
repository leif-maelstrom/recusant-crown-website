(function () {
  var VERBS = ["Seek", "Grasp", "Fear", "Flee", "Fight", "Claim", "Drop", "Love", "Hate", "Believe"];
  var FINAL = "Seek";
  var START = 2900;   // ms: verbs begin after the crown lands
  var STEP  = 280;    // ms per flashing verb
  var GAP   = 40;     // ms of darkness between verbs

  var root  = document.getElementById("rc-intro");
  var verb  = document.getElementById("rc-verb");
  if (!root || !verb) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function show(word, cls, dur) {
    verb.className = "";
    verb.textContent = word;
    verb.style.setProperty("--rc-dur", dur + "ms");
    verb.style.setProperty("--rc-jx", (Math.random() * 16 - 8).toFixed(1) + "px");
    void verb.offsetWidth;            // restart the animation
    verb.className = cls;
  }

  function finish() {
    verb.className = ""; verb.textContent = FINAL; verb.style.opacity = 1;
    root.classList.add("rc-titled", "rc-done");
  }

  function play() {
    timers.forEach(clearTimeout); timers = [];
    verb.textContent = ""; verb.className = ""; verb.style.opacity = "";
    root.classList.remove("rc-play", "rc-titled", "rc-done");
    if (reduce) { finish(); return; }
    void root.offsetWidth;
    root.classList.add("rc-play");

    var t = START;
    VERBS.forEach(function (w) {
      later(function () { show(w, "rc-flash", STEP - GAP); }, t);
      t += STEP;
    });
    later(function () { show(FINAL, "rc-settle", 1400); }, t + 250);
    later(function () { root.classList.add("rc-titled"); }, t + 1500);
    later(function () { root.classList.add("rc-done"); }, t + 3300);
  }

  document.getElementById("rc-replay").addEventListener("click", play);
  play();
})();
