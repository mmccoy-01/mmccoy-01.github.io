// A small, dependency-free weekly range picker shared by the literature pages.
export const isoDate = date => date.toISOString().slice(0, 10);
export const parseDate = value => new Date(`${value}T12:00:00Z`);
export function coverageForRun(id, days = 7) {
  const end = parseDate(id); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - Math.max(0, days - 1));
  return { id, start: isoDate(start), end: isoDate(end), inferred: true };
}
export function rangeLabel(run) {
  if (!run) return 'Choose a search week';
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt.format(parseDate(run.start))} – ${fmt.format(parseDate(run.end))}, ${run.end.slice(0, 4)}`;
}

class WeekCalendar extends HTMLElement {
  constructor() {
    super(); this._runs = []; this._value = ''; this.month = null;
    this.attachShadow({ mode: 'open' });
  }
  connectedCallback() {
    for (const key of ['runs', 'value']) {
      if (Object.prototype.hasOwnProperty.call(this, key)) { const value = this[key]; delete this[key]; this[key] = value; }
    }
    this.render();
    this.addEventListener('keydown', event => { if (event.key === 'Escape') this.shadowRoot.querySelector('details')?.removeAttribute('open'); });
  }
  set runs(value) { this._runs = value || []; this.render(); }
  get runs() { return this._runs; }
  set value(value) {
    this._value = value;
    const run = this._runs.find(r => r.id === value);
    if (run) { this.month = parseDate(run.start); this.month.setUTCDate(1); }
    this.render();
  }
  get value() { return this._value; }
  render() {
    if (!this.shadowRoot) return;
    const open = this.shadowRoot.querySelector('details')?.open || false;
    const selected = this._runs.find(r => r.id === this._value);
    const month = this.month || parseDate((this._runs[0]?.start || isoDate(new Date())).slice(0, 7) + '-01');
    const year = month.getUTCFullYear(), number = month.getUTCMonth();
    const first = new Date(Date.UTC(year, number, 1, 12));
    const offset = (first.getUTCDay() + 6) % 7;
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const day = new Date(Date.UTC(year, number, i - offset + 1, 12));
      const iso = isoDate(day);
      const run = this._runs.find(r => iso >= r.start && iso <= r.end);
      const active = run?.id === this._value;
      cells += `<button type="button" class="day ${run ? 'covered' : ''} ${active ? 'selected' : ''} ${day.getUTCMonth() !== number ? 'outside' : ''}" ${run ? `data-run="${run.id}"` : 'disabled'} aria-pressed="${active}" aria-label="${iso}${run ? ', search window ' + run.start + ' through ' + run.end : ', no search'}">${day.getUTCDate()}</button>`;
    }
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;position:relative;font:inherit;color:inherit;min-width:0}
      *{box-sizing:border-box} details{position:relative} summary{list-style:none;cursor:pointer;border:1px solid var(--calendar-line,#365453);border-radius:12px;padding:12px 14px;background:var(--calendar-bg,#102126);color:var(--calendar-ink,#e9f4ef);font-size:14px;min-height:46px}summary::-webkit-details-marker{display:none}summary::after{content:'▾';float:right;margin-left:12px}
      .popup{position:absolute;left:0;top:calc(100% + 8px);width:min(330px,calc(100vw - 48px));background:#102126;border:1px solid #365453;color:#e9f4ef;border-radius:16px;padding:16px;box-shadow:0 20px 60px #0008;z-index:100}
      .heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px}.heading button{border:1px solid #365453;border-radius:8px;background:none;color:inherit;padding:7px 12px;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.weekday{text-align:center;font-size:11px;color:#a7bdb8;padding:6px 0}.day{border:1px solid transparent;background:none;color:#9bb0ad;border-radius:5px;aspect-ratio:1;font:inherit;font-size:13px}.day.covered{background:#264d49;color:#d9fff2;cursor:pointer}.day.selected{background:#a5e6cc;color:#102b24;font-weight:800}.day.outside{opacity:.5}.day:disabled{opacity:.35}.day:hover:not(:disabled){border-color:#fff}.day:focus-visible,summary:focus-visible,.heading button:focus-visible{outline:3px solid #f0c781;outline-offset:2px}.legend{font-size:11px;line-height:1.6;color:#a7bdb8;margin:12px 0 0}
    </style><details ${open ? 'open' : ''}><summary>${selected ? rangeLabel(selected) : this._runs.length ? 'Choose a search week' : 'No search weeks available'}</summary><div class="popup"><div class="heading"><button type="button" data-month="-1" aria-label="Previous month">‹</button><strong>${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month)}</strong><button type="button" data-month="1" aria-label="Next month">›</button></div><div class="grid">${['M','T','W','T','F','S','S'].map(d => `<span class="weekday">${d}</span>`).join('')}${cells}</div><p class="legend">Solid days have search coverage. Select any day in a highlighted week.${selected?.inferred ? ' Coverage inferred from the run date; the run itself is dated ' + selected.id + '.' : ''}</p></div></details>`;
    this.shadowRoot.querySelectorAll('[data-month]').forEach(button => button.addEventListener('click', () => {
      this.month = new Date(Date.UTC(year, number + Number(button.dataset.month), 1, 12));
      this.render(); this.shadowRoot.querySelector(`[data-month="${button.dataset.month}"]`).focus();
    }));
    this.shadowRoot.querySelectorAll('[data-run]').forEach(button => button.addEventListener('click', () => {
      this.value = button.dataset.run;
      this.shadowRoot.querySelector('details').open = false;
      this.shadowRoot.querySelector('summary').focus();
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }));
  }
}
customElements.define('week-calendar', WeekCalendar);
