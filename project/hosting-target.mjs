const marker = 'const FORK_RELEASE_HOST = "lrc.vvrtx.lol";';
export function validReleaseHost(host) {
  return typeof host === 'string' && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host);
}
export function targetLoader(source, host) {
  if (!validReleaseHost(host)) throw new Error('Unsupported hosting target');
  if (!source.includes(marker)) throw new Error('Missing release-host marker in loader template');
  return source.replace(marker, `const FORK_RELEASE_HOST = ${JSON.stringify(host)};`);
}
