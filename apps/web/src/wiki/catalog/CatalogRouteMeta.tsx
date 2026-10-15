// SPDX-License-Identifier: GPL-3.0-only
import React, {useEffect} from 'react';
import Head from '@docusaurus/Head';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useHistory} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {canonicalCatalogHref} from '../../../../../packages/wiki-schema/src/catalog-routes';

export default function CatalogRouteMeta({path, search, hash}: {path: string; search: string; hash: string}) {
  const history = useHistory(), base = useBaseUrl('/'), {siteConfig} = useDocusaurusContext();
  const current = path + search + hash, canonical = canonicalCatalogHref(current);
  useEffect(() => {
    if (current !== canonical) history.replace(base.replace(/\/$/, '') + canonical);
  }, [current, canonical, base, history]);
  if (!/^\/(pets|skills)\/[1-9]\d*\//.test(canonical)) return null;
  const href = new URL(base.replace(/\/$/, '') + canonical.split(/[?#]/)[0], siteConfig.url || 'https://wiki.invalid').href;
  return <Head><link rel="canonical" href={href} /><meta property="og:url" content={href} /></Head>;
}
