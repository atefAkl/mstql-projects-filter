import crypto from 'crypto';
import { ParsedProjectItem } from '../core/interfaces/ICollectorAdapter';

export function computeHash(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

export function computeNormalizedHash(item: ParsedProjectItem): string {
  const normalizedObject = {
    title: item.title ? item.title.trim() : '',
    descriptionRaw: item.descriptionRaw ? item.descriptionRaw.trim() : '',
    budgetMinUsd: item.budgetMinUsd ?? null,
    budgetMaxUsd: item.budgetMaxUsd ?? null,
    bidsCountParsed: item.bidsCountParsed ?? 0,
    executionDaysParsed: item.executionDaysParsed ?? null,
    clientNameRaw: item.clientNameRaw ? item.clientNameRaw.trim() : null,
    statusRaw: item.statusRaw ? item.statusRaw.trim() : 'مفتوح',
    skillsTagsRaw: Array.isArray(item.skillsTagsRaw) ? [...item.skillsTagsRaw].sort() : [],
  };

  return computeHash(JSON.stringify(normalizedObject));
}
