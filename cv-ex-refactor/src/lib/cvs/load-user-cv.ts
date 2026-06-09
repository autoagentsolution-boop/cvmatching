import 'server-only';
import { cache } from 'react';
import { getUserCv, listUserCvs } from './repo';

// React cache() dedupes calls within a single request so that the parent
// layout and its nested page can both fetch the same CV without two DB
// round-trips. Outside an RSC request the cache is a no-op.
export const loadUserCv = cache(getUserCv);
export const loadUserCvList = cache(listUserCvs);
