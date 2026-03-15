import type { EpgChannel, EpgData, EpgProgram } from '../types/epg';

function parseXmltvDate(s: string): Date {
  // 20240315120000 +0000
  const cleaned = s.replace(/\s+/g, '').slice(0, 14);
  if (cleaned.length >= 14) {
    const y = parseInt(cleaned.slice(0, 4), 10);
    const m = parseInt(cleaned.slice(4, 6), 10) - 1;
    const d = parseInt(cleaned.slice(6, 8), 10);
    const h = parseInt(cleaned.slice(8, 10), 10);
    const min = parseInt(cleaned.slice(10, 12), 10);
    const sec = parseInt(cleaned.slice(12, 14), 10);
    return new Date(Date.UTC(y, m, d, h, min, sec));
  }
  return new Date(0);
}

export function parseXmltv(xml: string): EpgData {
  const channels: EpgChannel[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return { channels };
  }

  const channelEls = doc.querySelectorAll('channel');
  const channelMap = new Map<string, { displayName: string; icon?: string }>();
  channelEls.forEach((el) => {
    const id = el.getAttribute('id') ?? '';
    const displayName =
      el.querySelector('display-name')?.textContent?.trim() ?? id;
    const icon = el.querySelector('icon')?.getAttribute('src') ?? undefined;
    channelMap.set(id, { displayName, icon });
  });

  const programmeEls = doc.querySelectorAll('programme');
  const programsByChannel = new Map<string, EpgProgram[]>();

  programmeEls.forEach((el) => {
    const channelId = el.getAttribute('channel') ?? '';
    const startStr = el.getAttribute('start') ?? '';
    const stopStr = el.getAttribute('stop') ?? '';
    const title = el.querySelector('title')?.textContent?.trim() ?? '';
    const desc = el.querySelector('desc')?.textContent?.trim();
    const category = el.querySelector('category')?.textContent?.trim();
    const icon = el.querySelector('icon')?.getAttribute('src');

    const start = parseXmltvDate(startStr);
    const end = parseXmltvDate(stopStr);
    const program: EpgProgram = {
      id: `${channelId}-${start.getTime()}`,
      channelId,
      title,
      start,
      end,
      description: desc || undefined,
      category: category || undefined,
      icon: icon || undefined,
    };

    if (!programsByChannel.has(channelId)) {
      programsByChannel.set(channelId, []);
    }
    programsByChannel.get(channelId)!.push(program);
  });

  channelMap.forEach((meta, id) => {
    const programs = (programsByChannel.get(id) ?? []).sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );
    channels.push({
      id,
      displayName: meta.displayName,
      icon: meta.icon,
      programs,
    });
  });

  return { channels };
}
