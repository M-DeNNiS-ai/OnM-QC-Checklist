/* ---------- Theme ---------- */
let currentTheme = localStorage.getItem('bqc_theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('bqc_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  render();
}
