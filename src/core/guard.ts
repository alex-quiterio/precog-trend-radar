// PRECOG / Trend Radar · Scope guard: refuse topics that look like a person, handle or email.
export const FIRST_NAMES = new Set(
  (
    'james john robert michael david richard joseph thomas charles christopher daniel matthew anthony donald steven paul andrew joshua kenneth kevin brian george timothy ronald edward jason jeffrey ryan jacob gary nicholas eric jonathan stephen larry justin scott brandon benjamin samuel gregory alexander patrick dennis tyler aaron adam nathan henry zachary douglas peter kyle noah ethan jeremy christian keith roger terry sean austin carl arthur lawrence dylan jesse bryan joe billy bruce gabriel logan albert willie alan eugene russell randy philip harry vincent bobby johnny bradley ' +
    'mary patricia jennifer linda elizabeth barbara susan jessica sarah karen lisa nancy betty sandra margaret ashley kimberly emily donna michelle carol amanda melissa deborah stephanie rebecca sharon laura cynthia kathleen amy angela shirley anna brenda pamela emma nicole helen samantha katherine christine debra rachel carolyn janet catherine maria heather diane julie joyce victoria kelly christina lauren joan evelyn olivia judith megan cheryl martha andrea frances hannah jacqueline gloria teresa ann sara janice julia marie madison kathryn abigail sophia alice judy isabella beverly denise theresa natalie ' +
    'elon satya sundar jensen linus sam tim jeff sergey steve taylor kanye oprah barack kamala vladimir narendra emmanuel olaf rishi keir giorgia jacinda greta malala lionel cristiano neymar serena rafael novak lebron kobe beyonce rihanna selena ariana dua billie adele ' +
    'alexandre alexandra joao jose miguel pedro tiago rui nuno ricardo andre bruno carlos diogo francisco goncalo luis marta ines beatriz mariana catarina sofia leonor rita joana filipa ana jan pieter sanne lotte daan bram sven lars anders mohammed muhammad ahmed ali fatima aisha hiroshi yuki kenji wei mei raj priya arjun deepak ivan dmitri olga natasha hans klaus jurgen francois pierre jean luc marco giuseppe giulia sergio javier diego lucia carmen'
  ).split(/\s+/),
);
export const AMBIGUOUS_NAMES = new Set(
  'mark will bill jack frank max grace rose ruby jade amber jordan chase hunter april may june faith hope joy dawn summer ray rob pat sue art gene guy sage ash victor angel page drew dean grant miles wade cliff penny'.split(
    ' ',
  ),
);
export const TITLES = /^(mr|mrs|ms|miss|mx|dr|prof|sir|dame|lord|lady|president|senator|ceo)\.?\s/i;
export function looksLikePerson(raw: unknown): boolean {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (/^@\w/.test(s) || /\S+@\S+\.\S+/.test(s) || /^(u|user)\/\w/i.test(s)) return true;
  if (TITLES.test(s)) return true;
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 3) return false;
  if (!words.every(w => /^[\p{L}][\p{L}'’.-]*$/u.test(w))) return false;
  const first = words[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (FIRST_NAMES.has(first)) return true;
  return words.every(w => /^\p{Lu}\p{Ll}/u.test(w)) && AMBIGUOUS_NAMES.has(first);
}
