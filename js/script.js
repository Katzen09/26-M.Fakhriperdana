'use strict';

/* ==========================================================
   Life Dashboard
   Sections: helpers, theme, greeting, focus timer, tasks, links
   ========================================================== */

/* ---------- Constants ---------- */
const STORAGE_KEYS = {
  name: 'ld-name',
  theme: 'ld-theme',
  tasks: 'ld-tasks',
  sort: 'ld-sort',
  links: 'ld-links',
};

const FOCUS_SECONDS = 25 * 60;

const DEFAULT_LINKS = [
  { id: 'l1', name: 'Google', url: 'https://www.google.com/' },
  { id: 'l2', name: 'YouTube', url: 'https://www.youtube.com/' },
  { id: 'l3', name: 'GitHub', url: 'https://github.com/' },
];

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    return fallback; // storage blocked or data corrupted
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // storage full or blocked: the app keeps working for this session
  }
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function createEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------- Theme (light / dark) ---------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const button = $('theme-btn');
  button.textContent = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  button.setAttribute('aria-pressed', String(theme === 'dark'));
}

function initTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let theme = loadData(STORAGE_KEYS.theme, prefersDark ? 'dark' : 'light');
  applyTheme(theme);

  $('theme-btn').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    saveData(STORAGE_KEYS.theme, theme);
    applyTheme(theme);
  });
}

/* ---------- Greeting, date and clock ---------- */
let userName = loadData(STORAGE_KEYS.name, '');

function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  if (hour >= 18 && hour < 22) return 'Good evening';
  return 'Good night';
}

function renderGreeting(hour) {
  $('greeting-text').textContent = getGreeting(hour) + (userName ? ',' : '');
  $('name-btn').textContent = userName || 'set your name';
}

function updateClock() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  $('date').textContent = now.toLocaleDateString([], {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  renderGreeting(now.getHours());
}

function showNameForm(show) {
  $('name-form').hidden = !show;
  $('name-btn').hidden = show;
  if (show) {
    $('name-input').value = userName;
    $('name-input').focus();
  } else {
    $('name-btn').focus();
  }
}

function initGreeting() {
  $('name-btn').addEventListener('click', () => showNameForm(true));

  $('name-form').addEventListener('submit', (event) => {
    event.preventDefault();
    userName = $('name-input').value.trim();
    saveData(STORAGE_KEYS.name, userName);
    showNameForm(false);
    updateClock();
  });

  $('name-input').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') showNameForm(false);
  });

  updateClock();
  setInterval(updateClock, 1000);
}

/* ---------- Focus timer ---------- */
let remaining = FOCUS_SECONDS;
let endTime = 0;
let timerId = null;

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return minutes + ':' + seconds;
}

function renderTimer() {
  $('timer-display').textContent = formatTime(remaining);
  const elapsed = (FOCUS_SECONDS - remaining) / FOCUS_SECONDS;
  $('ring').style.setProperty('--p', elapsed * 360 + 'deg');
  document.title = timerId ? formatTime(remaining) + ' · Life Dashboard' : 'Life Dashboard';
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function tickTimer() {
  remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  if (remaining === 0) {
    stopTimer();
    $('timer-status').textContent = 'Session complete. Time for a short break.';
  }
  renderTimer();
}

function startTimer() {
  if (timerId) return;
  if (remaining === 0) remaining = FOCUS_SECONDS;
  endTime = Date.now() + remaining * 1000;
  timerId = setInterval(tickTimer, 250);
  $('timer-status').textContent = 'Focus time. Stay with one task.';
  renderTimer();
}

function pauseTimer() {
  if (!timerId) return;
  tickTimer();
  stopTimer();
  $('timer-status').textContent = 'Paused. Press Start to continue.';
  renderTimer();
}

function resetTimer() {
  stopTimer();
  remaining = FOCUS_SECONDS;
  $('timer-status').textContent = 'Ready for a 25-minute session.';
  renderTimer();
}

function initTimer() {
  $('timer-start').addEventListener('click', startTimer);
  $('timer-stop').addEventListener('click', pauseTimer);
  $('timer-reset').addEventListener('click', resetTimer);
  renderTimer();
}

/* ---------- To-do list ---------- */
let tasks = loadData(STORAGE_KEYS.tasks, []);
let sortMode = loadData(STORAGE_KEYS.sort, 'newest');
let editingId = null;

function saveTasks() {
  saveData(STORAGE_KEYS.tasks, tasks);
}

// Tasks are stored oldest-first; sorting only changes how they are shown.
function getSortedTasks() {
  const list = [...tasks];
  switch (sortMode) {
    case 'oldest': return list;
    case 'az': return list.sort((a, b) => a.text.localeCompare(b.text));
    case 'za': return list.sort((a, b) => b.text.localeCompare(a.text));
    case 'open': return list.sort((a, b) => Number(a.done) - Number(b.done));
    default: return list.reverse(); // newest first
  }
}

function buildTaskItem(task) {
  const item = createEl('li', task.done ? 'task done' : 'task');

  const checkbox = createEl('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.done;
  checkbox.setAttribute('aria-label', 'Mark "' + task.text + '" as done');
  checkbox.addEventListener('change', () => {
    task.done = checkbox.checked;
    saveTasks();
    renderTasks();
  });
  item.appendChild(checkbox);

  if (editingId === task.id) {
    const input = createEl('input');
    input.type = 'text';
    input.maxLength = 120;
    input.value = task.text;
    input.setAttribute('aria-label', 'Edit task');

    const commit = () => {
      const value = input.value.trim();
      if (value) task.text = value;
      editingId = null;
      saveTasks();
      renderTasks();
    };
    const cancel = () => {
      editingId = null;
      renderTasks();
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') commit();
      if (event.key === 'Escape') cancel();
    });

    const saveBtn = createEl('button', 'small-btn', 'Save');
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', commit);

    const cancelBtn = createEl('button', 'small-btn', 'Cancel');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', cancel);

    item.append(input, saveBtn, cancelBtn);
    setTimeout(() => input.focus(), 0);
    return item;
  }

  const text = createEl('span', 'task-text', task.text);

  const editBtn = createEl('button', 'small-btn', 'Edit');
  editBtn.type = 'button';
  editBtn.addEventListener('click', () => {
    editingId = task.id;
    renderTasks();
  });

  const deleteBtn = createEl('button', 'small-btn danger', 'Delete');
  deleteBtn.type = 'button';
  deleteBtn.addEventListener('click', () => {
    tasks = tasks.filter((t) => t.id !== task.id);
    saveTasks();
    renderTasks();
  });

  item.append(text, editBtn, deleteBtn);
  return item;
}

function renderTasks() {
  const list = $('task-list');
  list.replaceChildren(...getSortedTasks().map(buildTaskItem));

  const doneCount = tasks.filter((t) => t.done).length;
  $('task-count').textContent = tasks.length ? doneCount + ' of ' + tasks.length + ' done' : '';
  $('task-empty').hidden = tasks.length > 0;
}

function initTasks() {
  $('sort-select').value = sortMode;

  $('sort-select').addEventListener('change', (event) => {
    sortMode = event.target.value;
    saveData(STORAGE_KEYS.sort, sortMode);
    renderTasks();
  });

  $('task-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = $('task-input').value.trim();
    if (!text) return;
    tasks.push({ id: makeId(), text: text, done: false });
    saveTasks();
    $('task-input').value = '';
    renderTasks();
  });

  renderTasks();
}

/* ---------- Quick links ---------- */
let links = loadData(STORAGE_KEYS.links, DEFAULT_LINKS);

function saveLinks() {
  saveData(STORAGE_KEYS.links, links);
}

// Accepts "example.com" or a full address; only http(s) links are allowed.
function normalizeUrl(value) {
  const text = value.trim();
  if (!text) return null;
  const withScheme = /^https?:\/\//i.test(text) ? text : 'https://' + text;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes('.') ? url.href : null;
  } catch (error) {
    return null;
  }
}

function buildLinkItem(link) {
  const item = createEl('li', 'link-item');

  const anchor = createEl('a', 'link-btn', link.name);
  anchor.href = link.url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';

  const removeBtn = createEl('button', 'link-remove', '×');
  removeBtn.type = 'button';
  removeBtn.setAttribute('aria-label', 'Remove ' + link.name);
  removeBtn.addEventListener('click', () => {
    links = links.filter((l) => l.id !== link.id);
    saveLinks();
    renderLinks();
  });

  item.append(anchor, removeBtn);
  return item;
}

function renderLinks() {
  $('link-list').replaceChildren(...links.map(buildLinkItem));
}

function initLinks() {
  $('link-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const url = normalizeUrl($('link-url').value);
    const error = $('link-error');

    if (!url) {
      error.textContent = 'Enter a valid address, for example example.com.';
      error.hidden = false;
      return;
    }

    error.hidden = true;
    links.push({ id: makeId(), name: $('link-name').value.trim(), url: url });
    saveLinks();
    $('link-form').reset();
    renderLinks();
  });

  renderLinks();
}

/* ---------- Start ---------- */
initTheme();
initGreeting();
initTimer();
initTasks();
initLinks();
