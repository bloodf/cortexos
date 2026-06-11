import dns from 'node:dns';
import type { LookupFunction } from 'node:net';
import { getMailGuardianDnsServers } from './env.js';

const resolver = new dns.promises.Resolver();
const configuredServers = getMailGuardianDnsServers()
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
if (configuredServers.length > 0) resolver.setServers(configuredServers);

const lookupWithFallback: LookupFunction = (
  hostname: string,
  options: dns.LookupOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family?: number,
  ) => void,
): void => {
  dns.promises
    .lookup(hostname, options)
    .then((result) => {
      if (Array.isArray(result)) {
        callback(null, result);
      } else {
        callback(null, result.address, result.family);
      }
    })
    .catch(async (err) => {
      try {
        const addresses = await resolver.resolve4(hostname);
        if (!addresses[0]) throw err;
        if (options.all) {
          callback(
            null,
            addresses.map((item) => ({ address: item, family: 4 })),
          );
        } else {
          callback(null, addresses[0], 4);
        }
      } catch {
        callback(err, '', 0);
      }
    });
};

export default lookupWithFallback;
