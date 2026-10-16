// What's coming up for school, so Studyboy can lead with it. Built from two
// things the command bar already records when you paste a school
// notification: the checklist items it adds (tagged "School · <subject>",
// with due dates, including study-plan steps) and the notification log.
// Pure functions: the page fetches the rows and passes them in.

const DAY = 86400000;

export function isoDay(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function dayNumber(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}

export function daysBetween(fromIso, toIso) {
  return Math.round(dayNumber(toIso) - dayNumber(fromIso));
}

export function dueLabel(days) {
  if (days < 0) return days === -1 ? 'Yesterday' : `${-days} days ago`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  const weeks = Math.round(days / 7);
  return days % 7 === 0 || days > 13 ? `In ${weeks} week${weeks === 1 ? '' : 's'}` : `In ${days} days`;
}

/** "School · Science" -> "Science"; anything not tagged School -> null. */
export function subjectFromTag(tag) {
  const m = String(tag || '').match(/^\s*School\s*[·•\-:|]\s*(.+?)\s*$/i);
  return m ? m[1] : null;
}

const ASSESSMENT = /\b(test|exam|assessment|quiz|task|assignment|essay|presentation|report|due|submit|hand in|practical|prac)\b/i;

/** A notification is a study update when it's filed under a real subject. */
export function isStudyNotification(row) {
  const subjects = Array.isArray(row?.subjects) ? row.subjects : [];
  return subjects.some((s) => s && s !== 'General');
}

/**
 * checklist: rows from aio_checklist ({ id, title, tag, due_date, status, priority })
 * Returns the open school items due from today up to `horizon` days ahead,
 * soonest first, assessments ahead of plan steps on the same day.
 */
export function buildComingUp(checklist, { today = isoDay(), horizon = 28, limit = 8 } = {}) {
  return (checklist || [])
    .filter((r) => r && r.due_date && r.status !== 'done')
    .map((r) => {
      const subject = subjectFromTag(r.tag);
      const days = daysBetween(today, r.due_date);
      return {
        id: r.id,
        title: r.title,
        subject,
        due: r.due_date,
        days,
        label: dueLabel(days),
        assessment: ASSESSMENT.test(r.title || '') || r.priority === 'high',
      };
    })
    .filter((r) => r.subject && r.days >= 0 && r.days <= horizon)
    .sort((a, b) => a.days - b.days || Number(b.assessment) - Number(a.assessment))
    .slice(0, limit);
}

/** Study-related notifications only, newest first. */
export function studyNotifications(rows, limit = 4) {
  return (rows || [])
    .filter(isStudyNotification)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map((r) => ({ ...r, subjects: r.subjects.filter((s) => s !== 'General') }));
}
