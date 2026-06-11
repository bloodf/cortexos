import dns from 'node:dns';

const resolver = new dns.promises.Resolver();
const configuredServers = (process.env.MAIL_GUARDIAN_DNS_SERVERS ?? '1.1.1.1,8.8.8.8')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
if (configuredServers.length > 0) resolver.setServers(configuredServers);

const lookupWithFallback = (
  hostname: string,
  options: dns.LookupOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family?: number,
  ) => void,
): void => {
  dns.lookup(hostname, options as dns.LookupOneOptions, async (err, address, family) => {
    if (!err) {
      callback(null, address, family);
      return;
    }
    try {
      const addresses = await resolver.resolve4(hostname);
      if (!addresses[0]) throw err;
      if (options.all) {
        callback(
          null,
          addresses.map((item) => ({ address: item, family: 4 })),
        );
      } else callback(null, addresses[0], 4);
    } catch {
      callback(err, '', 0);
    }
  });
};

export default lookupWithFallback;
